# Grounding Validator

Checks whether the AI answer is supported by retrieved context.

## Responsibilities

- Validate answer against context
- Detect unsupported claims
- Enforce refusal
- Attach source references
- Return confidence score

## Refusal Message

I cannot answer this question from the selected document scope.

## Rules

- No external knowledge
- No hallucinated answers
- No fake citations
- Refuse when context is insufficient