# Runtime Setup

Related:

- [[EchoLearn Home]]
- [[Desktop App]]
- [[API Keys]]
- [[Reusable Fixes]]

## Normal User Runtime

EchoLearn should run without PostgreSQL, Docker, or a `.env` file.

- Documents: local app library.
- Settings: local `runtime-config.json`.
- Chat: local browser/app storage.
- Desktop TTS: Windows native voice first, optional Piper.
- Mobile TTS: Android/iOS native voice first.

## AI Runtime Order

1. Local Ollama model.
2. User-owned cloud API key.
3. Optional llama.cpp GGUF fallback.

## Piper Setup

- Binary example: `C:\Users\DELL\Downloads\setups\piper_windows_amd64\piper\piper.exe`
- Voice model: `.onnx`
- Voice config: matching `.onnx.json`
- Desktop validates binary, voice, and config.
- Desktop falls back to Windows native TTS if Piper is not ready.

## Demo Message

Users should hear: import a document, listen, ask focused questions, save chat. They should not hear: install PostgreSQL or run Docker.
