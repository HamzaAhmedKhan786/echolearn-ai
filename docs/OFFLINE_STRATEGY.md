# Offline Strategy

---

# Philosophy

Everything works offline.

Cloud is optional.

---

# Offline Components

✓ Reader
✓ TTS
✓ AI
✓ RAG
✓ Search
✓ Notes
✓ Flashcards
✓ Quizzes

---

# Download Phase

Internet required only for:

- Model download
- Updates
- Optional sync

---

# Local Storage

PostgreSQL for development persistence, with an embedded SQLite path kept as a future offline packaging option
SQLCipher
FAISS
Cache

---

# Local AI

llama.cpp
GGUF

---

# Local Speech

Desktop:
- Piper

Android:
- Native TTS

iOS:
- AVSpeech

---

# Synchronization

Future:

Device
    ↓
Encrypted Package
    ↓
Cloud
    ↓
Device
