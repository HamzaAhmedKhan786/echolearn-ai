# Desktop App

Related:

- [[EchoLearn Home]]
- [[Runtime Setup]]
- [[Document Pipeline]]
- [[Document Upload]]
- [[Text To Speech]]
- [[AI Tutor]]
- [[Chat Export]]
- [[Local Storage]]
- [[Theme Settings]]
- [[Piper Voice]]
- [[Ollama Setup]]
- [[Testing Notes]]

The desktop app uses React/Vite for the interface and Tauri/Rust for local commands.

## User Flow

- Import PDF, DOCX, EPUB, TXT, Markdown, CSV, JSON, HTML, or XML.
- Save imported documents and chunks in the local app library.
- Read chunks in the reader.
- Listen with Windows native TTS or optional Piper.
- Ask topic-focused questions from the uploaded document.
- Set learner age so explanations can be simpler or more advanced.
- Save the chat locally and export it through the print-to-PDF flow.

## Storage

- Normal users do not need PostgreSQL.
- Desktop library files are stored locally under the EchoLearn app data folder.
- Runtime paths are stored locally in `runtime-config.json`.
- Vector exports are JSONL files for inspection and future indexing.

## Remaining Desktop Work

- Add full TTS playback controls: play, pause, resume, stop, speed.
- Add a polished local document library view with delete/rename.
- Add secure API key storage instead of environment variable names only.
- Add installer packaging.
- Add real [[Theme Settings]] toggle for System, Dark, and Light.
