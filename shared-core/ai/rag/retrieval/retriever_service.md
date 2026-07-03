# Retriever Service

Retrieves relevant chunks for local RAG.

## Flow

Question
→ Scope resolver
→ Query embedding
→ FAISS search
→ Metadata filter
→ Ranked chunks

## Supported Scopes

- Current sentence
- Current paragraph
- Current page
- Current chapter
- Selected text
- Whole document
- Multiple documents

## Rules

- Retrieve only from selected scope
- Return empty result if context is not available
- Never retrieve from unrelated documents