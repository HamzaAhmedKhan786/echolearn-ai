$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopApp = Join-Path $repoRoot "desktop/app"

Push-Location $desktopApp
try {
  npm run dev
} finally {
  Pop-Location
}
