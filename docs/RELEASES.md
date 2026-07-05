# Release Builds

EchoLearn release artifacts are built by GitHub Actions in `.github/workflows/release-artifacts.yml`.

## Build From GitHub

1. Push changes to `main`.
2. Open GitHub Actions.
3. Run `Release artifacts` manually, or push a version tag such as `v0.1.0`.
4. Download artifacts from the workflow run:
   - `echolearn-desktop-windows`
   - `echolearn-android`
   - `echolearn-ios-no-codesign`

## Android Signing

Without signing secrets, Android artifacts are test-signed with the debug key. That is fine for internal testing, but not for Play Store distribution.

For production signing, add these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

`ANDROID_KEYSTORE_BASE64` should be the base64 text of the upload keystore file.

## iOS Artifact

The workflow builds iOS on a macOS runner with:

```bash
flutter build ios --release --no-codesign
```

This creates a no-codesign app artifact for review and CI validation. Installing on real iPhones or distributing through TestFlight still requires an Apple Developer account, signing certificate, provisioning profile, and an archive/export step.

## Local Build Commands

Desktop Windows:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\desktop\app
npm run tauri:build
```

Android:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\mobile\flutter_app
& "C:\Development\flutter\bin\flutter.bat" build apk --release
& "C:\Development\flutter\bin\flutter.bat" build appbundle --release
```
