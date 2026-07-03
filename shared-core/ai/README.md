# AI Layer

The AI layer contains all local AI functionality.

---

# Components

rag/
llm/
embeddings/
vector_search/
chunking/
study/

---

# Pipeline

Document
     ↓
Parser
     ↓
Chunker
     ↓
Embedding
     ↓
FAISS
     ↓
Retriever
     ↓
Context Builder
     ↓
Prompt Builder
     ↓
LLM
     ↓
Grounding Validator
     ↓
Response

---

# Supported Models

LLM:

- Qwen
- Llama
- Mistral

Embeddings:

- bge-small-en-v1.5

Runtime:

- llama.cpp

Vector DB:

- FAISS

---

# Rules

- No cloud APIs
- No OpenAI dependency
- Fully offline
- Context grounded answers only