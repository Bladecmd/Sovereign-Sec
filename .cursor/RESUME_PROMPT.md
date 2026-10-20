# Final Master Handover & Operating Protocol

You are the lead engineer taking over this project inside Cursor following our migration from Antigravity.

### MANDATORY OPERATING RULES (ACTIVE FOR THIS ENTIRE SESSION)
1. **Zero-Trust Sandboxing**: Stay strictly confined to this project root (`./`). Never traverse outside `./`, never hardcode secrets/API keys, and never run destructive deletions or `git push --force`.
2. **Render + OpenRouter + DeepSeek**: All live LLM keys live in Render's **`openrouter-deepseek`** Environment Group (`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`, `DEEPSEEK_MODEL=deepseek/deepseek-chat`, `DEEPSEEK_REASONER_MODEL=deepseek/deepseek-r1`). Always read these from the environment.
3. **Truth Over Documentation**: Treat the actual source code on disk as ground truth. Never assume a task in `.cursor/ACTIVE_TASK.md` is finished without verifying the code, and never use stubbed/mocked business logic.
4. **Continuous Memory Sync**: At the end of every completed task or bug fix, automatically update `.cursor/ACTIVE_TASK.md` (mark finished items `[x]`, add new sub-tasks as `[ ]`, and keep the exact next step at the top).

---

### PHASE 1: DEEP CONTEXT & GROUND-TRUTH AUDIT (DO NOT EDIT CODE YET)
Execute these 3 steps right now:

1. **Read Project & Ecosystem Context**:
   - Read `.cursor/PROJECT_CONTEXT.md`, `.cursor/ECOSYSTEM_MAP.md`, `.cursor/ACTIVE_TASK.md`, and `.cursor/ACTIVE_PLAN.md` (if present).
   - Check the newest session folder inside `.cursor/history/` (sorted by date): read its `walkthrough.md` / `task.md` and the last ~150 lines of `full_conversation.md` to see the exact state when the last session ended. *(Do not read older folders in `.cursor/history/` unless needed for a specific design question.)*

2. **Audit the Actual Codebase on Disk**:
   - Inspect the directory tree, dependency manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `render.yaml`, `.env.example`), and run `git status` and `git log -n 5 --oneline`.
   - Cross-check `.cursor/ACTIVE_TASK.md` against the real code files on disk: find any `[ ]` items that are already coded, and any `[x]` items that are broken, stubbed, or incomplete.
   - Check if any existing LLM/AI calls in the codebase need to be pointed to OpenRouter + DeepSeek (`OPENROUTER_API_KEY` / `DEEPSEEK_MODEL`).

3. **Present Your Executive Handover Briefing**:
   Output a clear, structured report covering:
   - **1. Architecture, Render & Ecosystem Role**: Tech stack, entry points, OpenRouter/DeepSeek integration status, and how this repo connects to sibling projects in `.cursor/ECOSYSTEM_MAP.md`.
   - **2. Exact Stopping Point**: What was accomplished in the last session and the exact file/problem where work paused.
   - **3. Code vs. Plan Reality Check**: Discrepancies between `ACTIVE_TASK.md` and the actual code on disk, plus any broken imports, missing dependencies, or bugs found.
   - **4. Ranked Action Plan (Top 3 Next Steps)**: The exact next 3 engineering tasks in priority order, listing the specific files to create or modify.

**STOP after outputting this briefing and wait for my command on whether to execute Action #1.**
