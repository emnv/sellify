# Project-local setup (Supabase, Vercel, GitHub)

This project uses **its own** Supabase, Vercel and GitHub credentials. They live only in
gitignored files in this folder. Your account-level claude.ai Supabase / Vercel / GitHub
connectors are blocked for this project by `.claude/settings.json`.

| File (gitignored) | What goes in it | Used by |
|---|---|---|
| `.mcp.json` | Supabase project ref + Supabase token, GitHub token | Claude Code MCP servers |
| `.claude/settings.local.json` | Tokens for the CLIs Claude runs (Supabase CLI, Vercel CLI, git push) | Claude Code shell commands |
| `.env.local` | App runtime keys (Supabase, Stripe, Resend, OpenAI, Vercel API, domain) | The Next.js app |

Templates you can look at: `.mcp.example.json`, `.env.example`.

---

## 1. Supabase

1. Go to <https://supabase.com/dashboard>, sign in with the account you want for this project, and **create a new project** (save the database password).
2. **Project ref:** Project Settings → General → *Reference ID* (e.g. `abcdefghijklmnop`).
3. **API keys:** Project Settings → API → copy *Project URL*, *anon / publishable key* and *service_role / secret key*.
4. **Personal access token:** Account (top-right avatar) → Access Tokens → *Generate new token*, name it `sellify-claude`.

Fill in:
- `.mcp.json` → replace `<SUPABASE_PROJECT_REF>` and `<SUPABASE_PERSONAL_ACCESS_TOKEN>`.
- `.claude/settings.local.json` → `SUPABASE_ACCESS_TOKEN` (same token), `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
- `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Vercel

1. Sign in at <https://vercel.com> with the account/team for this project.
2. **Token:** Account Settings → Tokens → *Create*, scope = the team you'll deploy to.
3. **Team ID:** Team Settings → General → *Team ID* (starts with `team_`).
   (The Vercel project itself is created later from the GitHub repo. Claude fills in `VERCEL_PROJECT_ID`.)

Fill in:
- `.claude/settings.local.json` → `VERCEL_TOKEN`, `VERCEL_ORG_ID` (= team ID).
- `.env.local` → `VERCEL_API_TOKEN` (same token), `VERCEL_TEAM_ID`.

The Vercel MCP server uses OAuth only, so it has no token in `.mcp.json`. You log it in at step 7.

## 3. GitHub

1. Create a **new, empty** repository (no README, no .gitignore, no license).
2. Create a **fine-grained personal access token**: Settings → Developer settings → Personal access tokens → Fine-grained tokens → *Generate new token*.
   - Repository access: **Only select repositories** → your new repo.
   - Repository permissions: **Contents: Read and write**, **Pull requests: Read and write**, **Issues: Read and write**, **Workflows: Read and write**, **Metadata: Read-only** (automatic).
3. *(Optional)* Install the GitHub CLI: `winget install --id GitHub.cli`. It picks up `GH_TOKEN` automatically, so you never need to run `gh auth login` for this project.

Fill in:
- `.mcp.json` → `<GITHUB_FINE_GRAINED_PAT>`.
- `.claude/settings.local.json` → `GH_TOKEN` (same token), `GITHUB_REPO_URL` (the `https://github.com/<owner>/<repo>.git` URL).

How pushing stays on this account: this repo has a **repo-local** git credential helper
(`git config --local credential.helper`) that clears Windows Credential Manager for this repo only
and sends `GH_TOKEN` instead. Your other repos are not affected.

## 4. Stripe (test mode)

Dashboard → toggle **Test mode** → Developers → API keys.
`.env.local` → `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
Leave `STRIPE_WEBHOOK_SECRET` empty. Claude creates the webhook endpoint at deploy time and tells you where to copy the secret from.

## 5. Resend (email)

<https://resend.com> → API Keys → create one → `.env.local` `RESEND_API_KEY`.
To email real customers, add and verify your domain under Domains, then set `EMAIL_FROM` to an address on it.
Until then, use `EMAIL_FROM="Sellify <onboarding@resend.dev>"`. With that sender, Resend only delivers to your own Resend account email.

## 6. OpenAI

<https://platform.openai.com/api-keys> → create a key → `.env.local` `OPENAI_API_KEY`. Leave `OPENAI_MODEL` empty; Claude sets it during the AI customizer phase.

## 7. Domain

1. In `.env.local`, set `STORES_ROOT_DOMAIN` to the domain you own (e.g. `mystores.com`).
2. At your registrar, change the nameservers to Vercel's (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`). Wildcard subdomains (`*.mystores.com`) need this. Claude adds `app.<domain>` and `*.<domain>` to the Vercel project at deploy time.

## 8. Activate the MCP servers in Claude Code

1. Save all three files, then **reload VS Code** (Command Palette → *Developer: Reload Window*) or restart Claude Code.
2. If asked, approve the project MCP servers `supabase`, `vercel`, `github`.
3. Type `/mcp` → select **vercel** → *Authenticate*.
   **Important:** your browser may already be logged in to your other Vercel account. Copy the
   login link into a **private/incognito window**, sign in with the project's Vercel account and approve.
4. Run `/mcp` again and check:
   - `supabase`, `vercel` and `github` show **connected**
   - *claude.ai Supabase*, *claude.ai Vercel* and *claude.ai GitHub* are **not** listed, or are listed as disabled

Then tell Claude "config done" and implementation continues.

## Rotating or removing credentials

Edit the three files and reload the window. Nothing is stored outside this folder, except the
Vercel MCP OAuth login, which Claude Code keeps in its own credential store. Use `/mcp` → vercel → *Clear authentication* to remove it.
