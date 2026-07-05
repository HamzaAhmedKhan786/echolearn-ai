# Ollama Setup

Tags: #ai #setup #desktop

Related:

- [[EchoLearn Home]]
- [[Runtime Setup]]
- [[AI Tutor]]
- [[API Keys]]
- [[Mobile LLM Plan]]

## Purpose

Ollama is the recommended first local LLM runtime for desktop because it is easier for normal users than manual GGUF or llama.cpp setup.

## Product Flow

1. User installs Ollama.
2. User downloads a supported local model.
3. EchoLearn points to the Ollama endpoint.
4. AI Tutor uses the model for topic-focused explanations.

## Suggested Models

- Small local model for lower-end machines.
- Stronger model when the user's PC has enough RAM.
- Cloud API key fallback when local models are not practical.

## Mobile Note

Mobile should not start with heavy local LLM downloads. Use native TTS and user-owned API keys first, then add lightweight mobile model support later.

## Connected Features

- [[AI Tutor]] uses the model.
- [[API Keys]] covers cloud fallback.
- [[Mobile LLM Plan]] explains why phones need a lighter strategy.
