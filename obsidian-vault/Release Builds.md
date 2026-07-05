# Release Builds

Related:

- [[EchoLearn Home]]
- [[Mobile App]]
- [[Setup Checklist]]
- [[Testing Notes]]

Release artifacts are built through GitHub Actions.

## Workflow

Use `.github/workflows/release-artifacts.yml`.

It builds:

- Windows desktop Tauri bundle.
- Android APK and AAB.
- iOS no-codesign app zip on a macOS runner.

## How To Run

Open GitHub Actions, choose `Release artifacts`, and run it manually.

You can also push a tag such as:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

## Notes

- Android artifacts are debug-signed for internal testing unless repository signing secrets are added.
- iOS no-codesign artifacts are for review and CI validation. Real iPhone install or TestFlight needs Apple signing.
- Desktop release builds are handled on GitHub so local Windows Application Control does not block the release path.
