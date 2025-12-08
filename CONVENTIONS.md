# AI Coding Conventions

## Error Handling & Debugging
1. **No Cosmetic Fixes for 500 Errors**: Never add error handling to the frontend to mask a 500 Internal Server Error.
2. **Root Cause Analysis**: If an API endpoint returns an error, you MUST analyze the server-side code handling that route.
3. **Missing Context**: If the server-side file is not in the chat, use tools to find it (e.g., `grep` for the route path) or ask the user to add it.
4. **Fix Location**: Fix the logic where it breaks (the backend), not where it is reported (the frontend).

## Workflow
- When a file is missing, do not assume it is off-limits. Ask for it.
- Prioritize full-stack resolution over frontend patches.

## File Management
1. **Do Not Guess Filenames**: Never ask the user to add a file "or similar."
2. **Hunt First**: Before asking for a file, use `ls -R` or `grep` to locate the exact path.
3. **Specific Requests**: Only ask the user to add files that you have verified exist in the file tree.
