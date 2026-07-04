# Obsidian Setup

Your screenshot shows the repo root opened as the Obsidian vault. That works, but it makes the graph noisy because Obsidian sees every markdown file in the codebase as a note.

## Recommended

Open this folder as the vault instead:

```text
C:\Users\DELL\Documents\Projects\Gen-AI\echolearn-ai\obsidian-vault
```

This gives a focused project-knowledge vault with only:

- Setup checklist
- Error log
- Testing notes
- Reusable fixes
- Project home/map notes

## Why The Graph Looks Sparse

Obsidian graph view only connects notes that contain wiki links like:

```markdown
[[Setup Checklist]]
```

Many repo docs are normal Markdown files without many `[[wiki links]]`, so the graph shows many isolated dots.

## How We Handle It

- Use `obsidian-vault` for curated project memory.
- Keep repo docs in `docs/` for GitHub-readable documentation.
- Add wiki links between vault notes when a note should appear connected in graph view.
- Do not commit `.obsidian/workspace.json` unless you want to share local layout state.
