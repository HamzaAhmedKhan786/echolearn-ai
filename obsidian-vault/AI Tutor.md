# AI Tutor

Tags: #ai #feature #desktop #mobile

Related:

- [[EchoLearn Home]]
- [[Document Pipeline]]
- [[API Keys]]
- [[Ollama Setup]]
- [[Mobile Native Bridge]]
- [[Chat Export]]

## Purpose

AI Tutor helps the learner ask questions while reading or listening to an uploaded document.

## Product Behavior

- Answers stay focused on the uploaded document topic.
- If the question has a strong topic match, EchoLearn can explain beyond the exact text to improve understanding.
- If the question changes subject, EchoLearn refuses the topic switch.
- Responses should adapt to the learner age when provided.
- Chats are saved locally and can be exported for study records.

## Scope Rule

EchoLearn should say:

> This question is not related to the document you uploaded. I can only answer from the current document so you can stay focused on this subject.

When the topic matches, EchoLearn can simplify, rephrase, and add supporting explanation.

## Connected Features

- [[Document Upload]] provides the source material.
- [[Local Storage]] saves document chunks and chat history.
- [[Ollama Setup]] supports local AI.
- [[API Keys]] supports user-owned cloud AI.
- [[Chat Export]] turns useful answers into a PDF study record.
