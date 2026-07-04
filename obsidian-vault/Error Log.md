# Error Log

Related: [[EchoLearn Home]], [[Setup Checklist]], [[Reusable Fixes]], [[Testing Notes]]

Use this format when something breaks:

```text
Date:
Project:
Command:
Error:
What I tried:
Fix:
Reusable lesson:
```

## Known EchoLearn Errors

### Windows blocks Rust build executable

Command:

```powershell
.\scripts\dev-tauri.ps1
```

Error:

```text
An Application Control policy has blocked this file. (os error 4551)
```

Likely cause:

Windows Application Control, Smart App Control, or Defender policy is blocking generated Rust build scripts inside `desktop/app/src-tauri/target`.

Fix notes:

- Add a Defender exclusion for the repo or Tauri target folder if your Windows edition allows it.
- If Smart App Control or enterprise Application Control is enforcing the block, a normal Defender exclusion may not be enough.
- Browser preview still works with `cd desktop/app; npm run dev`.
