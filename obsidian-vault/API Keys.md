# API Keys

Tags: #ai #setup #desktop #mobile

Related:

- [[EchoLearn Home]]
- [[Setup Checklist]]
- [[Mobile LLM Plan]]
- [[Reusable Fixes]]
- [[AI Tutor]]
- [[Ollama Setup]]
- [[Mobile Native Bridge]]
- [[Local Storage]]

Never commit real keys.

Use environment variables on desktop:

```powershell
$env:CLOUD_LLM_API_KEY_ENV="OPENAI_API_KEY"
$env:OPENAI_API_KEY="paste-your-key"
```

For production mobile, use Android Keystore or iOS Keychain.
