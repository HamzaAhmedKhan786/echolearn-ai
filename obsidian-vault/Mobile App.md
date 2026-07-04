# Mobile App

Related:

- [[EchoLearn Home]]
- [[Mobile LLM Plan]]
- [[Device Preview]]
- [[Testing Notes]]

The mobile app is Flutter.

Current status:

- Bottom navigation shell is built.
- Android/iOS native bridge is connected for import, TTS, and Q&A smoke tests.
- Windows native bridge is connected for preview smoke tests.
- Native TTS uses Android TextToSpeech and iOS AVSpeech.
- Windows preview uses a simple bridge response and system beep, not real mobile TTS.
- Device Preview is enabled for Windows development.

Remaining:

- Real mobile document picker/parser.
- Secure API key storage.
- Mobile model manager for small on-device models.
