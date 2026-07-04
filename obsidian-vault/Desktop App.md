# Desktop App

Related:

- [[EchoLearn Home]]
- [[Runtime Setup]]
- [[API Keys]]
- [[Testing Notes]]
- [[Document Pipeline]]

The desktop app uses React/Vite for the interface and Tauri/Rust for local commands.

Main flows:

- Import PDF, DOCX, EPUB, TXT, and web text.
- Persist documents and chunks in PostgreSQL.
- Create local embeddings and vector exports.
- Ask grounded questions through Ollama first, then optional llama.cpp fallback.
- Generate Piper WAV files for desktop TTS when Piper paths are configured.
- Fall back to Windows native TTS when Piper is missing.
