$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopApp = Join-Path $repoRoot "desktop/app"
$tauriTarget = Join-Path $desktopApp "src-tauri/target"

$env:CARGO_TARGET_DIR = $tauriTarget

Push-Location $desktopApp
try {
  npm run tauri:dev
} finally {
  Pop-Location
}
