---
mode: agent
description: Execute the #1 priority fix/task in ACTIVE_TASK.md with zero mocks
---
Read `.cursor/ACTIVE_TASK.md` and execute the #1 top-priority unfinished `[ ]` task or `[FIX REQUIRED]` item:

1. **Zero Mocks / Production Code Only**: Write complete, production-ready code. Never use hardcoded dummy data, fake delays, or `TODO` placeholders.
2. **Verify & Test**: Check imports, syntax, and run relevant verification/build/test commands in the terminal to prove it works.
3. **Update Memory**: Once verified working, mark the item `[x]` in `.cursor/ACTIVE_TASK.md` and state the next item in the queue.
