# Cicada2137 · Sanawar Treasure Hunt

A Vite + TypeScript treasure hunt with a Supabase database and Vercel serverless API.

## Local development

```bash
npm install
npm run dev
```

The public hunt runs at `/`. The organiser dashboard is at `/admin.html`.

## Required Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for Production (and Preview if you use it):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://mxmtzmtxuldlhesrpbuf.supabase.co` |
| `SUPABASE_SECRET_KEY` | The Supabase **secret** API key from Project Settings → API Keys. Keep it server-side. |
| `SESSION_SECRET` | A random secret of at least 32 characters, used to sign participant and admin cookies. |
| `PASSCODE_PEPPER` | A different random secret of at least 32 characters, used to hash passcodes before they are stored. |
| `ADMIN_PASSWORD` | A strong, private password for `/admin.html`. |

Never add these values to frontend code or commit them to GitHub. After setting or changing the variables, redeploy Vercel. Generate independent random values for the session secret and passcode pepper; do not reuse the admin password for either.

## Database

The Supabase migration creates three RLS-protected tables:

- `cicada_puzzles`: the three riddle texts and keyed passcode hashes.
- `cicada_participants`: participant names and current unlocked puzzle.
- `cicada_completions`: the timestamp for each puzzle completed by each participant.

Only the server-side Supabase secret key is granted access to these tables. The browser never receives the secret key or passcode hashes.

## Configure passcodes

1. Add the Vercel environment variables above and redeploy.
2. Open `/admin.html` on your deployed site.
3. Sign in using `ADMIN_PASSWORD`.
4. Set a passcode for each puzzle in the Passcodes section.
5. Passcodes are HMAC-hashed on the server before being stored.

The previous HTML contained temporary `00` codes. The database starts with no configured passcodes, so the hunt cannot be completed until the organiser sets the real chit codes.

## Participant behaviour

Participants enter a name once. A signed, HTTP-only cookie keeps their session and the database stores their progress. If a participant clears browser cookies or changes device, they will need to register again. This name-only setup does not include account recovery or identity verification.

## Admin dashboard

The admin page shows participant names, join/last-active times, puzzle completion timestamps and overall completion status. It also lets the organiser set or replace puzzle passcodes. Admin access is protected by an environment-stored password and a signed, HTTP-only session cookie.
