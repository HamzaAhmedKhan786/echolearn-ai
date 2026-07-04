# Document Pipeline

Related:

- [[EchoLearn Home]]
- [[Desktop App]]
- [[Testing Notes]]

Pipeline:

1. User imports document.
2. Browser parser extracts text.
3. Tauri stores document metadata and chunks.
4. Local deterministic embeddings are generated.
5. Retrieval uses vector similarity plus keyword score.
6. Answer synthesis uses Ollama or fallback runtimes.

Remaining:

- OCR for scanned PDFs.
- Stronger embedding model.
- Native FAISS binary index.
