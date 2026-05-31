# RunwayOS

RunwayOS is a local-first money and execution cockpit for ambitious builders. It combines multi-currency budgeting, project time ROI, deadlines, notes, weekly routines, and growth experiments so a user can see whether their money and time are compounding.

## Investor Positioning

The old product was a simple daily tracker. The venture-scale version is a personal operating system for solo founders, students, creators, freelancers, and small teams who need one place to manage cash runway, work sessions, commitments, decisions, and distribution experiments.

## Login

- Username: `595`
- Password: `595`

This is a static client-side gate. It is convenient for a demo, but it is not real security. Production needs backend auth, encrypted sync, and per-user data isolation.

## What Changed

- Rebranded from Daily Command Center to RunwayOS
- Added Strategy dashboard with investor score, runway, startup metrics, growth experiments, pricing model, and roadmap
- Fixed note persistence by making local saves safer and merging notes across tabs instead of allowing stale state to overwrite new notes
- Added note types for decisions, customers, risks, ideas, meetings, and metrics
- Added storage failure warnings so the user knows when browser storage fails
- Kept budget, routine, timer, projects, friends, notes, backup/import, and optional remote sync

## Venture Roadmap

### 30 Days

- Fix persistence and onboarding
- Add customer interview logging
- Add 90-second setup: wallet, savings goal, project, first note
- Add weekly review and money/time leak insights
- Charge manually for first 10 users

### 90 Days

- Add real accounts and encrypted cloud sync
- Add shared accountability rooms
- Add referral loops and creator templates
- Add bank import through a provider
- Add AI categorization and natural-language note capture

### 12 Months

- Build the personal data moat: spending, time, project ROI, decisions, habits, and outcomes
- Launch team/campus plans
- Add benchmarking across anonymous cohorts
- Add AI financial coach and execution agent
- Expand from solo users to creator teams, bootcamps, and accelerators

## Run Locally

```bash
python3 -m http.server 5173
```

Open:

```text
http://localhost:5173
```

## GitHub Pages

Serve the repo root from GitHub Pages. Data is stored in the browser for that domain, so refreshes keep the data. Cross-device collaboration requires a real backend or the Remote JSON endpoint.
