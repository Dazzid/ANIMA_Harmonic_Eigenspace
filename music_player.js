// ============================================================================
// MUSIC PLAYER  —  "Listen: made with ANIMA"
// ----------------------------------------------------------------------------
// © 2025 David Dalmazzo. All Rights Reserved.
// ----------------------------------------------------------------------------
// A small floating widget so visitors can listen to tracks composed with the
// app. Pure HTML5 <audio> (streams the file, independent of the synth / Web
// Audio scenes), opened from the menu (AnimaMusicPlayer.toggle()).
//
// Tracks live in songs/ as MP3 (web-friendly + GitHub-size-safe; the source
// WAVs are kept locally but gitignored). Add a track = add one line to TRACKS.
// ============================================================================

(function () {
    'use strict';

    // Tracks made with ANIMA. `src` is relative to index.html.
    const TRACKS = [
        { title: 'Boarding Gate', src: 'songs/Boarding_Gate.mp3' },
        { title: 'Valparaíso',    src: 'songs/Valparaiso.mp3' }
    ];

    let overlayEl = null, audioEl = null, listEl = null, nowEl = null, current = -1;

    function build() {
        injectStyles();
        const overlay = document.createElement('div');
        overlay.id = 'music-player-overlay';
        overlay.innerHTML = `
            <div class="mp-card">
                <button class="mp-close" title="Close">&times;</button>
                <div class="mp-title">Listen — made with ANIMA</div>
                <div class="mp-now" id="mp-now">Pick a track ↓</div>
                <audio id="mp-audio" controls preload="none"></audio>
                <ul class="mp-list" id="mp-list"></ul>
            </div>`;
        document.body.appendChild(overlay);
        overlayEl = overlay;
        audioEl = overlay.querySelector('#mp-audio');
        listEl = overlay.querySelector('#mp-list');
        nowEl = overlay.querySelector('#mp-now');

        TRACKS.forEach((t, i) => {
            const li = document.createElement('li');
            li.className = 'mp-track';
            li.innerHTML = `<span class="mp-play">▶</span><span class="mp-name">${t.title}</span>`;
            li.addEventListener('click', () => playTrack(i));
            listEl.appendChild(li);
        });

        overlay.querySelector('.mp-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        // Auto-advance to the next track when one finishes.
        audioEl.addEventListener('ended', () => { if (current + 1 < TRACKS.length) playTrack(current + 1); });
        // Keep the row highlight in sync with the native controls.
        audioEl.addEventListener('play', () => markPlaying(current, true));
        audioEl.addEventListener('pause', () => markPlaying(current, false));
        return overlay;
    }

    function markPlaying(i, on) {
        [...listEl.children].forEach((li, j) => {
            const isCur = j === i;
            li.classList.toggle('current', isCur);
            li.querySelector('.mp-play').textContent = (isCur && on) ? '♪' : '▶';
        });
    }

    function playTrack(i) {
        if (i < 0 || i >= TRACKS.length) return;
        current = i;
        audioEl.src = TRACKS[i].src;
        nowEl.textContent = '♪ ' + TRACKS[i].title;
        if (window.Anima) window.Anima.track('song_play', { title: TRACKS[i].title });
        markPlaying(i, true);
        const p = audioEl.play();
        if (p && p.catch) p.catch((err) => {
            // Missing file or blocked autoplay — surface a hint, don't throw.
            nowEl.textContent = 'Could not play "' + TRACKS[i].title + '" — press ▶ on the player';
            console.warn('[music] play failed', err);
        });
    }

    function open() {
        if (!overlayEl) build();
        overlayEl.style.display = 'flex';
    }
    function close() {
        if (overlayEl) overlayEl.style.display = 'none';
        if (audioEl) audioEl.pause();
    }
    function toggle() {
        if (overlayEl && overlayEl.style.display === 'flex') close(); else open();
    }
    function isOpen() {
        return !!(overlayEl && overlayEl.style.display === 'flex');
    }

    function injectStyles() {
        if (document.getElementById('music-player-styles')) return;
        const s = document.createElement('style');
        s.id = 'music-player-styles';
        s.textContent = `
        #music-player-overlay {
            position: fixed; inset: 0; z-index: 100000; display: none;
            align-items: center; justify-content: center;
            background: rgba(20, 20, 20, 0.45); backdrop-filter: blur(2px);
            font-family: 'Fira Code', monospace;
        }
        #music-player-overlay .mp-card {
            position: relative; width: 420px; max-width: 90vw;
            background: rgba(229, 229, 229, 0.98); color: #141414;
            border: 1px solid rgba(0, 136, 255, 0.5); border-radius: 12px;
            padding: 22px 22px 18px; box-shadow: 0 18px 50px rgba(0,0,0,0.5);
        }
        #music-player-overlay .mp-close {
            position: absolute; top: 10px; right: 12px; width: 28px; height: 28px;
            border: none; background: transparent; color: #141414; font-size: 22px;
            cursor: pointer; line-height: 1; border-radius: 6px;
        }
        #music-player-overlay .mp-close:hover { background: rgba(0,0,0,0.08); }
        #music-player-overlay .mp-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; color: #3599f7; }
        #music-player-overlay .mp-now { font-size: 12.5px; color: #444; min-height: 16px; margin-bottom: 12px; }
        #music-player-overlay audio { width: 100%; margin-bottom: 14px; }
        #music-player-overlay .mp-list { list-style: none; margin: 0; padding: 0; }
        #music-player-overlay .mp-track {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 12px; border-radius: 8px; cursor: pointer;
            background: rgba(240,240,240,0.99); border: 1px solid rgba(0,0,0,0.06);
            margin-bottom: 8px; transition: all 0.12s ease; font-size: 13px;
        }
        #music-player-overlay .mp-track:hover { border-color: #4aa3ff; background: rgba(74,163,255,0.10); }
        #music-player-overlay .mp-track.current { border-color: #3599f7; background: rgba(53,153,247,0.14); font-weight: 600; }
        #music-player-overlay .mp-play { color: #3599f7; width: 14px; text-align: center; }
        `;
        document.head.appendChild(s);
    }

    window.AnimaMusicPlayer = { open: open, close: close, toggle: toggle, isOpen: isOpen, TRACKS: TRACKS };
    console.log('[music] player module loaded');
})();
