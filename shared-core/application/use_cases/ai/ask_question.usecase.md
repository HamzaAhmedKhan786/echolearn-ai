# Ask Question Use Case

## Input

question

scope:

- sentence
- paragraph
- page
- chapter
- selection
- document
- multi_document

selectedDocuments

selectedText

---

## Flow

User
    ↓
Validate Question
    ↓
Validate Scope
    ↓
Retrieve Chunks
    ↓
Build Context
    ↓
Build Prompt
    ↓
Run LLM
    ↓
Validate Grounding
    ↓
Return Response

---

## Rules

- Must answer only from selected scope.
- Must refuse unsupported context.
- Must cite source chunks.
- Must return confidence score.