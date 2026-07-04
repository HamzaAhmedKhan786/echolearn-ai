import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { extractDocumentText, isImportableDocument } from "./documentParsers";
import "./App.css";

const navItems = ["Library", "Reader", "AI Tutor", "Flashcards", "Quizzes", "Models", "Setup", "Settings"];

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

const defaultRuntimeConfig: RuntimeConfig = {
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
  const [studyItems, setStudyItems] = useState<StudyItem[]>([]);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(defaultRuntimeConfig);
  const [modelStatus, setModelStatus] = useState("Configure local model paths to enable LLM synthesis and Piper TTS.");
  const [importStatus, setImportStatus] = useState("No document imported yet.");
  const [chatMessages, setChatMessages] = useState<string[]>([
    "Upload a document and I will answer only from its content.",
  ]);

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
        `Imported ${result.chunk_count} chunks from ${result.character_count.toLocaleString()} characters${result.persisted ? " and saved to PostgreSQL" : ""}.`,
      );
      await refreshDocuments(result);
      setChatMessages([
        `Document "${file.name}" is imported into ${result.chunk_count} local text chunks.`,
        result.persisted
          ? "Saved in PostgreSQL. Vector embeddings were indexed for local retrieval."
          : "Preview import only. Run the Tauri app with DATABASE_URL to persist to PostgreSQL.",
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
    setImportStatus(`Loaded ${document.chunk_count} saved chunks from PostgreSQL.`);
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
    void loadRuntimeConfig();
  }, []);

  async function loadRuntimeConfig() {
    try {
      const config = await invoke<RuntimeConfig>("get_runtime_config");
      setRuntimeConfig(config);
    } catch {
      setRuntimeConfig(defaultRuntimeConfig);
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

    if (!selectedDocument) {
      setChatMessages((prev) => [
        ...prev,
        "Select a saved PostgreSQL document to use grounded Q&A.",
      ]);
      return;
    }

    try {
      const answer = await askStoredDocument(selectedDocument.id, askedQuestion, readerChunks);
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
      setModelStatus("Runtime paths saved. Rebuild the vector index after changing embedding/index settings.");
    } catch (error) {
      setModelStatus(`Runtime paths are kept in this preview. Tauri save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleBuildIndex() {
    if (!selectedDocument) {
      setModelStatus("Open a saved PostgreSQL document before rebuilding the vector index.");
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
      const result = await invoke<{ audio_path: string }>("speak_text", {
        text: excerptPreview(text, 1200),
      });
      setImportStatus(`TTS audio generated: ${result.audio_path}`);
    } catch (error) {
      setImportStatus(`TTS failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div className={sidebarOpen ? "appShell" : "appShell collapsed"}>
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

          <div className="status">
            <span />
            Offline ready
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
            importResult={importResult}
            importStatus={importStatus}
            documentSize={documentSize}
            onDrop={handleDrop}
            onUploadClick={handleUploadClick}
            onSearchChange={setReaderSearch}
            onFontScaleChange={setFontScale}
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
            status={modelStatus}
            onSave={handleSaveRuntimeConfig}
            onBuildIndex={handleBuildIndex}
          />
        )}

        {activePage === "Setup" && <SetupPage />}

        {activePage === "Settings" && <SettingsPage />}
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
      </aside>
    </div>
  );
}

