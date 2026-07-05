# Document Pipeline

Related:

- [[EchoLearn Home]]
- [[Desktop App]]
- [[Document Upload]]
- [[AI Tutor]]
- [[Text To Speech]]
- [[Local Storage]]
- [[Chat Export]]
- [[Testing Notes]]

## Pipeline

1. User imports a document.
2. Parser extracts text from PDF, DOCX, EPUB, or plain text formats.
3. Text is normalized and split into local chunks.
4. Chunks are saved in the local library.
5. Topic matching scores the user question against chunks.
6. If the question matches the document topic, EchoLearn answers and may add helpful explanation.
7. If the question does not match, EchoLearn refuses the topic switch.
8. Chat history is saved locally and can be exported as PDF.

## Current Retrieval

- Deterministic 384-dimensional local vectors.
- Keyword overlap scoring.
- JSONL vector export for inspection and future indexing.

## Remaining

- OCR for scanned PDFs.
- Stronger embedding model.
- Native vector index.
- Page-level citations.
