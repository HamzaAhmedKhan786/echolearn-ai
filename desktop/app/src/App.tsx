import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { extractDocumentText, isImportableDocument } from "./documentParsers";
import "./App.css";

const navItems = ["Library", "Reader", "AI Tutor", "Flashcards", "Quizzes", "Models", "Get Started", "Settings"];

const scopes = [
  "Current paragraph",
  "Current sentence",
  "Current page",
  "Current chapter",
  "Selected text",
  "Whole document",
];

type DocumentFile = {
  name: string;
  size: number;
  type: string;
};

type ImportResult = {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  character_count: number;
  chunk_count: number;
  persisted?: boolean;
  chunks?: StoredChunk[];
};

type StoredDocument = {
  id: string;
  title: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
};

type StoredChunk = {
  id: string;
  chunk_index: number;
  text: string;
  token_estimate: number;
};

type TutorAnswer = {
  answer: string;
  citations: Array<{
    chunk_id: string;
    chunk_index: number;
    excerpt: string;
  }>;
};

type StudyItem = {
  id: string;
  kind: string;
  prompt: string;
  answer: string;
  source_chunk_id: string;
  source_chunk_index: number;
};

type RuntimeConfig = {
  cloud_provider: string;
  cloud_api_base_url: string;
  cloud_model: string;
  cloud_api_key_env: string;
  ollama_endpoint: string;
  ollama_model: string;
  llama_binary_path: string;
  llm_model_path: string;
  piper_binary_path: string;
  piper_voice_path: string;
  faiss_index_dir: string;
};

type IndexResult = {
  document_id: string;
  embedding_count: number;
  dimension: number;
  index_path: string;
};

type TtsStatus = {
  piper_binary_exists: boolean;
  piper_voice_exists: boolean;
  piper_voice_config_exists: boolean;
  piper_ready: boolean;
  windows_tts_available: boolean;
  recommended_voice_dir: string;
  messages: string[];
};

