# Xtream Media Explorer

Local web client for exploring Xtream Codes accounts — live TV, movies and series through a modern interface.

[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)


---

## Overview

Xtream Media Explorer runs entirely on your machine. It acts as a local client for an existing Xtream Codes account and presents its catalog in a unified web interface.

[![Ver demo](./public/demo/Captura%20de%20pantalla%20de%202026-08-27%2015-21-36.png)](https://youtu.be/cOxkIr03DB8)
[![Ver demo](./public/demo/Captura%20de%20pantalla%20de%202026-08-27%2015-22-50.png)](https://youtu.be/cOxkIr03DB8)

This project does not host, create, or resell any IPTV service. It only queries the credentials you provide and displays the data returned by that server.

### Features

- Live TV, movies and series browsing by category
- Global content search across the full catalog
- Integrated player with HLS and MPEG-TS support, adaptive error handling and automatic retries
- Multi-language audio track selection when available
- Season and episode navigation with next-episode support
- Direct stream URL generation for external players
- Per-tab playlist export: TV and movies as M3U8, series as structured JSON
- Saved playlists with automatic persistence between restarts
- Dark interface with responsive layout and bilingual support (English / Spanish)

---

## Prerequisites

- **Node.js** >= 22 — https://nodejs.org
- **pnpm** >= 9 — https://pnpm.io
- A modern browser (Chrome, Firefox, Edge, Brave)

No additional system dependencies are required.

---

## Installation

```bash
git clone https://github.com/denuczi/xtream-explorer.git
cd xtream-explorer
pnpm install
```

---

## Running the Application

```bash
pnpm dev
```

This starts both the frontend and the local backend concurrently.

Open:

```
http://localhost:5173
```

The backend listens on `http://127.0.0.1:3001` by default.

Other available commands:

```bash
pnpm lint
pnpm build
```

---

## Usage

### Connecting an Account

Fill in the connection form at the top of the interface:

| Field | Description |
|---|---|
| Server | Hostname of the Xtream panel, with or without protocol and port |
| Username | Account username |
| Password | Account password |
| Format | Stream extension used when copying or exporting links (`.ts` or `.m3u8`) |

Click **Connect**. Account metadata such as creation date, expiration date and connection limits will be displayed when provided by the server.

The header can be fully collapsed with the toggle button at its bottom edge to maximize viewing space. The connection status is always indicated by the colored dot on that button.

### Pasting a Long Playlist URL

If your provider gave you a single playlist URL, you can paste it directly into the Server field:

```
http://example.com/get.php?username=YOUR_USER&password=YOUR_PASS&type=m3u_plus
http://example.com/player_api.php?username=YOUR_USER&password=YOUR_PASS
```

The application automatically extracts the server, username and password. When the URL contains `output=ts`, the format selector is updated accordingly. A confirmation note is displayed once the fields are filled.

### Browsing Content

- The left rail filters **categories**.
- The search bar above the grid filters **content** across the entire catalog for the active tab, regardless of the selected category.
- Select a category to load its items. Click a channel or movie to open the player. For series, open a title to view seasons and episodes.
- Use the language switch in the header to toggle between English and Spanish. The preference is persisted.

### Player

The player opens as a modal without losing scroll position or navigation state.

- Supports HLS (`.m3u8`), MPEG-TS (`.ts`), MP4, MKV and WebM depending on what the panel provides
- Handles live streams and on-demand content
- Displays metadata for movies below the video
- Provides fullscreen, audio track selection when multiple languages are available
- Includes next-episode navigation for series
- Offers actions to copy the direct link or download the current movie

If a stream is unavailable or the format is not supported by the browser, a clear error message is shown with retry and copy options.

### Exporting Playlists

The **Download playlist** button next to the navigation tabs exports the active section:

| Tab | File | Format |
|---|---|---|
| TV | `iptv-live.m3u8` | Channel list grouped by category |
| Movies | `iptv-movies.m3u8` | Movie list grouped by category |
| Series | `iptv-series.json` | Structured export including cached seasons and episodes |

For TV and movies, a dialog allows you to choose how the User-Agent is handled:

- **Panel default** — includes the configured User-Agent in each URL
- **Clean link** — omits the pipe suffix for compatibility with players such as VLC
- **Custom** — applies a User-Agent value you define

Series exports are not affected by this setting.

### Saved Playlists

Every successful connection is saved automatically as a chip below the form. Selecting a chip reconnects using the stored credentials without re-entering them. Saved playlists persist across restarts in `server/.data/saved-playlists.json` and can be removed individually.

---

## Configuration

Configuration is optional. Create a `.env` file based on [.env.example](.env.example):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port for the local backend |
| `VITE_API_URL` | `/api` | API base URL for the frontend |
| `XTREAM_USER_AGENT` | `SparkleTV/2.3.1 (ATV R2, Android 9)` | User-Agent sent to the Xtream panel |
| `ALLOW_PRIVATE_HOSTS` | `0` | Allow private and loopback addresses (development only) |
| `ALLOW_INSECURE_TLS` | `0` | Accept panels with invalid HTTPS certificates (also available as a retry option in the UI) |
| `PLAYLISTS_DATA_DIR` | `server/.data` | Directory for saved playlists |

---

## Troubleshooting

| Symptom | Likely Cause | Action |
|---|---|---|
| Invalid HTTPS certificate | Panel uses a self-signed or expired certificate | Use the retry option offered in the error message or set `ALLOW_INSECURE_TLS=1` |
| Content unavailable | Channel is offline or connection limit reached | Try another item or check your plan limits |
| Could not resolve server address | Incorrect host or DNS issue | Verify the exact URL provided by your supplier, including the port |
| External player does not play a copied link | Format mismatch | Switch the format between `.ts` and `.m3u8` and copy again |
| Browser cannot play a video | Unsupported codec or container | Use the copy or download option to play it in an external player |
| Session expired | Backend was restarted | Reconnect from a saved playlist chip |

---

## Security and Privacy

- The backend binds only to `127.0.0.1` and is not accessible from the local network.
- Credentials are kept in server memory and in the local saved-playlists file. They are never written to browser storage or exposed to third-party scripts.
- All remote URLs are validated against SSRF protections before use.
- Development flags are disabled by default.

---

## Technology Stack

**Frontend:** React 19, TypeScript (strict), Vite, Tailwind CSS, Zustand, hls.js, mpegts.js

**Backend:** Node.js, Fastify, Zod, undici

---

<div align="center">

Developed by **Ignacio Sanguina**

</div>
