# Shared Core

The Shared Core contains all business logic, AI logic, document processing, storage abstractions, security abstractions, and model management for EchoLearn AI.

The goal is to maximize code reuse between:

- Desktop (Tauri + React)
- Mobile (Flutter)
- Future cloud synchronization

---

# Architectural Principles

- Clean Architecture
- Domain Driven Design (DDD)
- SOLID
- Repository Pattern
- Dependency Inversion
- Offline First
- Privacy First

---

# Layer Structure

Presentation Layer
        ↓
Application Layer
        ↓
Domain Layer
        ↓
Infrastructure Layer
        ↓
AI Layer
        ↓
Storage Layer

---

# Modules

domain/
application/
infrastructure/
ai/
document_processing/
speech/
security/
model_manager/
storage/
tests/

---

# Rules

- No UI framework dependencies
- No React dependencies
- No Flutter dependencies
- No platform APIs
- No cloud dependencies
- AI code must be reusable
- Business logic must be reusable