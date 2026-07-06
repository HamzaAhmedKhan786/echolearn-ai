# EchoLearn AI Android Release Artifacts

Tag: `v0.1.0-local-android`

Files:

- `echolearn-ai-android-release.apk`
- `echolearn-ai-android-release.aab`

These Android artifacts were built locally on Windows.

The APK/AAB are suitable for internal testing. They are debug-signed unless a production Android keystore is configured through:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Windows desktop release is not included here because Windows Application Control blocked the local Tauri/Rust release build.
