param(
  [switch]$IncludeRust
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopApp = Join-Path $repoRoot "desktop/app"
$tauriApp = Join-Path $desktopApp "src-tauri"

Write-Host "Running EchoLearn AI checks..."

Push-Location $desktopApp
try {
  npm run lint
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

if ($IncludeRust -and (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Push-Location $tauriApp
  try {
    cargo check
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} elseif ($IncludeRust) {
  Write-Host "Skipping cargo check because Rust/Cargo is not available on PATH."
} else {
  Write-Host "Skipping cargo check. Run scripts/check.ps1 -IncludeRust to validate Tauri/Rust."
}

Write-Host "All available checks completed."
