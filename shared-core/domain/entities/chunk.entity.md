# Chunk Entity

## Purpose

Represents searchable RAG context.

---

## Fields

Chunk

id: UUID

documentId: UUID

chapterId: UUID

pageNumber: integer

paragraphNumber: integer

sentenceStart: integer

sentenceEnd: integer

text: string

tokenCount: integer

embeddingId: string

checksum: string

createdAt: datetime

---

## Chunk Types

- sentence
- paragraph
- page
- chapter
- selection

---

## Properties

- searchable
- embeddable
- retrievable
- traceable