function Hero({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <section className="hero">
      <div className="heroText">
        <div className="badge">Local RAG / GGUF / FAISS</div>
        <h2>Turn private study files into an offline tutor.</h2>
        <p>
          Import PDF, DOCX, EPUB, and text files. Read extracted chunks, ask scoped questions,
          and prepare study material with local-first storage.
        </p>

        <div className="actions">
          <button onClick={onUploadClick}>Start reading</button>
          <button className="ghost">Local models</button>
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
        <span>{documents.length ? `${documents.length} document${documents.length === 1 ? "" : "s"}` : "PostgreSQL-backed"}</span>
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
          No saved documents yet. Import a text document after setting DATABASE_URL to save it in PostgreSQL.
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
  importResult,
  importStatus,
  documentSize,
  onDrop,
  onUploadClick,
  onSearchChange,
  onFontScaleChange,
  onToggleBookmark,
  onSpeak,
}: {
  documentFile: DocumentFile | null;
  selectedDocument: StoredDocument | null;
  chunks: StoredChunk[];
  bookmarkedChunkIds: string[];
  readerSearch: string;
  fontScale: number;
  importResult: ImportResult | null;
  importStatus: string;
  documentSize: string;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onUploadClick: () => void;
  onSearchChange: (value: string) => void;
  onFontScaleChange: (value: number) => void;
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
): Promise<TutorAnswer> {
  try {
    return await invoke<TutorAnswer>("ask_document_question", {
      documentId,
      question,
    });
  } catch (error) {
    if (!isMissingTauriRuntime(error) && fallbackChunks.length === 0) {
      throw error;
    }

    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2);
    const citations = fallbackChunks
      .map((chunk) => ({
        chunk,
        score: terms.filter((term) => chunk.text.toLowerCase().includes(term)).length,
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ chunk }) => ({
        chunk_id: chunk.id,
        chunk_index: chunk.chunk_index,
        excerpt: excerptPreview(chunk.text, 360),
      }));

    return {
      answer: citations.length
        ? `I found ${citations.length} relevant source chunk${citations.length === 1 ? "" : "s"} in the current preview import.`
        : "I could not find matching support in the selected document chunks.",
      citations,
    };
  }
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
  status,
  onSave,
  onBuildIndex,
}: {
  config: RuntimeConfig;
  status: string;
  onSave: (config: RuntimeConfig) => void;
  onBuildIndex: () => void;
}) {
  const [draft, setDraft] = useState(config);

  function updateField(field: keyof RuntimeConfig, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <>
      <section className="cards modelCards">
        <Feature icon="OLL" title="Ollama first" text="Use your local Ollama server for grounded answer synthesis before adding llama.cpp." />
        <Feature icon="EMB" title="Local embeddings" text="EchoLearn indexes deterministic 384d vectors immediately after PostgreSQL import." />
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
            placeholder="http://127.0.0.1:11434"
            onChange={(value) => updateField("ollama_endpoint", value)}
          />
          <RuntimeField
            label="Ollama model"
            value={draft.ollama_model}
            placeholder="llama3.2:1b"
            onChange={(value) => updateField("ollama_model", value)}
          />
          <RuntimeField
            label="llama.cpp binary"
            value={draft.llama_binary_path}
            placeholder="C:\\Tools\\llama.cpp\\llama-cli.exe"
            onChange={(value) => updateField("llama_binary_path", value)}
          />
          <RuntimeField
            label="GGUF LLM model"
            value={draft.llm_model_path}
            placeholder="D:\\Models\\mistral-7b-instruct.Q4_K_M.gguf"
            onChange={(value) => updateField("llm_model_path", value)}
          />
          <RuntimeField
            label="Piper binary"
            value={draft.piper_binary_path}
            placeholder="C:\\Tools\\piper\\piper.exe"
            onChange={(value) => updateField("piper_binary_path", value)}
          />
          <RuntimeField
            label="Piper voice model"
            value={draft.piper_voice_path}
            placeholder="D:\\Models\\piper\\en_US-lessac-medium.onnx"
            onChange={(value) => updateField("piper_voice_path", value)}
          />
          <RuntimeField
            label="FAISS export directory"
            value={draft.faiss_index_dir}
            placeholder="C:\\Users\\DELL\\Documents\\EchoLearn\\faiss"
            onChange={(value) => updateField("faiss_index_dir", value)}
          />
        </div>

        <div className="runtimeActions">
          <button onClick={() => onSave(draft)}>Save paths</button>
          <button className="secondary" onClick={onBuildIndex}>Rebuild vector index</button>
        </div>

        <p className="modelStatus">{status}</p>
      </section>
    </>
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

function SettingsPage() {
  return (
    <section className="documentPanel">
      <div className="panelHeader">
        <h3>Settings</h3>
        <span>Local-first configuration</span>
      </div>

      <div className="settingsGrid">
        <div>Theme: Dark</div>
        <div>Storage: Local encrypted</div>
        <div>Telemetry: Disabled</div>
        <div>AI mode: Offline</div>
      </div>
    </section>
  );
}

const setupDownloads = [
  {
    name: "Obsidian",
    purpose: "Open the repo as a documentation vault for notes, errors, and reusable project fixes.",
    pc: "https://obsidian.md/download",
    mobile: "Use Google Play or App Store from the same Obsidian download page.",
  },
  {
    name: "Docker Desktop",
    purpose: "Runs the local PostgreSQL service with docker compose.",
    pc: "https://docs.docker.com/desktop/setup/install/windows-install/",
    mobile: "Not required on phone.",
  },
  {
    name: "PostgreSQL",
    purpose: "Alternative to Docker if you want a normal local database install.",
    pc: "https://www.postgresql.org/download/windows/",
    mobile: "Not required on phone.",
  },
  {
    name: "Ollama",
    purpose: "Runs local LLM models with the easiest desktop setup.",
    pc: "https://ollama.com/download",
    mobile: "Run on PC first; mobile can connect later through a backend bridge.",
  },
  {
    name: "llama.cpp",
    purpose: "Optional advanced GGUF runtime if you do not want Ollama.",
    pc: "https://github.com/ggml-org/llama.cpp/releases",
    mobile: "Advanced later step; desktop is recommended first.",
  },
  {
    name: "Piper",
    purpose: "Generates local TTS audio from reader chunks.",
    pc: "https://github.com/rhasspy/piper/releases",
    mobile: "Mobile currently uses Android/iOS native TTS.",
  },
  {
    name: "Android Studio",
    purpose: "Gives emulator/device tools for checking the Flutter mobile app.",
    pc: "https://developer.android.com/studio",
    mobile: "Not installed on phone.",
  },
  {
    name: "Flutter SDK",
    purpose: "Builds and tests the mobile app.",
    pc: "https://docs.flutter.dev/get-started/install/windows",
    mobile: "Not installed on phone.",
  },
  {
    name: "Rust",
    purpose: "Builds the Tauri desktop backend.",
    pc: "https://www.rust-lang.org/tools/install",
    mobile: "Not installed on phone.",
  },
];

const setupCommands = [
  {
    title: "Check what is installed",
    command: ".\\scripts\\check-system.ps1",
  },
  {
    title: "Run browser preview",
    command: "cd desktop\\app\nnpm run dev",
  },
  {
    title: "Run full desktop app",
    command: "docker compose up -d postgres\n.\\scripts\\dev-tauri.ps1",
  },
  {
    title: "Run all available tests",
    command: ".\\scripts\\test-all.ps1",
  },
  {
    title: "Run mobile tests only",
    command: "cd mobile\\flutter_app\nflutter test",
  },
];

function SetupPage() {
  return (
    <>
      <section className="documentPanel setupPanel">
        <div className="panelHeader">
          <h3>First-run setup</h3>
          <span>PC, mobile, models, and documentation</span>
        </div>

        <div className="setupSteps">
          <SetupStep number="1" title="Open this repo in Obsidian" text="Use the repository folder as a vault. The obsidian-vault folder contains starter notes for setup, errors, testing, and reusable fixes." />
          <SetupStep number="2" title="Check your system" text="Run scripts/check-system.ps1 to see whether Git, Node, Docker, PostgreSQL, Rust, Flutter, Android tooling, Ollama, llama.cpp, and Piper are available." />
          <SetupStep number="3" title="Install only what is missing" text="Use the official links below. Desktop users need PostgreSQL or Docker; mobile developers need Flutter and Android Studio." />
          <SetupStep number="4" title="Configure model runtime" text="Open Models, set Ollama endpoint and model name first. Add llama.cpp and Piper paths when you want GGUF fallback and desktop TTS." />
          <SetupStep number="5" title="Run tests before changes" text="Use scripts/test-all.ps1 for the normal suite. Add -IncludeRust after Windows stops blocking Rust build executables." />
        </div>
      </section>

      <section className="documentPanel setupPanel">
        <div className="panelHeader">
          <h3>Downloads users need</h3>
          <span>Use official sources</span>
        </div>

        <div className="downloadGrid">
          {setupDownloads.map((item) => (
            <article className="downloadItem" key={item.name}>
              <strong>{item.name}</strong>
              <p>{item.purpose}</p>
              <a href={item.pc} target="_blank" rel="noreferrer">PC download</a>
              <span>{item.mobile}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="documentPanel setupPanel">
        <div className="panelHeader">
          <h3>Commands</h3>
          <span>Run from repo root unless noted</span>
        </div>

        <div className="commandList">
          {setupCommands.map((item) => (
            <article className="commandItem" key={item.title}>
              <strong>{item.title}</strong>
              <pre>{item.command}</pre>
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
    Models: "Manage offline AI models and vector indexes.",
    Setup: "Install tools, check system paths, and open the Obsidian vault.",
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
    Setup: "SU",
    Settings: "ST",
  }[item];
}

export default App;
