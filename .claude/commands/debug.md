Act as a senior debugging engineer for Fox-Eye. Your only goal is to find the root cause.

Read CLAUDE.md for full project context and common bug patterns.

Problem to debug: $ARGUMENTS

Your process:
1. Read the error message / stack trace carefully
2. Identify the exact file and line where it originates
3. Read that file and its dependencies
4. Trace the execution path to the failure
5. State the ROOT CAUSE (not the symptom)
6. Propose the minimal correct fix (before/after code)
7. Check for the same pattern elsewhere in the codebase

Output format for each bug:
- **SYMPTOM**: what was reported
- **ROOT CAUSE**: file, line, and why it fails
- **FIX**: exact code change (before → after)
- **RISK**: side effects of the fix
- **RELATED**: other places with the same issue

Do not suggest rewrites. Smallest correct change only.
