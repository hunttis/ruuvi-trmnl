# Git Commit Rules - READ BEFORE EVERY COMMIT

## CRITICAL: Commit Message Format

**ALWAYS USE SINGLE-LINE COMMIT MESSAGES**

```bash
git commit -m "Single line description of changes"
```

### ❌ NEVER DO THIS:

```bash
git commit -m "Title

- Bullet point 1
- Bullet point 2
- Bullet point 3"
```

### ✅ ALWAYS DO THIS:

```bash
git commit -m "Brief description of what changed"
```

## Examples

Good:

- `git commit -m "Add temperature caching system"`
- `git commit -m "Fix RuuviTag scanning initialization"`
- `git commit -m "Update templates with stale detection logic"`

Bad:

- Multi-line commit messages with bullets
- Commit messages with newlines
- Detailed explanations in commit message

## Remember

The user wants **SINGLE ROW COMMIT MESSAGES ONLY**.
