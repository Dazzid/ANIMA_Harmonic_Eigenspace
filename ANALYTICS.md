# Analytics & Visit Tracking

One pipeline, one Google Sheet. Visits, distinct visitors, geography and behaviour
all flow through [analytics.js](analytics.js) → Google Apps Script → Sheet
(CSV-exportable into `dataset/`). No third-party analytics service. Cookieless,
works on GitHub Pages (`dazzid.github.io`).

| What it answers | From |
|---|---|
| how many visits / which page | `page_view` rows |
| how many distinct visitors / returning | persistent `uid` + `page_view` visit#/returning |
| from where (country/region) | `geo` row — resolved client-side, **IP never stored** |
| what people click / play / attend to | `click`, semantic events, `attention` |

Two random identifiers, neither a cookie, neither carrying any identity:
- **`uid`** — a persistent **visitor id** (localStorage). Survives tab close and
  future visits, so we can **count distinct users** and recognise a returning one
  *without knowing who they are*. `page_view` also carries `visit` (a per-visitor
  load counter) and `returning` (true after the first visit).
- **`sid`** — a per-tab **session id** (sessionStorage), used solely to group one
  visit's events together.

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

### Geography
"From where" uses a free, keyless geo-IP endpoint (`CONFIG.geoEndpoint`,
[geojs.io](https://www.geojs.io/)), called once per session. The code keeps only
country/region/city — never the IP or coordinates.

---

## What gets collected

Per event, one row: `received_at, event_ts, uid, sid, event, page, target, props`.

`uid` lets you count distinct users (`COUNT(DISTINCT uid)`) and follow one visitor
across sessions; `sid` groups the events of a single tab/visit.

**This app is canvas-rendered (p5.js / WebGL).** A raw DOM click on the `<canvas>`
is meaningless — the note/chord/keyboard live in pixels, not the DOM. So the
useful data comes from **semantic events emitted by the app's own handlers**, not
from generic click capture.

Generic events:
- **`page_view`** — once per load (`props.ref` = referrer, `props.visit` = this
  visitor's load count, `props.returning` = true after first visit). Visit record.
- **`geo`** — `{country, country_code, region, city}` — once per session on first
  load. "From where", joinable by `uid`/`sid`. **No IP, no coordinates.**
- **`click`** — **only real UI controls** (button / link / label / `[data-track]`).
  Canvas/background clicks are ignored on purpose. Input values are never read.
- **`attention`** — banked active time (`props.active_ms`): tab visible *and* user
  interacted within the last 60 s. Idle excluded → real dwell.

Semantic events (wired into the code):
- **`chord_play`** — `{alpha, beta, gamma, baseFreq, tet}` — chord played in
  EigenSpace, with its eigen-coordinates. Core research signal. ([eigenspace.js](eigenspace.js))
- **`ms_chord`** — `{quality, root, notes, tet}` — chord made/selected in **Modal
  Studio** (e.g. "Cmaj7"). ([modal_studio_Chord.js](modal_studio_Chord.js))
- **`temperament_switch`** — `{from, to}` — 53 ↔ 31-TET. ([anima.js](anima.js))
- **`scene_switch`** — `{to}` — EigenSpace / Modal Studio / Keyboard. ([anima.js](anima.js))
- **`song_play`** — `{title}` — track played in the music player. ([music_player.js](music_player.js))

Not yet instrumented: individual note presses (keyboard/MIDI). Add with
`window.Anima.track(...)` at their handlers if needed.

### Adding more events
From anywhere after load:
```js
window.Anima.track('event_name', { any: 'props' });
```
For a clickable DOM control, label it instead of relying on auto-capture:
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
No directly identifying data is collected: no IP is stored, no cookies, no names —
only two random ids and UI-level interaction labels. Geography is coarse
(country/region); the IP is used only momentarily by the client-side geo lookup and
is never sent to the Sheet or kept.

Note that `uid` is a **persistent** identifier (localStorage), which lets us single
out and follow one visitor over time. Even though it is random and never linked to a
real identity, under GDPR/ePrivacy a persistent identifier used to track behaviour is
generally treated as **pseudonymous personal data**, and storing it is not "strictly
necessary" — so depending on your MSCA ethics framework you may need a short consent
notice / cookie-style banner. (The per-tab `sid` and aggregate visit counts do not.)
If you want to stay in the no-consent zone, set `CONFIG.persistentVisitorId = false`
to fall back to a per-tab id only. Before linking `uid` to any participant record,
revisit consent and ethics approval first.
