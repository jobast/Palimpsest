# Project Memory

This folder keeps a persistent checkpoint of where work stands between chat sessions.

Files:
- `memory/CURRENT_STATE.md`: latest snapshot only.
- `memory/SESSION_HISTORY.md`: append-only timeline.

Commands:
- `npm run memory:init`
- `npm run memory:show`
- `npm run memory:snapshot -- --summary "..." --done "item A|item B" --in-progress "item C" --next "item D|item E" --risks "item F" --notes "optional note"`

Recommended routine:
1. At the end of each major change, run one `memory:snapshot`.
2. At session start, run `npm run memory:show`.
3. If needed, open `memory/SESSION_HISTORY.md` for full context.
