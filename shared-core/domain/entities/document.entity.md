# Document Entity

## Purpose

Represents a user imported document.

---

## Fields

Document

id: UUID

title: string

path: string

type:
- pdf
- docx
- txt
- epub
- scanned

language: string

pageCount: integer

chapterCount: integer

paragraphCount: integer

sentenceCount: integer

createdAt: datetime

updatedAt: datetime

indexed: boolean

encrypted: boolean

checksum: string

---

## Relations

Document

contains:

- Pages
- Chapters
- Paragraphs
- Sentences
- Chunks
- Notes
- Bookmarks
- Flashcards
- Quizzes