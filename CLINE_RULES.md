GLOBAL INSTRUCTION FOR AI AGENTS (CLINE)

This file overrides all prompts unless explicitly ignored.

────────────────────────────
UI LOCK MODE (STRICT)
────────────────────────────

- Do NOT modify HTML structure unless explicitly required for bug fixing
- Do NOT change CSS, styling, colors, spacing, or layout
- Do NOT rename classes or IDs
- UI must remain visually identical at all times
- Only backend logic, API integration, and functionality may be changed

────────────────────────────
TOKEN & CONTEXT SAFETY RULES (CRITICAL)
────────────────────────────

- Hard constraint:
  Never exceed 2500–3000 max output tokens

- Never assume large repository context requires increased token limits

- Always prefer minimal, surgical code changes over full rewrites

- Do NOT generate overly long responses or full-code rewrites unless required

- Break large tasks into smaller steps instead of one large response

- Avoid loading or reasoning over entire repository unless explicitly requested

────────────────────────────
WORKING STYLE RULES
────────────────────────────

- Fix root causes only, not symptoms
- Keep changes minimal and targeted
- Preserve existing architecture unless broken
- Return only necessary file changes