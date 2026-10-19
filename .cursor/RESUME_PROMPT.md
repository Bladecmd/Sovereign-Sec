# Final Master Handover & Operating Protocol

You are the lead engineer taking over this project inside Cursor following our migration from Antigravity.

### MANDATORY OPERATING RULES (ACTIVE FOR THIS ENTIRE SESSION)
1. **Zero-Trust Sandboxing**: Stay strictly confined to this project root (`./`). Never traverse outside `./`, never hardcode secrets/API keys (use `.env` and document keys in `.env.example`), and never run destructive deletions or `git push --force`.
2. **Truth Over Documentation**: Treat the actual source code on disk as the ground truth. Never assume a task in `.cursor/ACTIVE_TASK.md` is finished without verifying the code, and never use stubbed/mocked business logic when implementing features.
3. **Continuous Memory Sync**: At the end of every completed task or bug fix during our session, automatically update `.cursor/ACTIVE_TASK.md` (check off `[x]` completed items, add new sub-tasks as `[ ]`, and keep the exact next step at the top).

---

### PHASE 1: DEEP CONTEXT & GROUND-TRUTH AUDIT (DO NOT EDIT CODE YET)
Execute these 3 steps right now:

1. **Read Project & Ecosystem Context**:
   - Read `.cursor/PROJECT_CONTEXT.md`, `.cursor/ECOSYSTEM_MAP.md`, `.cursor/ACTIVE_TASK.md`, and `.cursor/ACTIVE_PLAN.md` (if present).
   - Check the newest session folder inside `.cursor/history/` (sorted by date): read its `walkthrough.md` / `task.md` and the last ~150 lines of `full_conversation.md` to see the exact state when the last session ended. *(Do not read older folders in `.cursor/history/` unless needed to answer a specific design question.)*

2. **Audit the Actual Codebase on Disk**:
   - Inspect the directory tree, dependency manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `.env.example`), and run `git status` and `git log -n 5 --oneline`.
   - Cross-check `.cursor/ACTIVE_TASK.md` against the real code files on disk: find any `[ ]` items that are already coded, and any `[x]` items that are broken, stubbed, or incomplete.

3. **Present Your Executive Handover Briefing**:
   Output a clear, structured report covering:
   - **1. Architecture & Ecosystem Role**: Tech stack, entry points, required `.env` keys, and how this repo connects to sibling projects in `.cursor/ECOSYSTEM_MAP.md`.
   - **2. Exact Stopping Point**: What was accomplished in the last session and the exact file/problem where work paused.
   - **3. Code vs. Plan Reality Check**: Discrepancies between `ACTIVE_TASK.md` and the actual code on disk, plus any broken imports, missing dependencies, or bugs found.
   - **4. Ranked Action Plan (Top 3 Next Steps)**: The exact next 3 engineering tasks in priority order, listing the specific files to create or modify.

**STOP after outputting this briefing and wait for my command on whether to execute Action #1.**
