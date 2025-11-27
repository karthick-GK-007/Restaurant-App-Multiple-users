# Post-Migration Test Results

| Test | Result | Notes |
| --- | --- | --- |
| Menu load per branch (Supabase) | NOT RUN | Browser automation unavailable in sandbox; verify manually. |
| Cart operations & checkout workflow | NOT RUN | Requires manual interaction in real browser. |
| Order persistence visible in Supabase dashboard | NOT RUN | Confirm via Supabase UI after running checkout. |
| Admin sales listing & filters | NOT RUN | Needs manual validation once Supabase data exists. |
| Offline fallback (invalid Supabase key) | NOT RUN | Simulate by editing supabase-config.js locally and observing localStorage cache usage. |
| Visual regression screenshots | NOT RUN | Capture before/after screenshots locally and store under tests/before & tests/after. |

> NOTE: Functional code paths were updated and linted, but interactive tests must be executed on the operator's machine with real Supabase credentials.
