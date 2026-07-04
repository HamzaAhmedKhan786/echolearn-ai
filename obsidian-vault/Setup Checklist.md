# Setup Checklist

## PC

- [ ] Run `.\scripts\check-system.ps1`.
- [ ] Install missing tools from `docs/SETUP_AND_DOWNLOADS.md`.
- [ ] Start Docker Desktop or configure local PostgreSQL.
- [ ] Run `docker compose up -d postgres`.
- [ ] Run `.\scripts\dev-tauri.ps1`.
- [ ] Configure llama.cpp and Piper paths in the app Models page.

## Mobile

- [ ] Install Flutter on PC.
- [ ] Install Android Studio on PC.
- [ ] Run `flutter doctor`.
- [ ] Run `flutter devices`.
- [ ] Run `flutter test` from `mobile/flutter_app`.

## Documentation

- [ ] Save new setup problems in [[Error Log]].
- [ ] Move solved problems into [[Reusable Fixes]].
