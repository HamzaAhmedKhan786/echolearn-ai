# EchoLearn Setup And Downloads

This guide explains what a developer or user needs on PC and mobile.

## Give Codex A Path

Send paths as plain text like this:

```text
Repo: C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai
PostgreSQL: postgres://USER:PASSWORD@localhost:5432/echolearn
llama.cpp binary: C:\Tools\llama.cpp\llama-cli.exe
GGUF model: D:\Models\mistral-7b-instruct.Q4_K_M.gguf
Ollama endpoint: http://127.0.0.1:11434
Ollama model: llama3.2:1b
Piper binary: C:\Tools\piper\piper.exe
Piper voice: D:\Models\piper\en_US-lessac-medium.onnx
FAISS export directory: C:\Users\DELL\Documents\EchoLearn\faiss
```

If you are unsure whether a path exists, run:

```powershell
Test-Path "C:\path\to\file.exe"
```

## Check What Is Already Installed

From the repo root:

```powershell
.\scripts\check-system.ps1
```

Useful manual checks:

```powershell
git --version
node --version
npm --version
docker --version
psql --version
cargo --version
flutter --version
flutter devices
adb version
java -version
```

## PC Downloads

Use official sources:

| Tool | Needed For | Download |
| --- | --- | --- |
| Obsidian | Project notes, error logs, reusable fixes | https://obsidian.md/download |
| Docker Desktop | Easy local PostgreSQL with docker compose | https://docs.docker.com/desktop/setup/install/windows-install/ |
| PostgreSQL | Database without Docker | https://www.postgresql.org/download/windows/ |
| Rust | Tauri desktop backend | https://www.rust-lang.org/tools/install |
| Flutter | Mobile app development | https://docs.flutter.dev/get-started/install/windows |
| Android Studio | Android emulator/device tools | https://developer.android.com/studio |
| llama.cpp | Local GGUF LLM runtime | https://github.com/ggml-org/llama.cpp/releases |
| Ollama | Easiest local LLM runtime | https://ollama.com/download |
| Piper | Local desktop text-to-speech | https://github.com/rhasspy/piper/releases |

## Mobile Downloads

For normal app users:

- Android: install the app APK when we build a release.
- iPhone: install through TestFlight/App Store when we build a release.
- Obsidian mobile is optional if you want to read the project vault notes on phone.

For mobile developers:

- Install Flutter on PC.
- Install Android Studio on PC.
- Use an Android emulator or connect a phone with USB debugging.
- Run `flutter devices` from `mobile/flutter_app`.

## Local AI Files

EchoLearn does not commit model binaries to Git because they are large.

Recommended first path:

- Install Ollama.
- Pull a small local model:

```powershell
ollama pull llama3.2:1b
ollama list
```

- In EchoLearn Models, set endpoint `http://127.0.0.1:11434` and model `llama3.2:1b`.

Optional llama.cpp path:

- `llama-cli.exe` from llama.cpp releases.
- A `.gguf` chat/instruct model.

Desktop TTS path:

- `piper.exe` from Piper releases.
- A Piper `.onnx` voice model.

After downloading, open EchoLearn `Models` and paste each local path.

## Run Commands

Browser preview:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\desktop\app
npm run dev
```

Full desktop app:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai
docker compose up -d postgres
.\scripts\dev-tauri.ps1
```

Mobile tests:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\mobile\flutter_app
flutter test
```

All available tests:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai
.\scripts\test-all.ps1
```

Rust-inclusive tests after Windows allows Rust build executables:

```powershell
.\scripts\test-all.ps1 -IncludeRust
```
