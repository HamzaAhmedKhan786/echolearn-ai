# API Keys

EchoLearn is local-first, but some users may want to bring personal cloud LLM keys.

## Rule

Never commit real API keys.

Use environment variables or OS secure storage. In development, configure the app with the name of the environment variable, not the key value.

## Suggested Providers

| Provider | Key page | Env var |
| --- | --- | --- |
| OpenAI | https://platform.openai.com/api-keys | `OPENAI_API_KEY` |
| Anthropic Claude | https://console.anthropic.com/ | `ANTHROPIC_API_KEY` |
| Google Gemini | https://ai.google.dev/gemini-api/docs/api-key | `GEMINI_API_KEY` |
| Groq | https://console.groq.com/keys | `GROQ_API_KEY` |
| OpenRouter | https://openrouter.ai/keys | `OPENROUTER_API_KEY` |

Free tiers and free models change often. The app should say "may offer free tier or free models" instead of promising free API usage.

## Desktop Setup

Example for OpenAI-compatible providers:

```powershell
$env:CLOUD_LLM_PROVIDER="openai"
$env:CLOUD_LLM_BASE_URL="https://api.openai.com/v1"
$env:CLOUD_LLM_MODEL="gpt-4.1-mini"
$env:CLOUD_LLM_API_KEY_ENV="OPENAI_API_KEY"
$env:OPENAI_API_KEY="paste-your-key"
```

Run:

```powershell
.\scripts\check-system.ps1
```

The script checks whether the named environment variable exists without printing the secret.

## Mobile Setup

Do not hardcode API keys in a mobile app. For production mobile:

- Store user keys in Android Keystore / iOS Keychain.
- Or route requests through a user-owned backend.
- Or use local mobile models when the model manager is implemented.

For now, the Flutter UI can expose provider choices and bridge smoke tests, while secure mobile key storage is a remaining implementation task.
