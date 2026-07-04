param(
  [switch]$IncludeRust,
  [switch]$IncludeAnalyze
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopApp = Join-Path $repoRoot "desktop/app"
$tauriApp = Join-Path $desktopApp "src-tauri"
$mobileApp = Join-Path $repoRoot "mobile/flutter_app"

Write-Host "EchoLearn test runner"

Push-Location $desktopApp
try {
  Write-Host ""
  Write-Host "Desktop frontend: lint, typecheck, build"
  npm run check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Push-Location $mobileApp
try {
  Write-Host ""
  Write-Host "Mobile Flutter tests"
  flutter test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if ($IncludeAnalyze) {
    Write-Host ""
    Write-Host "Mobile Flutter analyze"
    flutter analyze
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} finally {
  Pop-Location
}

if ($IncludeRust) {
  Push-Location $tauriApp
  try {
    Write-Host ""
    Write-Host "Tauri Rust format and check"
    cargo fmt --check
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    cargo check
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} else {
  Write-Host ""
  Write-Host "Skipping Rust compile check. Use -IncludeRust after Windows Application Control allows Rust build executables."
}

Write-Host ""
Write-Host "All requested tests completed."
