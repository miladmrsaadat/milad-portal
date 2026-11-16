# Agents / Portal changelog

## Checkpoint A — demo features (2026-11-04)
- Agents board views: cards / kanban / timeline (dated steps + logged events) / table / compare (pick 2+).
- Search + filters (agent, status, priority, open/awaiting-approval/late/no-status) + sort, on main and agent pages.
- Inline «📍 آخرین وضعیت» on every item (edit in place, Enter/Esc, logged as change).
- Dossier modal: tabs Summary/Tasks/Outputs/Decisions/Approvals/History, «ثبت مورد», copy template, edit.
- General project pages: inline last status + view modes list / cards / compact (saved per page).
- Tests: tools/agents_test.js (8 configs), tools/new_views_test.js (Chrome+Firefox, storage-blocked) — all pass.
- Lean zip via tools/make_zip.py (excludes shots/backups/gifs) ≈ 6.6 MB.
- Finance untouched.

## Checkpoint B — Phase B (Nov 5, 2026, 02:12 Tehran time)
- extras.js: inbox (N), Ctrl+K and / palette with global search, saved filters, morning top-3 and evening review (/plan), focus mode, shortcuts (G+D/A/I/P/H, ?, F, L), recurring tasks and reminders, low-power mode / reduced-motion
- agents.js: «⚡ فوری‌های این هفته» filter, meteor shower at 100%, addItem/setFilter API
- Double click sound on daily buttons fixed (SFX.lastAt dedupe)
- mss_extras_v1 added to export/import; sw.js cache v5
- Tests: phaseb/agents/new_views/final_smoke passed in Chrome and Firefox (including storage-blocked)

## Checkpoint C — Phase 0 (10 Nov 2026, Tehran time)
- Full backup/restore: export writes every mss_* localStorage key under `storage` (plus the previous structured fields); import restores them and reloads when storage is persistent
- Finance PIN: optional 4–8 digit PIN, SHA-256 + salt (works on file://), session unlock, lock, change, remove; finance stays unchanged until a PIN is set
- Crew Orbit (Pixel) on the landing hero and the running-projects page; 10 bots link to `#/agent/<id>` through `go()`; theme vars = navy/black + strong blue/red; reduced-motion and low-power respected; mute respected; PNG fallback (no GIFs in the zip); single-file build uses still posters so the file stays lean
- sw.js cache v6; build_single inlines crew-orbit.js/css (12 scripts)

## Checkpoint D — Phase 1 (10 Nov 2026, Tehran time)
- Quick wins 60–75%: inline add-transaction row; Audio Influence rail (+ disable when instrumental); My Taste, project name and save path; Lyrics/Style character counters (style cap 1000); category confidence + «نیازمند بررسی»; 400ms KPI flash and one sound per import; month-over-month note on net card; quick capture can record a transaction; inbox source + small file attachment; dashboard layout toggles; mobile quick-add bar; PWA install item (http/https)
- Convert idea→project keeping the same id and writing a history entry; next action + definition of done on general (and music) projects
- Cap of 3 active projects: Persian modal to queue or override; banner on the dashboard
- Landing orbit labels: is-low + labels toward the center so names stay inside the square without breaking 32" portrait fit; hint pulled up slightly for Firefox font metrics
- Convert button click no longer swallowed by data-stop (queue then override both work)
- sw.js cache v7

## Checkpoint E — Phase 2 (10 Nov 2026, Tehran time)
- Offline manual USD/toman rate with Jalali date; equivalent shown next to toman amounts; principal, rate, time and source lock on each new transaction and are not rewritten when the rate changes
- Enter toman or dollar (only the selected field is editable; the other is computed); display rounding: integer toman, USD two decimals
- Optional actual purchase rate / fee; event date kept with entry time; missing history uses the documented manual rate with a note, never a live API
- Two domains (personal/company) plus an aggregate view that drops internal transfers so they are not counted twice; account and project filters; bidirectional personal↔company transfer as a linked pair
- Manual 7-market cards (USD, EUR, TRY, BTC, ETH, USDT, Brent) — editable, dated, offline
- Category budgets with progress and 80%/100% Persian alerts; editable personal/company category lists
- Monthly and category reports with CSV / Excel / print-PDF export and in-portal archive; historical dollar view sums locked equivalents only
- DISPLAY_TEST_MULTIPLIER and finance-seed.js untouched; sw.js cache v8

## Checkpoint F — Phase 4 offline close (10 Nov 2026, Tehran time)
- Phase 3 skipped on purpose (hosting, domain, HTTPS, backend/DB, auth, sync, server push, cron, live rate APIs)
- Edit history on projects; soft-delete + recycle (cap 200) + in-session undo (Ctrl+Z); import batchId and rollback
- Subscription renewals with local due date and browser Notification when permitted (6h dedupe)
- Project hours, tags, milestones, dependencies, parent subproject; 6-column project kanban (idea/ready/doing/paused/done/archive) with saved view + type/archive filters; dual progress (manual vs linked daily tasks)
- Suno form: New Creator/Cover, V6/Wild/Mini (older model kept if already chosen), audio+clones, inspo, split voice-reference name/link
- Encrypted backup (Web Crypto AES-GCM, SHA-CTR+MAC fallback on file://); shareable JSON without finance; finance-only export; optional detach flag (default unchanged, seed still in the default build)
- Optional `Portal-Milad-shareable.html` with empty FIN_SEED; default Portal-Milad.html / zip still include finance-seed.js (untouched, DISPLAY_TEST_MULTIPLIER = 10)
- Bulk personal/company classify; local insights row (SVG flow, receivables/net/forecast notes) without adding a canvas
- Weekly review, system health, local rule-based assistant, knowledge library with versions
- Local notifications hook; drag-reorder morning top-3; tags in Ctrl+K; touch drag on project and agent kanban; editable landing subtitle; simplified Manus mark
- sw.js cache v9; build inlines 13 scripts including offline.js
- Tests: tools/phase4_test.js (Chrome+Firefox, multi/single/storage-blocked)
