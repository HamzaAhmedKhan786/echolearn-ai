# EchoLearn Home

EchoLearn AI is a local-first study app for reading documents aloud and asking topic-focused questions while learning.

## Demo Story

1. Import a PDF, Word, EPUB, or text document.
2. EchoLearn extracts readable text and creates local chunks.
3. The reader can speak the document with built-in TTS or Piper on desktop.
4. The user can ask questions while studying.
5. EchoLearn checks whether the question matches the document topic.
6. If the topic matches, EchoLearn can explain in simpler language for the learner age.
7. If the topic does not match, EchoLearn refuses the topic switch.
8. The chat is saved locally and can be exported as PDF.

## Product Notes

- [[Desktop App]]
- [[Mobile App]]
- [[Document Pipeline]]
- [[Document Upload]]
- [[Text To Speech]]
- [[AI Tutor]]
- [[Chat Export]]
- [[Local Storage]]
- [[Theme Settings]]
- [[Runtime Setup]]
- [[API Keys]]
- [[Mobile LLM Plan]]
- [[Mobile Native Bridge]]
- [[Piper Voice]]
- [[Ollama Setup]]

## Demo And Delivery Notes

- [[Setup Checklist]]
- [[Testing Notes]]
- [[Error Log]]
- [[Reusable Fixes]]
- [[Device Preview]]
- [[Obsidian Usage]]
- [[Release Builds]]

## Current Direction

PostgreSQL is no longer part of the normal user flow. EchoLearn stores the desktop library and runtime settings locally so users can open the app and start studying without Docker, a database server, or developer setup.
