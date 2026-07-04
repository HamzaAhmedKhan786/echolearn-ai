param(
  [string]$LlamaBinary = $env:LLAMA_CPP_BIN,
  [string]$LlmModel = $env:LLM_MODEL_PATH,
  [string]$OllamaEndpoint = $(if ($env:OLLAMA_ENDPOINT) { $env:OLLAMA_ENDPOINT } else { "http://127.0.0.1:11434" }),
  [string]$OllamaModel = $env:OLLAMA_MODEL,
  [string]$CloudProvider = $(if ($env:CLOUD_LLM_PROVIDER) { $env:CLOUD_LLM_PROVIDER } else { "none" }),
  [string]$CloudModel = $env:CLOUD_LLM_MODEL,
  [string]$CloudApiKeyEnv = $env:CLOUD_LLM_API_KEY_ENV,
  [string]$PiperBinary = $env:PIPER_BIN,
  [string]$PiperVoice = $env:PIPER_VOICE_PATH
)

$ErrorActionPreference = "Continue"

function Test-CommandAvailable {
  param(
    [string]$Name,
    [string]$Command
  )

  $found = & "$env:SystemRoot\System32\where.exe" $Command 2>$null | Select-Object -First 1
  if (-not [string]::IsNullOrWhiteSpace($found)) {
    Write-Host "[OK] ${Name}: $found"
  } else {
    Write-Host "[MISSING] ${Name}: command '$Command' was not found on PATH"
  }
}

function Test-PathValue {
  param(
    [string]$Name,
    [string]$PathValue
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    Write-Host "[MISSING] ${Name}: no path configured"
    return
  }

  if (Test-Path -LiteralPath $PathValue) {
    Write-Host "[OK] ${Name}: $PathValue"
  } else {
    Write-Host "[MISSING] ${Name}: $PathValue"
  }
}

Write-Host "EchoLearn system check"
Write-Host "Run this from the repo root. Missing items are not all required for browser preview."
Write-Host ""

Test-CommandAvailable "Git" "git"
Test-CommandAvailable "Node.js" "node"
Test-CommandAvailable "npm" "npm"
Test-CommandAvailable "Docker" "docker"
Test-CommandAvailable "PostgreSQL psql" "psql"
Test-CommandAvailable "Rust cargo" "cargo"
Test-CommandAvailable "Flutter" "flutter"
Test-CommandAvailable "Android Debug Bridge" "adb"
Test-CommandAvailable "Java" "java"
Test-CommandAvailable "Ollama" "ollama"

Write-Host ""
Write-Host "Common Ollama install paths"
Test-PathValue "Ollama user install" (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe")
Test-PathValue "Ollama machine install" "C:\Program Files\Ollama\ollama.exe"

Write-Host ""
Write-Host "Common Piper install paths"
Test-PathValue "Piper downloaded setup" "C:\Users\DELL\Downloads\setups\piper_windows_amd64\piper\piper.exe"

Write-Host ""
Write-Host "Configured local AI paths"
Write-Host "[INFO] Cloud provider: $CloudProvider"
if ([string]::IsNullOrWhiteSpace($CloudModel)) {
  Write-Host "[MISSING] Cloud model: no model configured"
} else {
  Write-Host "[OK] Cloud model: $CloudModel"
}
if ([string]::IsNullOrWhiteSpace($CloudApiKeyEnv)) {
  Write-Host "[MISSING] Cloud API key env var: no env var name configured"
} elseif ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($CloudApiKeyEnv))) {
  Write-Host "[MISSING] Cloud API key value: env var '$CloudApiKeyEnv' is not set"
} else {
  Write-Host "[OK] Cloud API key value: env var '$CloudApiKeyEnv' is set"
}
Write-Host "[INFO] Ollama endpoint: $OllamaEndpoint"
if ([string]::IsNullOrWhiteSpace($OllamaModel)) {
  Write-Host "[MISSING] Ollama model: no model configured"
} else {
  Write-Host "[OK] Ollama model: $OllamaModel"
}
Test-PathValue "llama.cpp binary" $LlamaBinary
Test-PathValue "GGUF model" $LlmModel
Test-PathValue "Piper binary" $PiperBinary
Test-PathValue "Piper voice" $PiperVoice

Write-Host ""
Write-Host "Useful follow-up commands"
Write-Host "  Browser preview: cd desktop/app; npm run dev"
Write-Host "  Full desktop:    docker compose up -d postgres; ./scripts/dev-tauri.ps1"
Write-Host "  Test suite:      ./scripts/test-all.ps1"
Write-Host "  Mobile devices:  cd mobile/flutter_app; flutter devices"
Write-Host "  Ollama models:   ollama list"
Write-Host "  Pull small LLM:   ollama pull llama3.2:1b"
