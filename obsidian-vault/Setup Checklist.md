# Setup Checklist

Related: [[EchoLearn Home]], [[Testing Notes]], [[Error Log]], [[API Keys]], [[Mobile LLM Plan]]

## Demo User Flow

- [ ] Open the desktop app.
- [ ] Import a PDF, DOCX, EPUB, or text document.
- [ ] Confirm chunks appear in Reader.
- [ ] Click Listen and confirm TTS speaks.
- [ ] Ask an on-topic question.
- [ ] Ask an off-topic question and confirm EchoLearn refuses the topic switch.
- [ ] Set learner age in Settings and ask again.
- [ ] Save chat as PDF.

## Desktop Development Check

- [ ] Run `.\scripts\dev-tauri.ps1`.
- [ ] Configure Ollama or a user-owned API key if AI synthesis is needed.
- [ ] Configure Piper only when higher-quality desktop TTS is needed.
- [ ] Run `npm run check` from `desktop/app`.

## Mobile Development Check

- [ ] Run `flutter doctor`.
- [ ] Run `flutter devices`.
- [ ] Run `flutter test` from `mobile/flutter_app`.
- [ ] Verify Device Preview shows phone and tablet layouts.

## Documentation

- [ ] Save new setup problems in [[Error Log]].
- [ ] Move solved problems into [[Reusable Fixes]].
