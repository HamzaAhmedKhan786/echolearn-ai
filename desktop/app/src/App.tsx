import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const navItems = ["Library", "Reader", "AI Tutor", "Flashcards", "Quizzes", "Models", "Settings"];

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
};

type StoredDocument = {
  id: string;
  title: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState("Library");
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState(scopes[0]);
  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
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

    if (!isTextImportable(file)) {
      const message = `Document "${file.name}" is selected. Native parsing for this file type is planned next.`;
      setImportStatus(message);
      setChatMessages([message]);
      return;
    }

    setImportStatus(`Importing "${file.name}"...`);

    try {
      const text = await file.text();
      const result = await importTextDocument(file, text);
      setImportResult(result);
      setImportStatus(
        `Imported ${result.chunk_count} chunks from ${result.character_count.toLocaleString()} characters${result.persisted ? " and saved to PostgreSQL" : ""}.`,
      );
      await refreshDocuments(result);
      setChatMessages([
        `Document "${file.name}" is imported into ${result.chunk_count} local text chunks.`,
        result.persisted
          ? "Saved in PostgreSQL. Embeddings and FAISS indexing are the next backend step."
          : "Preview import only. Set DATABASE_URL in Tauri to persist to PostgreSQL.",
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

  useEffect(() => {
    void refreshDocuments();
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function handleAsk() {
    if (!documentFile) {
      alert("Please upload a document first.");
      return;
    }

    if (!question.trim()) {
      alert("Please enter a question.");
      return;
    }

    setChatMessages((prev) => [
      ...prev,
      `You asked from scope "${scope}": ${question}`,
      "AI answer will be connected after the local RAG pipeline is implemented.",
    ]);

    setQuestion("");
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
            <LibraryList documents={documents} />
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
            importResult={importResult}
            importStatus={importStatus}
            documentSize={documentSize}
            onDrop={handleDrop}
            onUploadClick={handleUploadClick}
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
          <WorkPage
            title="Generate memory cards"
            eyebrow="Study workflow"
            metrics={["Front/back cards", "Difficulty tags", "Review queue"]}
          />
        )}

        {activePage === "Quizzes" && (
          <WorkPage
            title="Create quizzes from selected context"
            eyebrow="Practice mode"
            metrics={["Multiple choice", "Short answer", "Page references"]}
          />
        )}

        {activePage === "Models" && <ModelsPage />}

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
          {documentFile
            ? `Selected document: ${documentFile.name}`
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

        <button className="askBtn" onClick={handleAsk}>
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
          Import notes, books, papers, and lecture files. Read, ask scoped questions,
          and prepare study material without sending documents to the cloud.
        </p>

        <div className="actions">
          <button onClick={onUploadClick}>Start reading</button>
          <button className="ghost">Model manager</button>
        </div>
      </div>

      <div className="heroPanel" aria-hidden="true">
        <div className="docPreview">
          <span />
          <span />
          <span />
          <strong>Grounded answer</strong>
          <p>3 source chunks ready</p>
        </div>
      </div>
    </section>
  );
}

function FeatureCards() {
  return (
    <section className="cards">
      <Feature icon="DOC" title="Document Reader" text="PDF, DOCX, TXT, EPUB, and OCR-ready scanned files." />
      <Feature icon="QA" title="Ask by Scope" text="Answer from a sentence, paragraph, page, chapter, or full document." />
      <Feature icon="ST" title="Study Tools" text="Summaries, flashcards, quizzes, notes, and definitions." />
    </section>
  );
}

function LibraryList({ documents }: { documents: StoredDocument[] }) {
  return (
    <section className="documentPanel libraryList">
      <div className="panelHeader">
        <h3>Saved library</h3>
        <span>{documents.length ? `${documents.length} document${documents.length === 1 ? "" : "s"}` : "PostgreSQL-backed"}</span>
      </div>

      {documents.length ? (
        <div className="documentRows">
          {documents.map((document) => (
            <div className="documentRow" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <p>{document.file_type || "Unknown type"} / {formatFileSize(document.file_size)}</p>
              </div>
              <span>{document.chunk_count} chunks</span>
            </div>
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
          <button>A-</button>
          <button>A+</button>
          <button>Listen</button>
          <button>Bookmark</button>
        </div>
        <article>
          <h3>{documentFile ? documentFile.name : "No document loaded"}</h3>
          <p>
            {importResult
              ? `${importResult.chunk_count} chunks are ready for embeddings, citations, and local Q&A.`
              : "The reader canvas is ready for parsed text, sentence highlighting, page navigation, and local text-to-speech playback."}
          </p>
        </article>
      </section>
    </>
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

function isTextImportable(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return Boolean(
    file.type.startsWith("text/") ||
      ["txt", "md", "markdown", "csv", "json", "html", "xml"].includes(extension ?? ""),
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
      const chunkCount = Math.max(1, Math.ceil(normalized.length / 1400));
      return {
        id: `web-preview-${Date.now()}`,
        name: file.name,
        file_type: file.type || "text/plain",
        file_size: file.size,
        character_count: normalized.length,
        chunk_count: chunkCount,
        persisted: false,
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

function ModelsPage() {
  return (
    <section className="cards modelCards">
      <Feature icon="LLM" title="LLM Model" text="GGUF models will be downloaded and loaded through llama.cpp." />
      <Feature icon="EMB" title="Embedding Model" text="bge-small-en-v1.5 will create local document vectors." />
      <Feature icon="IDX" title="Vector Index" text="FAISS will store searchable document embeddings locally." />
    </section>
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
    Settings: "ST",
  }[item];
}

export default App;
