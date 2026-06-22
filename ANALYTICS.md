# Analytics & Visit Tracking

Two **separate** systems, on purpose — they answer different questions and have
different privacy profiles. Both are **cookieless** and store **no personal data**
(no IP, no names). See header docs in [analytics.js](analytics.js).

| | What it answers | Tool | Where data lives |
|---|---|---|---|
| **Visits** | how many people, from where, which page | built-in `page_view` event | same Google Sheet → CSV |
| **Behaviour** | what people click, where attention goes | `analytics.js` → Google Apps Script | Google Sheet → CSV in `dataset/` |

Visits and behaviour share **one** pipeline: `analytics.js` already sends a
`page_view` row (with referrer) on every load, so visit counts live in the same
CSV — no third-party analytics service is needed. This is hosting-independent and
works fine on GitHub Pages (`dazzid.github.io`). Cloudflare Web Analytics is
**optional** (see below) and left off by default.

The only identifier is a **random per-tab session id** (sessionStorage), used
solely to group one visit's clicks together. It is not a cookie and carries no
identity.

---

## Setup (one-time, ~3 min)

### Visits + behaviour — Google Apps Script → Sheet → CSV  (the only step needed)
1. Create a Google Sheet → **Extensions → Apps Script**.
2. Paste [tools/analytics_appscript.gs](tools/analytics_appscript.gs), Save.
3. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access*
   **Anyone**. Copy the **Web app URL** (ends in `/exec`).
4. Paste that URL into [analytics.js](analytics.js) → `CONFIG.behaviorEndpoint`.

That's it — `page_view` rows give you visits and the click/attention rows give you
behaviour, all in the same sheet. Until the URL is filled in, nothing is sent and
the app behaves exactly as before.

### (Optional) prettier visit dashboard
The built-in `page_view` counting needs no service. If you ever want a hosted
dashboard with country/device charts, add a one-line snippet — both work on
GitHub Pages:
- **Cloudflare Web Analytics** — free, cookieless. Register hostname
  `dazzid.github.io`, copy the site token into `CONFIG.cfBeaconToken`. (Works on
  GitHub Pages despite not using Cloudflare DNS — it's a pure client-side beacon.)
- **GoatCounter** — free, open-source, you own the data.

---

## What gets collected

Per event, one row: `received_at, event_ts, sid, event, page, target, props`.

- **`page_view`** — once per page load (`props.ref` = referrer).
- **`click`** — every click; `target` is the control's `data-track`, else its
  `aria-label`/`title`/id/class/text (capped). Input/textarea **values are never
  read**, so no typed content leaks.
- **`attention`** — banked active time (`props.active_ms`): time the tab is
  visible *and* the user interacted within the last 60 s. Idle time is excluded,
  so this is a real attention/dwell measure, not wall-clock.

### Custom events
Call from anywhere once the page is loaded:
```js
window.Anima.track('temperament_switch', { from: 53, to: 31 });
window.Anima.track('song_play', { id: 'ballad-01' });
```
For cleaner click labels on a specific control, annotate it:
```html
<button data-track="play-chord">▶</button>
```

---

## Getting the CSV into the repo
- **Manual:** Sheet → **File → Download → CSV** → save as `dataset/events.csv`, commit.
- **Scripted:** set `EXPORT_KEY` in the Apps Script, then
  ```bash
  curl -L "https://script.google.com/.../exec?export=csv&key=YOUR_KEY" -o dataset/events.csv
  ```
  Treat `dataset/events.csv` as an **export/archive**, not a live sink — the Sheet
  is the source of truth; the browser never writes to the repo directly.

---

## Privacy / ethics note (MSCA / GDPR)
Collection is anonymous: no IP (Apps Script never receives it), no cookies, no
names — only a random session id and UI-level interaction labels. This is designed
to fall outside personal-data handling. If the data model ever changes (e.g. adding
identifiers or linking to a participant), revisit consent and ethics approval first.
