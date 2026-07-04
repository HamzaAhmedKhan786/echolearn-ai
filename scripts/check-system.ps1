param(
  [string]$LlamaBinary = $env:LLAMA_CPP_BIN,
  [string]$LlmModel = $env:LLM_MODEL_PATH,
  [string]$PiperBinary = $env:PIPER_BIN,
  [string]$PiperVoice = $env:PIPER_VOICE_PATH
)

$ErrorActionPreference = "Continue"

function Test-CommandAvailable {
  param(
    [string]$Name,
    [string]$Command
  )

  $found = Get-Command $Command -ErrorAction SilentlyContinue
  if ($found) {
    Write-Host "[OK] ${Name}: $($found.Source)"
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

Write-Host ""
Write-Host "Configured local AI paths"
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
