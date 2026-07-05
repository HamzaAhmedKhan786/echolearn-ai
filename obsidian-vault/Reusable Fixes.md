# Reusable Fixes

Related: [[EchoLearn Home]], [[Error Log]], [[Setup Checklist]], [[Testing Notes]]

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

## Piper voice config missing

Error:

```text
Piper voice config is missing.
```

Fix:

Place the `.onnx` voice and matching `.onnx.json` file in the same folder. The JSON file name should look like:

```text
voice-name.onnx.json
```

## Topic question refused

Cause:

EchoLearn did not find a strong topic match between the user question and the uploaded document chunks.

Fix:

Ask a question using terms from the document, or import the related document first.
