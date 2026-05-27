# Daily Command Center

A private daily tracking dashboard built as a static website.

## Login

- Username: `595`
- Password: `595`

This is a simple client-side gate for a static GitHub Pages site. For real security across the internet, put the app behind a backend auth service.

## Features

- Budget wallets, spending, money plans, savings goals, and currency conversion for `AZN`, `USD`, `EUR`, and `AED`
- Live exchange-rate refresh from `https://open.er-api.com/v6/latest/USD`
- Daily routine, deadlines, browser alerts, and GitHub issue draft links
- Project timer that survives refreshes and stores daily sessions
- Project/work upload storage in browser IndexedDB
- Notes, habits, health check-ins, top-3 priorities, weekly reviews, backup/import, invite links, and optional remote JSON sync

## Run Locally

From this folder:

```bash
python3 -m http.server 5173
```

Open:

```text
http://localhost:5173
```

## GitHub Pages

Upload the `daily-tracker` folder contents to a GitHub repository and enable GitHub Pages. The app stores data in the browser for that domain, so refreshes keep the data.

For true multi-device real-time collaboration, connect the Remote JSON endpoint in Settings to a backend that accepts `GET` and `PUT` JSON at `/ROOM.json` style URLs.
