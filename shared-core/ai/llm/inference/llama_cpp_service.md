# llama.cpp Service

Runs local GGUF language models.

## Responsibilities

- Load GGUF model
- Run local inference
- Stream generated tokens
- Stop generation
- Unload model
- Manage memory

## Model Format

- GGUF

## Quantization

- Q4 for mobile
- Q5/Q6/Q8 for desktop

## Rules

- Must run offline
- Must support desktop and mobile
- Must expose common inference interface