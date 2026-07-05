# 🎓 EchoLearn AI

### *Offline AI-Powered Document Reader, Listener & Educational Assistant*

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS%20%7C%20Android%20%7C%20iOS-green)
![AI](https://img.shields.io/badge/AI-Local%20LLM-orange)
![Privacy](https://img.shields.io/badge/Privacy-Offline%20First-success)

---

# Overview

**EchoLearn AI** is a privacy-first, offline-capable educational assistant that transforms documents into an interactive learning experience.

Users can upload educational materials such as PDFs, DOCX files, books, lecture notes, research papers, and study guides, listen to them using natural text-to-speech voices, and interact with a local AI assistant that answers questions strictly based on the uploaded content.

Unlike cloud-based AI assistants, EchoLearn AI runs entirely on the user's device, ensuring:

* Zero API costs
* Complete privacy
* Offline functionality
* Fast document retrieval
* Domain-limited AI responses

---

# Key Features

## 📚 Document Library

* PDF support
* DOCX support
* TXT support
* EPUB support
* Scanned PDF OCR support
* Document organization
* Tags and folders
* Local encrypted storage

---

## 🎧 AI Audio Reader

* Natural text-to-speech
* Adjustable playback speed (0.5x–3x)
* Voice selection
* Background playback
* Pause/resume
* Skip forward/backward
* Sentence highlighting
* Paragraph highlighting
* Bookmark current position

---

## 🤖 Local AI Assistant

* Fully offline AI
* Question answering from uploaded documents
* Multi-document search
* Citation support
* Confidence scoring
* Page references
* Source highlighting
* Conversation history

Example:

> User: "What is reinforcement learning?"

Response:

> According to Chapter 4, reinforcement learning is a machine learning paradigm where agents learn through interaction with an environment and reward feedback. (Page 42)

---

## 🛡 Hallucination Prevention

EchoLearn AI is designed to answer only from user-provided content.

If a question falls outside the available knowledge base, the system responds:

> "This question is outside the scope of the uploaded documents. Please upload additional learning materials."

Methods used:

* Retrieval-Augmented Generation (RAG)
* Similarity thresholding
* Confidence estimation
* Citation validation
* Context verification

---

## ✍ Study Tools

* Notes
* Highlights
* Flashcards
* Quiz generation
* Summaries
* Revision mode
* Bookmarking
* Study statistics
* Progress tracking

---

## 🔒 Privacy First

All processing occurs locally.

No data leaves the device.

Features:

* Offline AI inference
* Local embeddings
* Local vector exports
* Local document storage
* Optional encryption
* Optional biometric authentication

---

# System Architecture

```text
                    User Interface
                           │
                           ▼
                  Document Manager
                           │
                           ▼
                 Document Processing
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
        Text Processing              OCR Engine
             │                           │
             └─────────────┬─────────────┘
                           ▼
                      Chunk Engine
                           │
                           ▼
                    Embedding Model
                           │
                           ▼
                     Vector Database
                           │
                           ▼
                     Retrieval Engine
                           │
                           ▼
                     Local LLM Engine
                           │
                           ▼
                      AI Response
                           │
                           ▼
                      TTS Engine
                           │
                           ▼
                      Audio Output
```

---

# Technology Stack

## Frontend

* Flutter
* Material Design 3
* Riverpod/BLoC

## AI Models

* Llama 3.x
* Qwen
* Gemma
* Phi
* SmolLM

## AI Runtime

* llama.cpp
* MLC LLM
* ONNX Runtime
* GGUF

## Embeddings

* BGE Small
* MiniLM
* E5 Small

## Vector Database

* FAISS
* ChromaDB
* SQLite Vector Extensions

## Text Extraction

* PyMuPDF
* PDFPlumber
* python-docx
* ebooklib
* Tesseract OCR

## Speech

* Android TTS
* iOS AVSpeech
* Piper TTS
* Coqui TTS

## Storage

* Local app storage
* SQLite reference schema for future embedded mode
* Drift
* Hive
* Local encrypted storage

---

# Supported Platforms

| Platform | Status |
| -------- | ------ |
| Windows  | ✅      |
| Linux    | ✅      |
| macOS    | ✅      |
| Android  | ✅      |
| iOS      | ✅      |

---

# AI Models Supported

| Model            | Approximate Size |
| ---------------- | ---------------- |
| Llama 3.2 1B Q4  | 700 MB           |
| Qwen 2.5 1.5B Q4 | 900 MB           |
| Gemma 2B Q4      | 1.2 GB           |
| Phi-3 Mini Q4    | 2 GB             |

---

# Example Workflow

```text
1. Install application
2. Download AI model
3. Import documents
4. Create embeddings locally
5. Start listening
6. Ask questions
7. Generate summaries
8. Create flashcards
9. Review learning progress
```

---

# Local Runtime Setup

Detailed setup, downloads, and testing notes are available in:

* `docs/SETUP_AND_DOWNLOADS.md`
* `docs/TESTING.md`
* `docs/API_KEYS.md`
* `docs/OBSIDIAN.md`
* `obsidian-vault/README.md`

## Desktop preview

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\desktop\app
npm run dev
```

Open `http://localhost:5173/`. This browser preview can import PDF, DOCX, EPUB, TXT, Markdown, CSV, JSON, HTML, and XML files, then chunk and query the current document in memory.

## Full desktop app

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai
.\scripts\dev-tauri.ps1
```

The desktop app stores imported documents, chunks, runtime settings, and vector exports locally. Normal users do not need PostgreSQL, Docker, or a `.env` file.

## Local AI and TTS paths

Suggested local paths live in:

```text
config/runtime-defaults.json
```

Edit that file when you want the app to auto-fill model and TTS paths for your machine. In the app, open `Models` and click `Load suggested paths`.

The important fields are:

* `Ollama endpoint`: normally `http://127.0.0.1:11434`
* `Ollama model`: for example `llama3.2:1b`
* `llama.cpp binary`: optional path to `llama-cli.exe`
* `GGUF LLM model`: optional path to a local `.gguf` model
* `Piper binary`: path to `piper.exe`
* `Piper voice model`: path to a Piper `.onnx` voice
* `FAISS export directory`: folder where EchoLearn writes JSONL vector index exports

EchoLearn creates deterministic 384-dimensional local vectors for imported chunks, exports a FAISS-compatible JSONL file, retrieves by vector similarity plus keyword score, and uses Ollama or llama.cpp for topic-focused synthesis when those paths are configured. Whisper is intentionally not part of this setup.

---

# Future Features

* AI tutor mode
* Interactive quizzes
* Voice conversations
* Collaborative study groups
* Educational agent workflows
* Multi-language support
* Handwritten note recognition
* Classroom mode
* Research assistant mode
* Accessibility enhancements

---

# Mission

> "Make high-quality AI-assisted education accessible to everyone while preserving privacy, ownership, and offline accessibility."

---

# License

MIT License

---

# Author

**Hamza Khan**
Software & AI/ML Engineer
