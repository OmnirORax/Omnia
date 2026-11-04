# Enable online Questboard in the existing Omnia project

Use the existing Supabase project. Do not create a replacement project or send
any token/password in chat. The GitHack visual preview intentionally lacks cloud
configuration; use the protected **https://omnium.nexus** frontend for sign-in.

1. Open the existing project at
   **https://supabase.com/dashboard/project/tqjjcabekjjmmspttbli/sql/new**. Confirm
   that this is the Omnia project; resume the project in the dashboard if paused.
2. Open **questboard-setup.sql** in this directory, select **Raw**, copy its entire
   contents into SQL Editor, and Run. It installs the two quest migrations in one
   transaction, preserves existing data, records migration history and reloads the
   API schema. A success message says the migrations are installed. Exact recorded
   versions are skipped on repeat. Changed or untracked existing migrations stop
   safely: do not delete tables or retry with guards removed; report the error
   text without credentials so the existing installation can be reviewed.
3. Review/merge the quest-authoring source PR once its checks pass. This publishes
   the frontend through the existing protected Cloudflare workflow. Applying the
   additive SQL first keeps the previous frontend compatible during rollout.
4. Open **https://omnium.nexus**, complete its Access login if asked, then use
   **Workspace settings → Cloud connection** to sign in to the existing Supabase
   account. Access login and Supabase sign-in are separate.
5. Open **♾️ → Questboard → New quest**. Set **Click target = 10** and
   **Time limit = 7 seconds**, then **Publish quest**. Shared number controls allow
   exact entry by right-clicking their value dot. The new quest appears on the
   board, and Leaderboard includes its 7-second benchmark.
6. Attempt it, click at least ten times in the dedicated test area, and let the
   timer expire without pausing/closing. Return to Questboard and Hand in for
   **+1 star**. Repeating the hand-in or publishing the same goal cannot add a
   second reward for that quest.
7. For the cross-account test, create another **confirmed** user in Supabase
   **Authentication → Users → Add user** (public signup stays disabled). Use a
   separate browser profile, sign into that account at omnium.nexus, and refresh
   Questboard. Both accounts should see the same new quest/benchmark and rankings;
   each has independent completion, claims and stars.

If omnium.nexus itself reports missing cloud configuration, its build needs the
existing `VITE_SUPABASE_URL` and public `VITE_SUPABASE_PUBLISHABLE_KEY` repository
variables restored through the original hosting setup. Do not use a service key
in frontend variables. The expected absence of these variables in GitHack does
not require reconfiguring the hosted project.

The setup SQL contains schema code only. It creates no accounts and includes no
passwords, API keys, tokens, user workspace data or test fixtures. An already
installed baseline with valid migration history is supported; an untracked SQL
Editor install requires review rather than automatic adoption. Older frontend
clients retain their existing quest IDs and claim behavior. Rollback should
restore frontend code while retaining the new tables and authored quest data.

Contributors regenerate the exact installer with:

```sh
node scripts/export-metrics-migrations.mjs docs/setup/questboard-setup.sql
```

`node scripts/test-metrics-db.mjs` checks fresh install, exact replay, changed
history refusal and prior-claim preservation against disposable PostgreSQL.
Hosted Supabase and browser acceptance are separate, and remain unverified here.
