# Mobile App

Related:

- [[EchoLearn Home]]
- [[Mobile LLM Plan]]
- [[Device Preview]]
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

## Remaining Mobile Work

- Real document picker and parser.
- Persistent mobile storage for documents/chats/settings.
- Secure key storage.
- Real mobile Q&A bridge connected to native chunks and provider settings.
- Play/pause/speed controls for native TTS.
- Voice wake phrase / microphone question flow.
