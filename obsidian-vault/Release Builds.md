# Release Builds

Related:

- [[EchoLearn Home]]
- [[Mobile App]]
- [[Setup Checklist]]
- [[Testing Notes]]
- [[Mobile Native Bridge]]
- [[Local Storage]]

Release artifacts are split between local Windows builds and GitHub Actions.

## Workflow

Use `.github/workflows/release-artifacts.yml`.

It builds:

- Linux desktop Tauri bundle.
- macOS desktop Tauri bundle.
- iOS no-codesign app zip on a macOS runner.

## How To Run

Open GitHub Actions, choose `Release artifacts`, and run it manually.

You can also push a tag such as:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

## Notes

- Android APK/AAB should be built locally on Windows.
- Windows desktop release should be built locally on Windows.
- Android artifacts are debug-signed for internal testing unless a local release keystore is configured.
- iOS no-codesign artifacts are for review and CI validation. Real iPhone install or TestFlight needs Apple signing.
- GitHub Actions is reserved for iOS, macOS, and Linux release artifacts.
