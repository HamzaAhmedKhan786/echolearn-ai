# Application Layer

The Application layer implements business use cases.

It orchestrates:

- Domain entities
- AI services
- Storage
- Security
- Speech
- Model management

---

# Use Cases

Document:

- ImportDocument
- DeleteDocument
- UpdateDocument

AI:

- AskQuestion
- GenerateSummary
- GenerateNotes

Study:

- GenerateQuiz
- GenerateFlashcards

Audio:

- Play
- Pause
- Seek

Model:

- DownloadModel
- UpdateModel
- VerifyModel

---

# Rules

Application layer:

- knows domain
- knows interfaces
- never knows implementation