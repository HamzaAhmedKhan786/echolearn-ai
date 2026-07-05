# Testing Notes

Tags: #testing #release

Related: [[EchoLearn Home]], [[Setup Checklist]], [[Error Log]], [[Reusable Fixes]], [[Release Builds]], [[Desktop App]], [[Mobile App]], [[Mobile Native Bridge]]

Main command:

```powershell
.\scripts\test-all.ps1
```

Add Rust when Windows allows it:

```powershell
.\scripts\test-all.ps1 -IncludeRust
```

Manual smoke test:

- [ ] Browser preview opens.
- [ ] TXT/MD import works.
- [ ] Reader shows chunks.
- [ ] Tutor returns cited chunks.
- [ ] Models page saves paths in Tauri mode.
- [ ] Setup page shows downloads and commands.
- [ ] Flutter widget test passes.
