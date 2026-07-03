# Database

EchoLearn AI now targets PostgreSQL for document metadata, extracted chunks,
study items, conversations, and model registry state.

Primary migration:

- `migrations/001_initial_postgres.sql`

The older SQLite migration is kept as a reference for embedded/offline storage,
but active desktop development should use PostgreSQL through `DATABASE_URL`.

Vector payloads are not stored directly in PostgreSQL. FAISS owns the vector
index files, while PostgreSQL stores the `vector_id` to `chunk_id` mapping needed
for citations and retrieval.

Default development URL:

```text
postgres://echolearn:echolearn_dev@localhost:5432/echolearn
```

## Migration Order

1. Create `documents` when a file is imported.
2. Insert parsed `chunks` after text extraction and chunking.
3. Insert `embeddings` after the embedding model writes vectors to FAISS.
4. Insert `conversation_messages` during AI Tutor sessions.
5. Insert `study_items` when flashcards, quizzes, or notes are generated.
