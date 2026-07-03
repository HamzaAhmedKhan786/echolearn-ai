# Local RAG Pipeline

Document
     ↓
Parser
     ↓
Cleaner
     ↓
Chunker
     ↓
Embedding Model
     ↓
FAISS Index
     ↓
Retriever
     ↓
Ranker
     ↓
Context Builder
     ↓
Prompt Builder
     ↓
llama.cpp
     ↓
Grounding Validator
     ↓
Response Builder

---

# Retrieval Strategy

Top K:
- desktop = 8
- mobile = 5

---

# Chunk Size

sentence:
50 tokens

paragraph:
200 tokens

page:
500 tokens

chapter:
1000 tokens

---

# Grounding Rules

- No hallucinations.
- No external knowledge.
- No internet search.
- Must provide source references.
- Refuse unsupported answers.