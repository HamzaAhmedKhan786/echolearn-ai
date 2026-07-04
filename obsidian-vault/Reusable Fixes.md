# Reusable Fixes

## Docker Desktop pipe missing

Error:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

Fix:

Start Docker Desktop, wait until it says the engine is running, then rerun:

```powershell
docker compose up -d postgres
```

## Tauri app exe access denied

Error:

```text
failed to remove file ... app.exe
Access is denied. (os error 5)
```

Fix:

Close the running Tauri window and stop any stale `cargo` or `app.exe` process, then rerun:

```powershell
.\scripts\dev-tauri.ps1
```
