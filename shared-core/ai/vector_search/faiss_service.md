# FAISS Service

Stores and searches local embeddings.

## Responsibilities

- Create FAISS index
- Add chunk vectors
- Search similar chunks
- Save index locally
- Load index locally
- Delete vectors by document

## Search Input

- Query embedding
- Top K
- Document scope

## Search Output

- Ranked chunks
- Similarity scores

## Rules

- Must respect selected document scope
- Must not search unrelated documents
- Must run offline