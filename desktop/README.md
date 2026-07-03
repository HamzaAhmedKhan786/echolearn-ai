# EchoLearn AI Desktop

Desktop application for EchoLearn AI.

## Stack

- Tauri
- React
- Rust
- llama.cpp
- FAISS
- Piper TTS
- PostgreSQL for development persistence
- SQLite + SQLCipher reference path for future embedded mode

## Platforms

- Windows
- Linux
- macOS

## Responsibilities

- Desktop UI
- File picker
- Local document reader
- Desktop TTS using Piper
- Native model execution
- Local encrypted storage access
- Packaging and installers

## Development Database

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Run the Tauri app with the default development database URL:

```powershell
.\scripts\dev-tauri.ps1
```
