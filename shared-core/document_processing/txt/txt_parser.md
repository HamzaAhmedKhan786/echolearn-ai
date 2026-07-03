# TXT Parser

The first implemented import path handles plain text-like files from the desktop
UI and sends the readable text to the Tauri command layer.

Supported now:

- `.txt`
- `.md`
- `.markdown`
- `.csv`
- `.json`
- `.html`
- `.xml`

Planned next:

- Native file picker path import
- PDF text extraction
- DOCX paragraph extraction
- EPUB chapter extraction
- OCR fallback for scanned documents

Current chunking behavior:

- normalizes line endings
- trims trailing whitespace
- targets roughly 1,400 characters per chunk
- keeps a 220-character overlap
- prefers sentence or newline boundaries