const defaultRuntimeConfig: RuntimeConfig = {
  cloud_provider: "none",
  cloud_api_base_url: "",
  cloud_model: "",
  cloud_api_key_env: "",
  ollama_endpoint: "http://127.0.0.1:11434",
  ollama_model: "",
  llama_binary_path: "",
  llm_model_path: "",
  piper_binary_path: "",
  piper_voice_path: "",
  faiss_index_dir: "",
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState("Library");
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState(scopes[0]);
  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<StoredDocument | null>(null);
  const [readerChunks, setReaderChunks] = useState<StoredChunk[]>([]);
  const [bookmarkedChunkIds, setBookmarkedChunkIds] = useState<string[]>([]);
  const [readerSearch, setReaderSearch] = useState("");
  const [fontScale, setFontScale] = useState(1);
  const [speechSpeed, setSpeechSpeed] = useState(1);
  const [studyItems, setStudyItems] = useState<StudyItem[]>([]);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [runtimeDefaults, setRuntimeDefaults] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [modelStatus, setModelStatus] = useState("Configure local model paths to enable topic-focused answers and Piper TTS.");
  const [ttsStatus, setTtsStatus] = useState<TtsStatus | null>(null);
  const [ttsValidationStatus, setTtsValidationStatus] = useState("");
  const [ttsValidationBusy, setTtsValidationBusy] = useState(false);
  const [showStartupGuide, setShowStartupGuide] = useState(true);
  const [importStatus, setImportStatus] = useState("No document imported yet.");
  const [learnerAge, setLearnerAge] = useState(() => localStorage.getItem("echolearnLearnerAge") ?? "");
  const [chatMessages, setChatMessages] = useState<string[]>(() => {
    const saved = localStorage.getItem("echolearnChatMessages");
    return saved
      ? JSON.parse(saved)
      : ["Upload a document and I will stay focused on its topic while helping you understand it."];
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const documentSize = useMemo(() => {
    if (!documentFile) return "";
    return `${(documentFile.size / 1024 / 1024).toFixed(2)} MB`;
  }, [documentFile]);

  async function handleFile(file: File) {
    setDocumentFile({
      name: file.name,
      size: file.size,
      type: file.type || "Unknown",
    });

    setActivePage("Reader");
    setImportResult(null);

    if (!isImportableDocument(file)) {
      const message = `Document "${file.name}" is selected, but this type is not supported yet.`;
      setImportStatus(message);
      setChatMessages([message]);
      return;
    }

    setImportStatus(`Importing "${file.name}"...`);

    try {
      const text = await extractDocumentText(file);
      const result = await importTextDocument(file, text);
      setImportResult(result);
      setSelectedDocument({
        id: result.id,
        title: result.name,
        file_type: result.file_type,
        file_size: result.file_size,
        chunk_count: result.chunk_count,
        created_at: new Date().toISOString(),
      });
      setReaderChunks(result.chunks ?? []);
      setBookmarkedChunkIds([]);
      setStudyItems(generatePreviewStudyItems(result.chunks ?? []));
      setImportStatus(
        `Imported ${result.chunk_count} chunks from ${result.character_count.toLocaleString()} characters.`,
      );
      await refreshDocuments(result);
      setChatMessages([
        `Document "${file.name}" is imported into ${result.chunk_count} local text chunks.`,
        "Ask questions that stay on the document topic. I can add simple explanation when it helps understanding.",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportStatus(`Import failed: ${message}`);
      setChatMessages([
        `Document "${file.name}" is selected, but import failed: ${message}`,
      ]);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function refreshDocuments(fallbackDocument?: ImportResult) {
    try {
      const stored = await invoke<StoredDocument[]>("list_documents");
      setDocuments(stored);
    } catch {
      if (fallbackDocument) {
        setDocuments((previous) => [
          {
            id: fallbackDocument.id,
            title: fallbackDocument.name,
            file_type: fallbackDocument.file_type,
            file_size: fallbackDocument.file_size,
            chunk_count: fallbackDocument.chunk_count,
            created_at: new Date().toISOString(),
          },
          ...previous.filter((document) => document.id !== fallbackDocument.id),
        ]);
      }
    }
  }

  async function openStoredDocument(document: StoredDocument) {
    setSelectedDocument(document);
    setDocumentFile({
      name: document.title,
      size: document.file_size,
      type: document.file_type,
    });
    setImportResult({
      id: document.id,
      name: document.title,
      file_type: document.file_type,
      file_size: document.file_size,
      character_count: 0,
      chunk_count: document.chunk_count,
      persisted: true,
    });
    setImportStatus(`Loaded ${document.chunk_count} saved chunks from your local library.`);
    setActivePage("Reader");

    try {
      const chunks = await invoke<StoredChunk[]>("get_document_chunks", { documentId: document.id });
      setReaderChunks(chunks);
      setStudyItems(await generateStudyItems(document.id, chunks));
    } catch {
      setReaderChunks([]);
      setStudyItems([]);
    }
  }

  function toggleBookmark(chunkId: string) {
    setBookmarkedChunkIds((previous) =>
      previous.includes(chunkId)
        ? previous.filter((id) => id !== chunkId)
        : [...previous, chunkId],
    );
  }

  useEffect(() => {
    void refreshDocuments();
    void (async () => {
      try {
        const defaults = await invoke<RuntimeConfig>("get_runtime_defaults");
        const config = await invoke<RuntimeConfig>("get_runtime_config");
        setRuntimeDefaults(defaults);
        setRuntimeConfig(config);
        setTtsStatus(await invoke<TtsStatus>("validate_tts_setup"));
      } catch {
        setRuntimeDefaults(defaultRuntimeConfig);
        setRuntimeConfig(defaultRuntimeConfig);
        setTtsStatus(null);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("echolearnLearnerAge", learnerAge);
  }, [learnerAge]);

  useEffect(() => {
    localStorage.setItem("echolearnChatMessages", JSON.stringify(chatMessages));
  }, [chatMessages]);

  async function refreshTtsStatus() {
    setTtsValidationBusy(true);
    setTtsValidationStatus("Checking TTS setup...");
    try {
      const status = await invoke<TtsStatus>("validate_tts_setup");
      setTtsStatus(status);
      setTtsValidationStatus(
        status.piper_ready
          ? "TTS validation passed. Piper is ready."
          : "TTS validation finished. Windows voice fallback is available, but Piper is not fully configured.",
      );
    } catch (error) {
      setTtsStatus(null);
      setTtsValidationStatus(`TTS validation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTtsValidationBusy(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleAsk() {
    if (!selectedDocument && !documentFile) {
      alert("Please upload or select a document first.");
      return;
    }

    if (!question.trim()) {
      alert("Please enter a question.");
      return;
    }

    const askedQuestion = question;
    setQuestion("");
    setChatMessages((prev) => [...prev, `You asked from scope "${scope}": ${askedQuestion}`]);

    if (readerChunks.length === 0) {
      setChatMessages((prev) => [...prev, "I need readable text from the uploaded document before I can answer."]);
      return;
    }

    try {
      const answer = await askStoredDocument(
        selectedDocument?.id ?? importResult?.id ?? "current-document",
        askedQuestion,
        readerChunks,
        learnerAge,
      );
      setChatMessages((prev) => [
        ...prev,
        answer.answer,
        ...answer.citations.map(
          (citation) => `Source chunk ${citation.chunk_index + 1}: ${citation.excerpt}`,
        ),
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        `Grounded answer failed: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }

  async function handleSaveRuntimeConfig(config: RuntimeConfig) {
    setRuntimeConfig(config);
    try {
      const saved = await invoke<RuntimeConfig>("save_runtime_config", { config });
      setRuntimeConfig(saved);
      setModelStatus("Runtime paths saved locally. Rebuild the vector export after changing index settings.");
      await refreshTtsStatus();
    } catch (error) {
      setModelStatus(`Runtime paths are kept in this preview. Tauri save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleLoadRuntimeDefaults() {
    setRuntimeConfig(runtimeDefaults);
    setModelStatus("Loaded suggested paths from config/runtime-defaults.json. Save paths to keep them.");
  }

  async function handleValidateTts(config: RuntimeConfig) {
    setTtsValidationBusy(true);
    setTtsValidationStatus("Checking the visible TTS paths...");
    setRuntimeConfig(config);

    try {
      const status = await invoke<TtsStatus>("validate_tts_config", { config });
      setTtsStatus(status);
      setTtsValidationStatus(
        status.piper_ready
          ? "TTS validation passed. Piper is ready."
          : "TTS validation finished. Windows voice fallback is available, but Piper is not fully configured.",
      );
    } catch (error) {
      setTtsValidationStatus(`TTS validation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTtsValidationBusy(false);
    }
  }

  async function handleBuildIndex() {
    if (!selectedDocument) {
      setModelStatus("Import or open a document before rebuilding the vector export.");
      return;
    }

    try {
      const result = await invoke<IndexResult>("build_vector_index", {
        documentId: selectedDocument.id,
      });
      setModelStatus(
        `Indexed ${result.embedding_count} embeddings (${result.dimension}d) at ${result.index_path}.`,
      );
    } catch (error) {
      setModelStatus(`Index build failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleSpeakCurrentChunk() {
    const text = readerChunks[0]?.text ?? selectedDocument?.title ?? documentFile?.name ?? "";
    if (!text.trim()) {
      setImportStatus("Load a document before using TTS.");
      return;
    }

    try {
      const result = await invoke<{ audio_path: string; engine: string }>("speak_text", {
        text: excerptPreview(text, 1200),
        speed: speechSpeed,
      });
      setImportStatus(
        result.engine === "piper"
          ? `TTS audio generated: ${result.audio_path}`
          : "Read aloud using Windows native TTS fallback.",
      );
    } catch (error) {
      setImportStatus(`TTS failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleExportChatPdf() {
    const title = selectedDocument?.title ?? documentFile?.name ?? "EchoLearn chat";
    const printable = window.open("", "_blank", "width=900,height=700");
    if (!printable) return;

    printable.document.write(`
      <html>
        <head>
          <title>${escapeHtml(title)} - chat</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            .meta { color: #6b7280; margin-bottom: 24px; }
            .message { border-bottom: 1px solid #e5e7eb; padding: 12px 0; line-height: 1.5; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">EchoLearn AI chat export</div>
          ${chatMessages.map((message) => `<div class="message">${escapeHtml(message)}</div>`).join("")}
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  }

  return (
    <div className={sidebarOpen ? "appShell" : "appShell collapsed"}>
      {showStartupGuide && (
        <StartupGuide
          onClose={() => setShowStartupGuide(false)}
          onOpenSetup={() => {
            setActivePage("Get Started");
            setShowStartupGuide(false);
          }}
          onOpenModels={() => {
            setActivePage("Models");
            setShowStartupGuide(false);
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.docx,.txt,.epub"
        onChange={handleFileChange}
      />

      <aside className="sidebar">
        <div className="brandRow">
          <div className="brandLogo">EL</div>

          {sidebarOpen && (
            <div>
              <h2>EchoLearn AI</h2>
              <p>Offline study assistant</p>
            </div>
          )}

          <button
            className="iconButton"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? "<" : ">"}
          </button>
        </div>

        <button className="uploadBtn" onClick={handleUploadClick}>
          <span>UP</span>
          {sidebarOpen && "Upload document"}
        </button>

        <nav className="nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActivePage(item)}
              className={activePage === item ? "navItem active" : "navItem"}
              title={item}
            >
              <span>{iconFor(item)}</span>
              {sidebarOpen && <b>{item}</b>}
            </button>
          ))}
        </nav>

        <div className="privacyCard">
          <span>OFF</span>
          {sidebarOpen && (
            <div>
              <strong>Private by default</strong>
              <p>Designed for local models, storage, and retrieval.</p>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
            <p>{pageSubtitle(activePage)}</p>
          </div>

          <div className="topbarActions">
            <button className="helpButton" onClick={() => setShowStartupGuide(true)}>
              Guide
            </button>
            <div className="status">
              <span />
              Offline ready
            </div>
          </div>
        </header>

        {activePage === "Library" && (
          <>
            <Hero onUploadClick={handleUploadClick} />
            <FeatureCards />
            <LibraryList documents={documents} onOpenDocument={openStoredDocument} />
            <DocumentPanel
              documentFile={documentFile}
              importResult={importResult}
              importStatus={importStatus}
              documentSize={documentSize}
              onDrop={handleDrop}
              onUploadClick={handleUploadClick}
            />
          </>
        )}

        {activePage === "Reader" && (
          <ReaderPage
            documentFile={documentFile}
            selectedDocument={selectedDocument}
            chunks={readerChunks}
            bookmarkedChunkIds={bookmarkedChunkIds}
            readerSearch={readerSearch}
            fontScale={fontScale}
            speechSpeed={speechSpeed}
            importResult={importResult}
            importStatus={importStatus}
            documentSize={documentSize}
            onDrop={handleDrop}
            onUploadClick={handleUploadClick}
            onSearchChange={setReaderSearch}
            onFontScaleChange={setFontScale}
            onSpeechSpeedChange={setSpeechSpeed}
            onToggleBookmark={toggleBookmark}
            onSpeak={handleSpeakCurrentChunk}
          />
        )}

        {activePage === "AI Tutor" && (
          <WorkPage
            title="Ask from your document"
            eyebrow="Grounded answers"
            metrics={["Scope locked", "Citations planned", "Fallback guarded"]}
          />
        )}

        {activePage === "Flashcards" && (
          <StudyToolsPage title="Flashcards" kind="flashcard" items={studyItems} />
        )}

        {activePage === "Quizzes" && (
          <StudyToolsPage title="Quizzes" kind="quiz" items={studyItems} />
        )}

        {activePage === "Models" && (
          <ModelsPage
            key={JSON.stringify(runtimeConfig)}
            config={runtimeConfig}
            defaults={runtimeDefaults}
            status={modelStatus}
            ttsStatus={ttsStatus}
            ttsValidationStatus={ttsValidationStatus}
            ttsValidationBusy={ttsValidationBusy}
            onSave={handleSaveRuntimeConfig}
            onLoadDefaults={handleLoadRuntimeDefaults}
            onBuildIndex={handleBuildIndex}
            onValidateTts={handleValidateTts}
          />
        )}

        {activePage === "Get Started" && <SetupPage />}

        {activePage === "Settings" && (
          <SettingsPage learnerAge={learnerAge} onLearnerAgeChange={setLearnerAge} />
        )}
      </main>

      <aside className="aiTutor">
        <div className="tutorHeader">
          <span>AI</span>
          <div>
            <h2>AI Tutor</h2>
            <p>Answers stay within selected scope</p>
          </div>
        </div>

        <label className="fieldLabel" htmlFor="scope-select">Scope</label>
        <select id="scope-select" value={scope} onChange={(e) => setScope(e.target.value)}>
          {scopes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <div className="infoBox">
          {selectedDocument || documentFile
            ? `Selected document: ${selectedDocument?.title ?? documentFile?.name}`
            : "Upload a document to start grounded Q&A."}
        </div>

        <div className="chatWindow">
          {chatMessages.map((message, index) => (
            <div className={index % 2 === 0 ? "chatMessage assistant" : "chatMessage user"} key={index}>
              <span>{index % 2 === 0 ? "AI" : "ME"}</span>
              <p>{message}</p>
            </div>
          ))}
        </div>

        <div className="questionBox">
          <textarea
            placeholder="Ask your question..."
            maxLength={2000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <span>{question.length} / 2000</span>
        </div>

        <button className="askBtn" onClick={() => void handleAsk()}>
          Ask EchoLearn
        </button>
        <button className="secondaryAskBtn" onClick={handleExportChatPdf}>
          Save chat as PDF
        </button>
      </aside>
    </div>
  );
}

function StartupGuide({
  onClose,
  onOpenSetup,
  onOpenModels,
}: {
  onClose: () => void;
  onOpenSetup: () => void;
  onOpenModels: () => void;
}) {
  return (
    <div className="guideOverlay" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <section className="guideDialog">
        <div className="panelHeader">
          <h3 id="guide-title">Welcome to EchoLearn</h3>
          <button className="iconButton" onClick={onClose} title="Close guide">X</button>
        </div>

        <div className="guideGrid">
          <GuideItem title="Add documents" text="Import PDF, DOCX, EPUB, or text files and keep them private on this device." />
          <GuideItem title="Ask questions" text="Use local AI with Ollama, or connect your own API key if you prefer a hosted model." />
          <GuideItem title="Read aloud" text="Use built-in Windows voices immediately, or install a higher-quality Piper voice." />
          <GuideItem title="Stay private" text="Your documents are designed to stay local unless you choose to connect an external AI provider." />
        </div>

        <div className="runtimeActions">
          <button onClick={onOpenSetup}>Get Started</button>
          <button className="secondary" onClick={onOpenModels}>AI & Voice</button>
          <button className="secondary" onClick={onClose}>Continue</button>
        </div>
      </section>
    </div>
  );
}

function GuideItem({ title, text }: { title: string; text: string }) {
  return (
    <article className="guideItem">
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function Hero({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <section className="hero">
      <div className="heroText">
        <div className="badge">Private AI study</div>
        <h2>Turn private study files into an offline tutor.</h2>
        <p>
          Import PDF, DOCX, EPUB, and text files. Read extracted chunks, ask scoped questions,
          and prepare study material with local-first storage.
        </p>

        <div className="actions">
          <button onClick={onUploadClick}>Start reading</button>
          <button className="ghost">AI & voice</button>
        </div>
      </div>

      <div className="heroPanel" aria-hidden="true">
        <div className="docPreview">
          <span />
          <span />
          <span />
          <strong>EchoLearn grounded answer</strong>
          <p>PDF / DOCX / EPUB extraction ready</p>
        </div>
      </div>
    </section>
  );
}

function FeatureCards() {
  return (
    <section className="cards">
      <Feature icon="DOC" title="Document Reader" text="PDF, DOCX, TXT, EPUB, Markdown, and web text." />
      <Feature icon="QA" title="Ask by Scope" text="Answer from a sentence, paragraph, page, chapter, or full document." />
      <Feature icon="ST" title="Study Tools" text="Summaries, flashcards, quizzes, notes, and definitions." />
    </section>
  );
}

function LibraryList({
  documents,
  onOpenDocument,
}: {
  documents: StoredDocument[];
  onOpenDocument: (document: StoredDocument) => void;
}) {
  return (
    <section className="documentPanel libraryList">
      <div className="panelHeader">
        <h3>Saved library</h3>
        <span>{documents.length ? `${documents.length} document${documents.length === 1 ? "" : "s"}` : "Local library"}</span>
      </div>

      {documents.length ? (
        <div className="documentRows">
          {documents.map((document) => (
            <button className="documentRow" key={document.id} onClick={() => void onOpenDocument(document)}>
              <div>
                <strong>{document.title}</strong>
                <p>{document.file_type || "Unknown type"} / {formatFileSize(document.file_size)}</p>
              </div>
              <span>{document.chunk_count} chunks</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="emptyState">
          No saved documents yet. Import a document to start your local study library.
        </p>
      )}
    </section>
  );
}

function ReaderPage({
  documentFile,
  selectedDocument,
  chunks,
  bookmarkedChunkIds,
  readerSearch,
  fontScale,
  speechSpeed,
  importResult,
  importStatus,
  documentSize,
  onDrop,
  onUploadClick,
  onSearchChange,
  onFontScaleChange,
  onSpeechSpeedChange,
  onToggleBookmark,
  onSpeak,
}: {
  documentFile: DocumentFile | null;
  selectedDocument: StoredDocument | null;
  chunks: StoredChunk[];
  bookmarkedChunkIds: string[];
  readerSearch: string;
  fontScale: number;
  speechSpeed: number;
  importResult: ImportResult | null;
  importStatus: string;
  documentSize: string;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onUploadClick: () => void;
  onSearchChange: (value: string) => void;
  onFontScaleChange: (value: number) => void;
  onSpeechSpeedChange: (value: number) => void;
  onToggleBookmark: (chunkId: string) => void;
  onSpeak: () => void;
}) {
  const visibleChunks = chunks.filter((chunk) =>
    readerSearch.trim()
      ? chunk.text.toLowerCase().includes(readerSearch.trim().toLowerCase())
      : true,
  );

  return (
    <>
      <DocumentPanel
        documentFile={documentFile}
        importResult={importResult}
        importStatus={importStatus}
        documentSize={documentSize}
        onDrop={onDrop}
        onUploadClick={onUploadClick}
      />
      <section className="readerSurface">
        <div className="readerToolbar">
          <button onClick={() => onFontScaleChange(Math.max(0.85, fontScale - 0.1))}>A-</button>
          <button onClick={() => onFontScaleChange(Math.min(1.35, fontScale + 0.1))}>A+</button>
          <button onClick={onSpeak}>Listen</button>
          <button onClick={() => onSpeechSpeedChange(Math.max(0.5, Number((speechSpeed - 0.1).toFixed(1))))}>
            Slower
          </button>
          <span>{speechSpeed.toFixed(1)}x</span>
          <button onClick={() => onSpeechSpeedChange(Math.min(2, Number((speechSpeed + 0.1).toFixed(1))))}>
            Faster
          </button>
          <input
            aria-label="Search document"
            placeholder="Search chunks..."
            value={readerSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <span>{bookmarkedChunkIds.length} bookmarks</span>
        </div>
        <article style={{ fontSize: `${fontScale}rem` }}>
          <h3>{selectedDocument?.title ?? documentFile?.name ?? "No document loaded"}</h3>
          <p>
            {importResult
              ? `${importResult.chunk_count} chunks are ready for embeddings, citations, and local Q&A.`
              : "The reader canvas is ready for parsed text, sentence highlighting, page navigation, and local text-to-speech playback."}
          </p>
          {visibleChunks.length > 0 && (
            <div className="chunkList">
              {visibleChunks.slice(0, 12).map((chunk) => (
                <section className="chunkItem" key={chunk.id}>
                  <div className="chunkHeader">
                    <strong>Chunk {chunk.chunk_index + 1}</strong>
                    <button onClick={() => onToggleBookmark(chunk.id)}>
                      {bookmarkedChunkIds.includes(chunk.id) ? "Saved" : "Bookmark"}
                    </button>
                  </div>
                  <p>{chunk.text}</p>
                </section>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}

function StudyToolsPage({
  title,
  kind,
  items,
}: {
  title: string;
  kind: string;
  items: StudyItem[];
}) {
  const visibleItems = items.filter((item) => item.kind === kind);

  return (
    <section className="documentPanel workPanel">
      <div className="badge">Generated from chunks</div>
      <h2>{title}</h2>
      {visibleItems.length ? (
        <div className="studyList">
          {visibleItems.map((item) => (
            <article className="studyItem" key={item.id}>
              <strong>{item.prompt}</strong>
              <p>{item.answer}</p>
              <span>Source chunk {item.source_chunk_index + 1}</span>
            </article>
          ))}
        </div>
      ) : (
        <p>Import or open a document to generate study items.</p>
      )}
    </section>
  );
}

function DocumentPanel({
  documentFile,
  importResult,
  importStatus,
  documentSize,
  onDrop,
  onUploadClick,
}: {
  documentFile: DocumentFile | null;
  importResult: ImportResult | null;
  importStatus: string;
  documentSize: string;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onUploadClick: () => void;
}) {
  return (
    <section className="documentPanel">
      <div className="panelHeader">
        <h3>Current document</h3>
        <span>{documentFile ? documentFile.name : "No document selected"}</span>
      </div>

      <div
        className="dropZone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        onClick={onUploadClick}
      >
        <div className="dropIcon">FILE</div>

        {documentFile ? (
          <>
            <h3>{documentFile.name}</h3>
            <p>
              Size: {documentSize} / Type: {documentFile.type}
            </p>
            <p>{importStatus}</p>
            {importResult && (
              <div className="importStats">
                <span>{importResult.chunk_count} chunks</span>
                <span>{importResult.character_count.toLocaleString()} chars</span>
              </div>
            )}
          </>
        ) : (
          <>
            <h3>Drop your first document here</h3>
            <p>Click or drag a PDF, DOCX, TXT, or EPUB file.</p>
          </>
        )}
      </div>
    </section>
  );
}

async function importTextDocument(file: File, text: string): Promise<ImportResult> {
  try {
    return await invoke<ImportResult>("import_document_text", {
      name: file.name,
      fileType: file.type || file.name.split(".").pop() || "text/plain",
      fileSize: file.size,
      text,
    });
  } catch (error) {
    if (isMissingTauriRuntime(error)) {
      const normalized = text.trim();
      const chunks = chunkTextPreview(`web-preview-${Date.now()}`, normalized);
      return {
        id: chunks.documentId,
        name: file.name,
        file_type: file.type || "text/plain",
        file_size: file.size,
        character_count: normalized.length,
        chunk_count: chunks.items.length,
        persisted: false,
        chunks: chunks.items,
      };
    }

    throw error;
  }
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

async function askStoredDocument(
  documentId: string,
  question: string,
  fallbackChunks: StoredChunk[],
  learnerAge: string,
): Promise<TutorAnswer> {
  try {
    return await invoke<TutorAnswer>("ask_document_question", {
      documentId,
      question,
      learnerAge: normalizedLearnerAge(learnerAge),
    });
  } catch (error) {
    if (!isMissingTauriRuntime(error) && fallbackChunks.length === 0) {
      throw error;
    }

    const terms = usefulTerms(question);
    const citations = fallbackChunks
      .map((chunk) => ({
        chunk,
        score: terms.filter((term) => usefulTerms(chunk.text).includes(term)).length,
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ chunk }) => ({
        chunk_id: chunk.id,
        chunk_index: chunk.chunk_index,
        excerpt: excerptPreview(chunk.text, 360),
      }));

    const solidMatch = citations.length > 0 && terms.length > 0;
    if (!solidMatch) {
      return {
        answer:
          "This question does not have a strong match with the uploaded document. I can help when the question stays on the same subject or topic as the document.",
        citations: [],
      };
    }

    const ageNote = learnerAge.trim()
      ? ` I will explain it in a way that fits a ${learnerAge.trim()} year old learner.`
      : "";

    return {
      answer: `This question matches the document topic.${ageNote} I found ${citations.length} relevant source chunk${citations.length === 1 ? "" : "s"} and can add simple explanation without changing the subject.`,
      citations,
    };
  }
}

function usefulTerms(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .filter(
      (term) =>
        ![
          "the",
          "and",
          "for",
          "with",
          "from",
          "this",
          "that",
          "what",
          "how",
          "why",
          "can",
          "you",
          "are",
        ].includes(term),
    );
}

function normalizedLearnerAge(value: string) {
  const age = Number.parseInt(value, 10);
  return Number.isFinite(age) && age > 0 ? age : null;
}

async function generateStudyItems(documentId: string, fallbackChunks: StoredChunk[]) {
  try {
    const items = await invoke<StudyItem[]>("generate_study_items", { documentId });
    return items.length ? items : generatePreviewStudyItems(fallbackChunks);
  } catch {
    return generatePreviewStudyItems(fallbackChunks);
  }
}

function generatePreviewStudyItems(chunks: StoredChunk[]) {
  return chunks.slice(0, 12).map((chunk, index) => {
    const sentence = firstUsefulSentence(chunk.text);
    const isFlashcard = index % 2 === 0;

    return {
      id: `study-${chunk.id}-${index}`,
      kind: isFlashcard ? "flashcard" : "quiz",
      prompt: isFlashcard
        ? `Explain this idea: ${excerptPreview(sentence, 120)}`
        : `What is best supported by chunk ${chunk.chunk_index + 1}?`,
      answer: excerptPreview(chunk.text, 420),
      source_chunk_id: chunk.id,
      source_chunk_index: chunk.chunk_index,
    };
  });
}

function firstUsefulSentence(text: string) {
  return (
    text
      .split(/[.!?\n]/)
      .map((part) => part.trim())
      .find((part) => part.length > 24) || text.trim()
  );
}

function chunkTextPreview(documentId: string, text: string) {
  const items: StoredChunk[] = [];
  const target = 1400;
  const overlap = 220;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + target);
    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      items.push({
        id: `${documentId}-chunk-${items.length}`,
        chunk_index: items.length,
        text: chunkText,
        token_estimate: Math.max(1, chunkText.split(/\s+/).length),
      });
    }
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }

  return { documentId, items };
}

function excerptPreview(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isMissingTauriRuntime(error: unknown) {
  return String(error).includes("__TAURI_INTERNALS__") || String(error).includes("not available");
}

function WorkPage({
  title,
  eyebrow,
  metrics,
}: {
  title: string;
  eyebrow: string;
  metrics: string[];
}) {
  return (
    <section className="documentPanel workPanel">
      <div className="badge">{eyebrow}</div>
      <h2>{title}</h2>
      <p>
        This workspace is ready for the next backend integration step. The layout
        is prepared for generated results, citations, and review controls.
      </p>
      <div className="settingsGrid">
        {metrics.map((metric) => (
          <div key={metric}>{metric}</div>
        ))}
      </div>
    </section>
  );
}

function ModelsPage({
  config,
  defaults,
  status,
  ttsStatus,
  ttsValidationStatus,
  ttsValidationBusy,
  onSave,
  onLoadDefaults,
  onBuildIndex,
  onValidateTts,
}: {
  config: RuntimeConfig;
  defaults: RuntimeConfig;
  status: string;
  ttsStatus: TtsStatus | null;
  ttsValidationStatus: string;
  ttsValidationBusy: boolean;
  onSave: (config: RuntimeConfig) => void;
  onLoadDefaults: () => void;
  onBuildIndex: () => void;
  onValidateTts: (config: RuntimeConfig) => void;
}) {
  const [draft, setDraft] = useState(config);

  function updateField(field: keyof RuntimeConfig, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <>
      <section className="cards modelCards">
        <Feature icon="OLL" title="Ollama first" text="Use your local Ollama server for grounded answer synthesis before adding llama.cpp." />
        <Feature icon="KEY" title="Bring your own key" text="Use personal OpenAI, Claude, Gemini, Groq, or OpenRouter keys from environment variables." />
        <Feature icon="EMB" title="Topic matching" text="EchoLearn checks whether a question strongly matches the current document before answering." />
        <Feature icon="TTS" title="Piper TTS" text="Set Piper and a voice model to generate local WAV narration from reader chunks." />
      </section>

      <section className="documentPanel runtimePanel">
        <div className="panelHeader">
          <h3>Runtime paths</h3>
          <span>No Whisper configured</span>
        </div>

        <div className="runtimeGrid">
          <RuntimeField
            label="Ollama endpoint"
            value={draft.ollama_endpoint}
            placeholder={defaults.ollama_endpoint || "http://127.0.0.1:11434"}
            onChange={(value) => updateField("ollama_endpoint", value)}
          />
          <RuntimeField
            label="Ollama model"
            value={draft.ollama_model}
            placeholder={defaults.ollama_model || "llama3.2:1b"}
            onChange={(value) => updateField("ollama_model", value)}
          />
          <RuntimeField
            label="Cloud provider"
            value={draft.cloud_provider}
            placeholder={defaults.cloud_provider || "none / openai / anthropic / gemini / groq / openrouter"}
            onChange={(value) => updateField("cloud_provider", value)}
          />
          <RuntimeField
            label="Cloud API base URL"
            value={draft.cloud_api_base_url}
            placeholder={defaults.cloud_api_base_url || "https://api.openai.com/v1"}
            onChange={(value) => updateField("cloud_api_base_url", value)}
          />
          <RuntimeField
            label="Cloud model"
            value={draft.cloud_model}
            placeholder={defaults.cloud_model || "gpt-4.1-mini / claude-haiku / gemini-flash / llama-3.1-8b"}
            onChange={(value) => updateField("cloud_model", value)}
          />
          <RuntimeField
            label="API key env var"
            value={draft.cloud_api_key_env}
            placeholder={defaults.cloud_api_key_env || "OPENAI_API_KEY"}
            onChange={(value) => updateField("cloud_api_key_env", value)}
          />
          <RuntimeField
            label="llama.cpp binary"
            value={draft.llama_binary_path}
            placeholder={defaults.llama_binary_path || "C:\\Tools\\llama.cpp\\llama-cli.exe"}
            onChange={(value) => updateField("llama_binary_path", value)}
          />
          <RuntimeField
            label="GGUF LLM model"
            value={draft.llm_model_path}
            placeholder={defaults.llm_model_path || "D:\\Models\\mistral-7b-instruct.Q4_K_M.gguf"}
            onChange={(value) => updateField("llm_model_path", value)}
          />
          <RuntimeField
            label="Piper binary"
            value={draft.piper_binary_path}
            placeholder={defaults.piper_binary_path || "C:\\Tools\\piper\\piper.exe"}
            onChange={(value) => updateField("piper_binary_path", value)}
          />
          <RuntimeField
            label="Piper voice model"
            value={draft.piper_voice_path}
            placeholder={defaults.piper_voice_path || "D:\\Models\\piper\\en_US-lessac-medium.onnx"}
            onChange={(value) => updateField("piper_voice_path", value)}
          />
          <RuntimeField
            label="FAISS export directory"
            value={draft.faiss_index_dir}
            placeholder={defaults.faiss_index_dir || "C:\\Users\\DELL\\Documents\\EchoLearn\\faiss"}
            onChange={(value) => updateField("faiss_index_dir", value)}
          />
        </div>

        <div className="runtimeActions">
          <button className="secondary" onClick={onLoadDefaults}>Load suggested paths</button>
          <button onClick={() => onSave(draft)}>Save paths</button>
          <button className="secondary" onClick={onBuildIndex}>Rebuild vector export</button>
        </div>

        <p className="modelStatus">{status}</p>
        <p className="modelStatus">
          API keys should stay in environment variables or OS secure storage. Do not paste real keys into Git,
          screenshots, or shared docs.
        </p>
      </section>

      <section className="documentPanel runtimePanel">
        <div className="panelHeader">
          <h3>TTS setup</h3>
          <span>{ttsStatus?.piper_ready ? "Piper ready" : "Piper with Windows fallback"}</span>
        </div>

        <div className="ttsChecklist">
          <TtsCheck label="Piper binary" ready={Boolean(ttsStatus?.piper_binary_exists)} />
          <TtsCheck label="Voice .onnx" ready={Boolean(ttsStatus?.piper_voice_exists)} />
          <TtsCheck label="Voice .onnx.json" ready={Boolean(ttsStatus?.piper_voice_config_exists)} />
          <TtsCheck label="Windows fallback" ready={Boolean(ttsStatus?.windows_tts_available)} />
        </div>

        {ttsStatus && (
          <div className="ttsMessages">
            {ttsStatus.messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
            <p>Recommended app voice folder: {ttsStatus.recommended_voice_dir}</p>
          </div>
        )}

        {ttsValidationStatus && <p className="modelStatus">{ttsValidationStatus}</p>}

        <div className="runtimeActions">
          <button disabled={ttsValidationBusy} onClick={() => onValidateTts(draft)}>
            {ttsValidationBusy ? "Checking TTS..." : "Validate TTS"}
          </button>
          <a
            className="secondaryLink"
            href="https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0"
            target="_blank"
            rel="noreferrer"
          >
            Download voices
          </a>
        </div>
      </section>
    </>
  );
}

function TtsCheck({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={ready ? "ttsCheck ready" : "ttsCheck missing"}>
      <span>{ready ? "OK" : "MISS"}</span>
      <strong>{label}</strong>
    </div>
  );
}

function RuntimeField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="runtimeField">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SettingsPage({
  learnerAge,
  onLearnerAgeChange,
}: {
  learnerAge: string;
  onLearnerAgeChange: (value: string) => void;
}) {
  return (
    <section className="documentPanel">
      <div className="panelHeader">
        <h3>Settings</h3>
        <span>Learning preferences</span>
      </div>

      <label className="runtimeField learnerAgeField">
        <span>Learner age</span>
        <input
          type="number"
          min="5"
          max="120"
          value={learnerAge}
          placeholder="Example: 12"
          onChange={(event) => onLearnerAgeChange(event.target.value)}
        />
      </label>

      <div className="settingsGrid">
        <div>Theme: Dark</div>
        <div>Storage: Local encrypted</div>
        <div>Telemetry: Disabled</div>
        <div>AI mode: Topic-focused</div>
      </div>
    </section>
  );
}

const setupDownloads = [
  {
    name: "Ollama",
    purpose: "Use local AI answers without sending documents to a cloud provider.",
    pc: "https://ollama.com/download",
    mobile: "Best for desktop use. Mobile can use personal API keys or a later local model manager.",
  },
  {
    name: "Piper voice",
    purpose: "Install an optional higher-quality offline reading voice for desktop.",
    pc: "https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0",
    mobile: "Mobile uses built-in Android/iOS voices first.",
  },
  {
    name: "OpenAI API key",
    purpose: "Connect a personal hosted AI account instead of downloading local models.",
    pc: "https://platform.openai.com/api-keys",
    mobile: "Use only your own key. Never share keys with other users.",
  },
  {
    name: "Gemini API key",
    purpose: "Use Google Gemini with your own account and current free-tier limits.",
    pc: "https://ai.google.dev/gemini-api/docs/api-key",
    mobile: "Keys should be stored securely on the user's device.",
  },
  {
    name: "Groq API key",
    purpose: "Use fast hosted open models with your own Groq account.",
    pc: "https://console.groq.com/keys",
    mobile: "Availability and free limits can change.",
  },
  {
    name: "OpenRouter API key",
    purpose: "Choose from many hosted models using your own OpenRouter account.",
    pc: "https://openrouter.ai/keys",
    mobile: "Some models may be free depending on current provider policy.",
  },
];

const setupChoices = [
  {
    title: "Import a document",
    text: "Drop or select a PDF, DOCX, EPUB, or text file from Library.",
  },
  {
    title: "Choose AI mode",
    text: "Local Ollama keeps processing on your computer. Personal API keys are optional for hosted models.",
  },
  {
    title: "Choose reading voice",
    text: "Windows voices work as a fallback. Piper voices give better offline quality when installed.",
  },
  {
    title: "Ask with citations",
    text: "Open a document, ask a question, and EchoLearn answers from the selected document chunks.",
  },
  {
    title: "Review with study tools",
    text: "Generate flashcards and quiz prompts from imported document chunks.",
  },
];

function SetupPage() {
  return (
    <>
      <section className="documentPanel setupPanel">
        <div className="panelHeader">
          <h3>Get started</h3>
          <span>Set up EchoLearn for private study</span>
        </div>

        <div className="setupSteps">
          <SetupStep number="1" title="Import your first file" text="Start with a PDF, DOCX, EPUB, or text document. EchoLearn turns it into readable chunks." />
          <SetupStep number="2" title="Pick how AI should answer" text="Use local Ollama for privacy, or connect your own API key if you prefer a hosted model." />
          <SetupStep number="3" title="Choose a reading voice" text="Windows reading voice works immediately. Piper is optional for better offline voice quality." />
          <SetupStep number="4" title="Ask from your document" text="Questions stay grounded in the selected document and show source chunks when available." />
          <SetupStep number="5" title="Create study material" text="Use flashcards and quizzes to review the imported content." />
        </div>
      </section>

      <section className="documentPanel setupPanel">
        <div className="panelHeader">
          <h3>Optional services</h3>
          <span>Use only what fits your privacy choice</span>
        </div>

        <div className="downloadGrid">
          {setupDownloads.map((item) => (
            <article className="downloadItem" key={item.name}>
              <strong>{item.name}</strong>
              <p>{item.purpose}</p>
              <a href={item.pc} target="_blank" rel="noreferrer">Open official page</a>
              <span>{item.mobile}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="documentPanel setupPanel">
        <div className="panelHeader">
          <h3>What you can do</h3>
          <span>No developer setup required</span>
        </div>

        <div className="commandList">
          {setupChoices.map((item) => (
            <article className="commandItem" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SetupStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="setupStep">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </article>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="featureCard">
      <div className="featureIcon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function pageSubtitle(page: string) {
  const subtitles: Record<string, string> = {
    Library: "Manage your private local study documents.",
    Reader: "Read, listen, and navigate imported content.",
    "AI Tutor": "Ask questions from selected context only.",
    Flashcards: "Generate review cards from document scope.",
    Quizzes: "Create practice questions from selected context.",
    Models: "Manage offline AI models, voices, and vector exports.",
    "Get Started": "Import a document, choose AI, and set reading preferences.",
    Settings: "Configure privacy, storage, and AI behavior.",
  };

  return subtitles[page];
}

function iconFor(item: string) {
  return {
    Library: "LB",
    Reader: "RD",
    "AI Tutor": "AI",
    Flashcards: "FC",
    Quizzes: "QZ",
    Models: "MD",
    "Get Started": "GS",
    Settings: "ST",
  }[item];
}

export default App;
