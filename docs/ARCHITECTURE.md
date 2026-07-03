# EchoLearn AI Architecture

---

# Architectural Principles

- Clean Architecture
- Domain Driven Design
- SOLID
- Repository Pattern
- Event Driven
- Offline First

---

# High Level Architecture

User
    ↓
UI
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
    ↓
AI Layer
    ↓
Storage

---

# Components

## Desktop

React
    ↓
Tauri
    ↓
Rust Bridge
    ↓
Shared Core

---

## Mobile

Flutter
    ↓
Riverpod
    ↓
Native Bridge
    ↓
Shared Core

---

## AI

Document Parser
    ↓
Chunker
    ↓
Embeddings
    ↓
FAISS
    ↓
Retriever
    ↓
Prompt Builder
    ↓
LLM
    ↓
Validator

---

# Database

PostgreSQL
SQLCipher
FAISS
Local Cache
