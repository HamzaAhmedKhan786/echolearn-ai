# Theme Settings

Tags: #feature #desktop #mobile #settings

Related:

- [[EchoLearn Home]]
- [[Desktop App]]
- [[Mobile App]]
- [[Local Storage]]

## Purpose

Theme Settings should let users choose how EchoLearn looks on desktop and mobile.

## Recommended Options

- System
- Dark
- Light

## Current State

- Desktop currently shows dark theme only.
- Mobile currently uses Flutter dark theme only.
- A real production setting should save the user's choice locally.

## Implementation Direction

- Desktop: apply a theme attribute and CSS variables.
- Mobile: use Flutter `ThemeMode.system`, `ThemeMode.dark`, and `ThemeMode.light`.
- Store the selection in [[Local Storage]].

## Demo Note

Default should be System because users expect the app to follow the OS or phone theme.
