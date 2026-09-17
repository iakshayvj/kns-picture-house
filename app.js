/* KNS Picture House — programme engine.
   One programme of four films per 24h window, anchored to Asia/Kolkata midnight.
   Deterministic: same window -> same four films, on any device. */

(function () {
  const DATA = window.KNS_DATA || { movies: [] };
  const IST_OFFSET_MIN = 330; // +05:30
  const DAY_MS = 86400000;

  // ---------- feedback store (stage 2: local, exportable) ----------
  const FB_KEY = 'kns_feedback_v1';
  const loadFeedback = () => { try { return JSON.parse(localStorage.getItem(FB_KEY)) || {}; } catch { return {}; } };
  const saveFeedback = (fb) => localStorage.setItem(FB_KEY, JSON.stringify(fb));

  const mergedWatched = (movie) => {
    const local = loadFeedback()[movie.id];
    const db = movie.watched || {};
    return {
      akshay: (local && local.akshay) || db.akshay || null,
      kruthika: (local && local.kruthika) || db.kruthika || null,
    };
  };
  const watchedByBoth = (m) => { const w = mergedWatched(m); return !!(w.akshay && w.kruthika); };
  const watchedByEither = (m) => { const w = mergedWatched(m); return !!(w.akshay || w.kruthika); };

  // ---------- deterministic rotation ----------
  function istNow() {
    // Date.now() is UTC-absolute; shift by +05:30 to read it as IST wall time.
    return new Date(Date.now() + IST_OFFSET_MIN * 60000);
  }
  const LAUNCH_WINDOW = Math.floor((Date.UTC(2026, 8, 17) + IST_OFFSET_MIN * 60000) / DAY_MS); // club founded 2026-09-17 IST
  function programmeWindow() {
    return Math.floor(istNow().getTime() / DAY_MS);
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickProgramme(movies, window) {
    const fresh = movies.filter((m) => !watchedByBoth(m));
    const pool = fresh.length >= 4 ? fresh : movies.slice();
    const rnd = mulberry32((window * 2654435761) >>> 0);
    const idx = pool.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, 4).map((i) => pool[i]);
  }

  // ---------- rendering ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtScore = (label, val, suffix) =>
    val == null
      ? `<span class="score na">${label} &mdash;</span>`
      : `<span class="score">${label} <b>${esc(val)}${suffix || ''}</b></span>`;
  const posterHtml = (m, cls) =>
    m.poster
      ? `<img src="${esc(m.poster)}" alt="${esc(m.title)} poster" loading="lazy" class="${cls || ''}">`
      : `<div class="poster-fallback">${esc(m.title)}</div>`;
  const streamChips = (m) => {
    const s = m.streaming_in || [];
    if (!s.length) return `<span class="stream-chip none">Streaming in India: not tracked yet</span>`;
    return s.map((x) => `<span class="stream-chip">${esc(x)}</span>`).join('');
  };

  function renderBoard() {
    const board = document.getElementById('board');
    const films = pickProgramme(DATA.movies, programmeWindow());
    board.innerHTML = films.map((m, i) => {
      const w = mergedWatched(m);
      const stamped = watchedByEither(m)
        ? `<span class="watched-stamp">${w.akshay && w.kruthika ? 'WATCHED ×2' : 'WATCHED'}</span>` : '';
      return `
      <article class="panel" data-id="${esc(m.id)}" tabindex="0" role="button" aria-expanded="false">
        ${stamped}
        <div class="panel-main">
          <div class="panel-no">№&nbsp;${i + 1}</div>
          <div>
            <div class="panel-title">${esc(m.title)}</div>
            <div class="panel-sub">${esc(m.year)} &middot; ${esc(m.country)} &middot; ${esc(m.language)}</div>
          </div>
          <div class="panel-scores">
            ${fmtScore('IMDb', m.imdb)}
            ${fmtScore('RT', m.rt, '%')}
          </div>
        </div>
        <div class="panel-detail">
          ${posterHtml(m)}
          <div>
            <p class="panel-plot">${esc(m.plot)}</p>
            <div class="panel-streams">${streamChips(m)}</div>
            <button class="log-watch" data-log="${esc(m.id)}" type="button">LOG A WATCH</button>
          </div>
        </div>
      </article>`;
    }).join('');

    document.getElementById('programme-no').textContent =
      'PROGRAMME № ' + Math.max(1, programmeWindow() - LAUNCH_WINDOW + 1);
  }

  function renderLedger() {
    const grid = document.getElementById('ledger-grid');
    grid.innerHTML = DATA.movies.map((m) => `
      <div class="card ${watchedByEither(m) ? 'watched' : ''}" data-id="${esc(m.id)}" tabindex="0" role="button">
        ${posterHtml(m)}
        <div class="card-body">
          <div class="card-title">${esc(m.title)}</div>
          <div class="card-meta">${esc(m.year)} &middot; ${esc(m.country)}</div>
          <div class="card-meta">IMDb ${m.imdb ?? '—'} &middot; RT ${m.rt != null ? m.rt + '%' : '—'}</div>
        </div>
      </div>`).join('');
    document.getElementById('footer-count').textContent =
      DATA.movies.length + ' FILMS IN THE LEDGER';
  }

  // ---------- countdown ----------
  function tickCountdown() {
    const t = istNow();
    const next = new Date(Math.ceil((t.getTime() + 1) / DAY_MS) * DAY_MS);
    let s = Math.floor((next - t) / 1000);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    document.getElementById('rotation-countdown').textContent = `ROTATES IN ${h}:${m}:${sec} IST`;
  }

  // ---------- modal + watch logging ----------
  const modal = document.getElementById('film-modal');
  const modalCard = document.getElementById('modal-card');
  let formState = null;

  function openFilm(id) {
    const m = DATA.movies.find((x) => x.id === id);
    if (!m) return;
    const w = mergedWatched(m);
    formState = { id, who: null, rating: 0, reaction: null };
    const reactions = ['Loved it', 'Good watch', 'Mixed', 'Not for us'];
    const existing = (who) => w[who] ? ` ★${w[who].rating}` : '';
    modalCard.innerHTML = `
      <h3>${esc(m.title)}</h3>
      <p class="modal-sub">${esc(m.year)} &middot; ${esc(m.country)} &middot; ${esc(m.language)}</p>
      <div class="modal-grid">
        ${posterHtml(m)}
        <div>
          <p class="modal-plot">${esc(m.plot)}</p>
          <div class="modal-scores">${fmtScore('IMDb', m.imdb)}${fmtScore('RT', m.rt, '%')}</div>
          <div class="modal-streams">${streamChips(m)}</div>
        </div>
      </div>
      <form class="watch-form" id="watch-form">
        <h4>LOG A WATCH</h4>
        <div class="field-row">
          <label>Who watched${existing('akshay') || existing('kruthika') ? ` — on file: Akshay${existing('akshay')} · Kruthika${existing('kruthika')}` : ''}</label>
          <div class="who-row">
            <button type="button" class="who-btn" data-who="akshay">AKSHAY</button>
            <button type="button" class="who-btn" data-who="kruthika">KRUTHIKA</button>
            <button type="button" class="who-btn" data-who="both">BOTH</button>
          </div>
        </div>
        <div class="field-row">
          <label>Rating</label>
          <div class="stars">${[1,2,3,4,5].map((n) => `<button type="button" class="star" data-star="${n}">★</button>`).join('')}</div>
        </div>
        <div class="field-row">
          <label>Reaction</label>
          <div class="chips">${reactions.map((r) => `<button type="button" class="chip" data-reaction="${esc(r)}">${esc(r)}</button>`).join('')}</div>
        </div>
        <div class="field-row">
          <label>Notes</label>
          <textarea id="watch-note" placeholder="A line or two. What stayed with you?"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" id="modal-close">CLOSE</button>
          <button type="submit" class="btn-solid">SAVE TO THE HOUSE</button>
        </div>
        <div class="saved-note" id="saved-note"></div>
      </form>`;
    modal.showModal();

    modalCard.querySelector('#modal-close').addEventListener('click', () => modal.close());
    modalCard.querySelectorAll('.who-btn').forEach((b) => b.addEventListener('click', () => {
      modalCard.querySelectorAll('.who-btn').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel'); formState.who = b.dataset.who;
    }));
    modalCard.querySelectorAll('.star').forEach((b) => b.addEventListener('click', () => {
      formState.rating = +b.dataset.star;
      modalCard.querySelectorAll('.star').forEach((x) => x.classList.toggle('on', +x.dataset.star <= formState.rating));
    }));
    modalCard.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      modalCard.querySelectorAll('.chip').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel'); formState.reaction = b.dataset.reaction;
    }));
    modalCard.querySelector('#watch-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!formState.who) { alert('Pick who watched.'); return; }
      if (!formState.rating) { alert('Give it a star rating.'); return; }
      const entry = {
        rating: formState.rating,
        reaction: formState.reaction,
        note: modalCard.querySelector('#watch-note').value.trim(),
        at: new Date().toISOString(),
      };
      const fb = loadFeedback();
      fb[formState.id] = fb[formState.id] || {};
      const whos = formState.who === 'both' ? ['akshay', 'kruthika'] : [formState.who];
      whos.forEach((w2) => { fb[formState.id][w2] = entry; });
      saveFeedback(fb);
      document.getElementById('saved-note').textContent = 'Logged. It now counts toward your taste.';
      renderBoard(); renderLedger();
      setTimeout(() => modal.close(), 900);
    });
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const logBtn = e.target.closest('[data-log]');
    if (logBtn) { e.stopPropagation(); openFilm(logBtn.dataset.log); return; }
    const panel = e.target.closest('.panel');
    if (panel) {
      const open = panel.classList.toggle('open');
      panel.setAttribute('aria-expanded', open);
      return;
    }
    const card = e.target.closest('.card');
    if (card) openFilm(card.dataset.id);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const panel = e.target.closest && e.target.closest('.panel');
    const card = e.target.closest && e.target.closest('.card');
    if (panel) panel.classList.toggle('open');
    if (card) openFilm(card.dataset.id);
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  document.getElementById('export-feedback').addEventListener('click', () => {
    const fb = loadFeedback();
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), feedback: fb }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kns-feedback.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // bulbs
  ['bulbs-top', 'bulbs-bottom'].forEach((id) => {
    const row = document.getElementById(id);
    for (let i = 0; i < 24; i++) { const b = document.createElement('span'); b.className = 'bulb'; row.appendChild(b); }
  });

  // ---------- go ----------
  renderBoard();
  renderLedger();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  // re-render when the window rolls over
  setInterval(() => { renderBoard(); }, 60000);
})();
