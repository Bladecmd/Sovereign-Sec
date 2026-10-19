# Deep Context Handover Protocol

You are taking over development of this project following a migration from Antigravity to Cursor. Before making any code changes, perform a Deep Context & Ground-Truth Audit in 3 steps:

### STEP 1: Read the Active State & Latest Handover Context
1. Read .cursor/PROJECT_CONTEXT.md, .cursor/ACTIVE_TASK.md, and .cursor/ACTIVE_PLAN.md (if they exist).
2. Check the most recent session folder inside .cursor/history/ (sorted by date):
   - Read its walkthrough.md and task.md if present.
   - Read the last ~150 lines of its full_conversation.md to capture the exact final problem, bug, or feature we were working on when the session ended.
   - (Do NOT read older session folders in .cursor/history/ unless you hit a specific architectural question that requires historical context.)

### STEP 2: Verify Against Actual Code on Disk (Truth over Docs)
1. Inspect the project structure, dependency manifests (package.json, requirements.txt, pyproject.toml, .env.example, etc.), and run git status + git log -n 5 --oneline.
2. Cross-reference the checklist in ACTIVE_TASK.md against the actual source code files:
   - Identify if any task marked [ ] is actually already implemented in the code.
   - Identify if any task marked [x] is incomplete, stubbed/mocked, or has broken imports/TODOs.

### STEP 3: Output Your Deep Handover Report (Do Not Edit Files Yet)
Present a structured briefing with:
1. Architecture & Tech Stack: How this project is structured, key entry points, and required environment variables (from .env.example).
2. Where We Left Off (Exact State): What was accomplished in the last Antigravity session and the exact point where work paused.
3. Code vs. Plan Discrepancies: Any mismatches between ACTIVE_TASK.md and the real code on disk, plus any immediate bugs, missing dependencies, or risks you spotted.
4. Top 3 Next Actions: The exact next steps in priority order, specifying which files need to be created or modified first.

Stop after outputting this report and wait for my confirmation on which action to execute first.
