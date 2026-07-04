# EchoLearn Testing

## Main Test Command

Run from the repo root:

```powershell
.\scripts\test-all.ps1
```

This runs:

- Desktop lint and production build through `npm run check`.
- Flutter widget tests through `flutter test`.

Rust compile checks are optional because Windows Application Control can block generated Rust build executables on some machines:

```powershell
.\scripts\test-all.ps1 -IncludeRust
```

Flutter analyzer is optional because it can be slow in this environment:

```powershell
.\scripts\test-all.ps1 -IncludeAnalyze
```

## What To Test Next

Add tests in this order:

1. Document parsing tests for TXT/Markdown and mocked PDF/DOCX/EPUB extraction.
2. Chunking and study item generation tests.
3. React UI tests for Library, Reader, Models, and Setup pages.
4. Rust unit tests for chunking, embeddings, retrieval scoring, and path validation.
5. Integration tests with PostgreSQL for import, chunk load, embeddings, and Q&A.
6. Flutter widget tests for Library, Reader, Tutor, Study, and Settings screens.
7. Android/iOS native bridge smoke tests once CI runners are available.

## Manual Smoke Test

1. Start browser preview with `npm run dev`.
2. Open `http://localhost:5173/`.
3. Import a small `.txt` or `.md` file.
4. Confirm chunks appear in Reader.
5. Ask a question from the AI Tutor panel.
6. Open Models and confirm runtime path fields render.
7. Open Setup and confirm download links and commands render.
8. For mobile Windows preview, run `flutter run -d windows` and use Device Preview to switch device frames.
9. Click Import, Speak, and Ask to confirm the Windows MethodChannel bridge responds without `MissingPluginException`.

## Full Desktop Smoke Test

1. Start PostgreSQL.
2. Run `.\scripts\dev-tauri.ps1`.
3. Import a document.
4. Confirm it appears in Saved library.
5. Open the saved document.
6. Ask a grounded question.
7. Rebuild vector index from Models.
8. Configure Ollama model name and test grounded synthesis.
9. Configure Piper and test Listen.
10. Optionally configure llama.cpp and test GGUF fallback.
