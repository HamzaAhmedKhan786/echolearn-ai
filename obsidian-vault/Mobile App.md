# Mobile App

Related:

- [[EchoLearn Home]]
- [[Mobile LLM Plan]]
- [[Device Preview]]
- [[Mobile Native Bridge]]
- [[Text To Speech]]
- [[Document Upload]]
- [[AI Tutor]]
- [[Local Storage]]
- [[Theme Settings]]
- [[Testing Notes]]

The mobile app is Flutter with Device Preview enabled for Windows development.

## Product Flow

- Import a document.
- Read and listen with built-in Android/iOS TTS.
- Ask topic-focused questions.
- Save chat history locally.
- Use user-owned API keys or future lightweight on-device models.

## Current Status

- Bottom navigation shell is built.
- Product-facing guide is in place.
- Android/iOS/Windows bridge contract exists.
- Native TTS bridge path exists.
- Mobile preview now keeps imported documents, selected document, learner age, and chat messages in app state.
- Mobile tutor has a local topic-match fallback when the native bridge is unavailable.
- Mobile study page generates simple review prompts from selected chunks.
- Device Preview is enabled.
- Android document import opens the native document picker for readable text files and chunks the imported text.
- Android secure API key storage uses Android Keystore-backed encrypted preferences.
- iOS document import uses UIDocumentPicker for readable text files and chunks the imported text.
- iOS secure API key storage uses Keychain.
- Mobile state can persist through the native bridge on Android/iOS.
- Reader includes native TTS speed and stop controls.
- Microphone and speech-recognition permission metadata is present for the later voice-question flow.

## Remaining Mobile Work

- Binary PDF/DOCX/EPUB parsing on phones. Current native mobile picker reads text-style files; richer formats need mobile parser packages or a shared extraction service.
- Real hosted/mobile LLM provider call from saved API keys.
- Voice wake phrase / microphone question flow.
- Phone-device QA for Android and iOS, especially file providers, storage persistence, and TTS rates.
- App store packaging, signing, icons, and release builds.
- Real [[Theme Settings]] toggle for System, Dark, and Light.
