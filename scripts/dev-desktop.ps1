$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopApp = Join-Path $repoRoot "desktop/app"

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgres://echolearn:echolearn_dev@localhost:5432/echolearn"
}

Push-Location $desktopApp
try {
  npm run dev
} finally {
  Pop-Location
}
