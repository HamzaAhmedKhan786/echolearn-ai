param(
  [switch]$SkipInstall,
  [switch]$IncludeRust
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopApp = Join-Path $repoRoot "desktop/app"

Write-Host "EchoLearn AI development setup"
Write-Host "Repository: $repoRoot"

if (-not (Test-Path $desktopApp)) {
  throw "Desktop app folder was not found at $desktopApp"
}

Push-Location $desktopApp
try {
  if ($SkipInstall) {
    Write-Host "Skipping npm install because -SkipInstall was provided."
  } else {
    Write-Host "Installing desktop dependencies..."
    npm install
  }

  Write-Host "Running validation..."
  npm run check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

if ($IncludeRust) {
  & (Join-Path $PSScriptRoot "check.ps1") -IncludeRust
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Setup complete."
