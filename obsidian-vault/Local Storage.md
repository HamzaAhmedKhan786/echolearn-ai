# Local Storage

Tags: #feature #desktop #mobile #storage

Related:

- [[EchoLearn Home]]
- [[Desktop App]]
- [[Mobile App]]
- [[Runtime Setup]]
- [[Document Upload]]
- [[Chat Export]]
- [[API Keys]]

## Purpose

Local Storage keeps EchoLearn simple for normal users. They should not need PostgreSQL, Docker, or a developer `.env` file.

## Desktop

- Imported document library is stored locally.
- Runtime paths are stored in local config.
- Vector export can be inspected as JSONL.
- User-owned API key flow should use secure OS storage later.

## Mobile

- Documents, selected document, learner age, and chat messages persist through the native bridge.
- Android uses app preferences for mobile state.
- iOS uses UserDefaults for mobile state.
- API keys use Android Keystore or iOS Keychain.

## Connected Features

- [[Document Upload]] saves imported material.
- [[AI Tutor]] saves chat history.
- [[Theme Settings]] should save the user's theme choice.
- [[Mobile Native Bridge]] provides phone storage methods.
