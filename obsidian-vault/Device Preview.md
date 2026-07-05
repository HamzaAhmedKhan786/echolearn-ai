# Device Preview

Tags: #mobile #testing

Related:

- [[EchoLearn Home]]
- [[Mobile App]]
- [[Testing Notes]]
- [[Mobile Native Bridge]]

Device Preview is enabled in Flutter.

Run:

```powershell
cd C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\mobile\flutter_app
& "C:\Development\flutter\bin\flutter.bat" run -d windows
```

The Windows Flutter app should show Device Preview controls, including device/frame selection.

If clicking Import/Speak/Ask shows `MissingPluginException`, the Windows runner is missing the `echolearn.ai/native` MethodChannel handler. The current runner includes a Windows handler for preview smoke tests.
