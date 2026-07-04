# Runtime Setup

Related:

- [[EchoLearn Home]]
- [[Desktop App]]
- [[API Keys]]
- [[Reusable Fixes]]

Preferred LLM order:

1. Ollama local server.
2. User-owned cloud API key.
3. Optional llama.cpp GGUF fallback.

Piper setup:

- Binary: `C:\Users\DELL\Downloads\setups\piper_windows_amd64\piper\piper.exe`
- Voice model: still needed.
- Voice config JSON: still needed.
- Desktop validates binary, `.onnx`, and `.onnx.json`.
- Desktop falls back to Windows native TTS if Piper is not ready.
- Mobile uses native Android/iOS TTS first.

PostgreSQL:

- Docker PostgreSQL can be used even if `psql` is not on PATH.
