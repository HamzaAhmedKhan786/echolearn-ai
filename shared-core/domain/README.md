# Domain Layer

The Domain layer contains the core business entities and business rules.

This layer must remain independent of:

- Databases
- UI frameworks
- AI runtimes
- Storage systems
- Cloud services

---

# Components

entities/
aggregates/
value_objects/
repositories/
events/
services/

---

# Primary Entities

- Document
- Chunk
- StudyItem
- Note
- Bookmark
- Flashcard
- Quiz
- UserSettings

---

# Responsibilities

- Business rules
- Validation
- State transitions
- Domain events
- Entity relationships