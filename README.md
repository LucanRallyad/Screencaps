# Screencaps

Invite-only web app for capturing ad-replacement screenshots across publisher sites.

Workflow: upload your ad creatives + a list of URLs → the bot visits each page in desktop & mobile, dismisses cookie/popup banners, finds ad slots, swaps in size-matched creatives, scrolls to capture full-page screenshots, then ZIPs the lot for download.

---

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind, shadcn/ui-style components)
- **Postgres + Drizzle** for data
- **pg-boss** for the background job queue (no Redis needed)
- **Playwright** (Chromium) for headless capture
- **Resend** for invite / verification / password-reset emails
- **iron-session** for cookie-based sessions

---

## Local development

**1. Install deps**

```bash
npm install
```

**2. Set up environment**

```bash
cp .env.example .env
```

Then edit `.env` and fill in `SESSION_SECRET` (32+ random chars). Optionally set `RESEND_API_KEY` — without it, invite / reset emails are printed to the server console so you can still develop end-to-end.

**3. Start Postgres** (docker-compose ships one for you)

```bash
docker compose up -d db
```

**4. Push the schema and seed the admin account**

```bash
npm run db:push
npm run db:seed
```

**5. Install Playwright's Chromium**

```bash
npm run playwright:install
```

**6. Start the web server**

```bash
npm run dev
```

**7. In a second terminal, start the worker**

```bash
npm run worker
```

(Don't paste shell comments after commands — zsh interactive shells pass `#` as a literal arg, which breaks `npm` scripts.)

Open <http://localhost:3000>. Use **Forgot password** with `lucan@rallyad.com` to set your initial admin password — the console will log the reset link if you don't have Resend configured.

---

## Production deploy (single VPS)

Recommended targets: Fly.io, Hetzner, AWS EC2, Railway. Anywhere you can run Docker.

```bash
# On the server
git clone <your-fork> screencaps && cd screencaps
cp .env.example .env
# Fill out .env with real values, then:
docker compose up -d
docker compose exec app npm run db:push
docker compose exec app npm run db:seed
```

Three containers come up:

- **db** — Postgres 16
- **app** — Next.js web server on `:3000`
- **worker** — Playwright runner that drains the job queue

Run `docker compose logs -f worker` to watch captures.

Put it behind nginx/Caddy/Traefik for HTTPS and a real domain.

---

## How the engine works

For each target URL the worker:

1. Launches a Chromium context with desktop or mobile viewport + stealth init script.
2. Navigates, waits for DOM-ready, sleeps briefly so the page can settle.
3. Runs the popup-dismissal heuristic (known consent frameworks + verb matching + overlay removal).
4. Auto-scrolls to bottom to trigger lazy-loaded ads, scrolls back to top.
5. Detects ad slots by:
   - iframes from known ad networks (GAM, Criteo, Taboola, Amazon, AppNexus, …)
   - iframes whose visible dimensions match IAB standard sizes
   - Common ad-container selectors (`div[id^="div-gpt-ad"]`, `ins.adsbygoogle`, etc.)
6. For each detected slot, picks an uploaded creative with matching width × height. If no match, the slot is left as-is.
7. Replaces the slot DOM with an `<img>` of the creative.
8. Takes a full-page PNG screenshot.
9. Optionally follows one internal link and repeats steps 3–8.
10. Marks the target `completed`, `no_ad_slots`, `unreachable`, or `failed`.

Both **desktop** and **mobile** captures run for each URL.

---

## Admin

`/admin/users` — invite, lock, delete accounts.
`/admin/activity` — filter activity by email, export the filtered log as `.txt`.

Only the seeded `ADMIN_EMAIL` (default `lucan@rallyad.com`) gets the admin nav.

---

## Project layout

```
src/
├── app/                       # Next.js routes
│   ├── (app)/                 # Authenticated app shell (projects, admin)
│   ├── login, invite, reset…  # Public auth pages
│   └── api/                   # Image/zip download routes, admin exports
├── components/                # UI primitives + app shell
├── lib/
│   ├── auth/                  # session, password, server actions
│   ├── db/                    # Drizzle schema + client
│   ├── email/                 # Resend send helpers
│   ├── parse/                 # Excel/CSV URL extraction
│   ├── queue/                 # pg-boss orchestration
│   ├── screenshot/            # Playwright engine (detect, replace, capture)
│   └── storage/               # File upload handling
├── server/worker.ts           # Standalone worker entrypoint
└── middleware.ts              # Session-gated routes
```
