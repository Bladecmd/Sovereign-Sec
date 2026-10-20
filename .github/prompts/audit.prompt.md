---
mode: agent
description: Forensic Audit of Project History, Fake Claims, and Code Reality
---
Execute the Forensic Handover & Code Reality Check for this project:

1. **Read Context & History**:
   - Read `.cursor/PROJECT_CONTEXT.md`, `.cursor/ECOSYSTEM_MAP.md`, `.cursor/ACTIVE_TASK.md`, and `.cursor/ACTIVE_PLAN.md` (if present).
   - List all archived sessions inside `.cursor/history/` in a Markdown table (`Session Folder` | `Date` | `Summary`).
   - Open the newest session folder in `.cursor/history/` and read its `walkthrough.md`, `task.md`, and the last ~150 lines of `full_conversation.md`.

2. **Forensic Code vs. Claim Verification**:
   - Assume every `[x]` item in `ACTIVE_TASK.md` is unverified until you check the real source files on disk.
   - Search the codebase for stubbed/mocked functions, hardcoded dummy data, `TODO`/`FIXME`/`pass`, disconnected routes, or missing imports.
   - Check if any LLM calls need to be wired to our Render `openrouter-deepseek` Environment Group (`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `DEEPSEEK_MODEL`).

3. **Update `.cursor/ACTIVE_TASK.md` & Report**:
   - Update `.cursor/ACTIVE_TASK.md` so `[x]` only marks 100% real, working code, and mark any fake/incomplete claims as `[ ] [FIX REQUIRED]`.
   - Output your 4-part **Executive Forensic Report** (1. Verified Real Features, 2. Exposed Fake Claims/Stubs with file:line citations, 3. Unfinished Tasks, 4. Ranked Fix Queue 1-to-N).

**STOP after outputting the report and wait for my approval to execute Fix #1.**
