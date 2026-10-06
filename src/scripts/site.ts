// Interactive pieces of the site. One player (the bar at the bottom) plays everything and keeps
// playing between pages; each page's features set themselves up again after every navigation.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const readJSON = <T>(id: string, fallback: T): T => {
  try { const el = $(id); return el ? (JSON.parse(el.textContent || '') as T) : fallback; } catch { return fallback; }
};
const PLAY_D = 'M7 4l13 8-13 8z', PAUSE_D = 'M6 4h4v16H6zM14 4h4v16h-4z';
const icon = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
const fmt = (x: number) => { x = Math.max(0, Math.floor(x || 0)); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; };
const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// ---------- Starfield: slow drift and gentle twinkle behind every page ----------
(() => {
  const c = document.getElementById('sky') as HTMLCanvasElement | null;
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tints = ['255,255,255', '255,255,255', '255,255,255', '214,224,255', '255,226,170'];
  type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; v: number; glow: boolean; tint: string };
  let W = 0, H = 0, stars: Star[] = [], last = 0, raf = 0;
  const t0 = performance.now();
  function draw(now: number, dt: number) {
    const t = (now - t0) / 1000;
    ctx!.clearRect(0, 0, W, H);
    for (const s of stars) {
      if (dt) { s.x -= s.v * dt * 0.55; s.y -= s.v * dt * 0.22; if (s.x < -4) s.x = W + 4; if (s.y < -4) s.y = H + 4; }
      const al = reduce ? s.a : s.a * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(s.ph + t * s.tw * 2)));
      if (s.glow) {
        const g = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
        g.addColorStop(0, `rgba(${s.tint},${al * 0.35})`); g.addColorStop(1, `rgba(${s.tint},0)`);
        ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(s.x, s.y, s.r * 5, 0, 6.283); ctx!.fill();
      }
      ctx!.fillStyle = `rgba(${s.tint},${al})`; ctx!.beginPath(); ctx!.arc(s.x, s.y, s.r, 0, 6.283); ctx!.fill();
    }
  }
  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    c!.width = Math.round(W * dpr); c!.height = Math.round(H * dpr); ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((W * H) / 2400) }, () => {
      const big = Math.random() < 0.12, depth = Math.random();
      return {
        x: Math.random() * W, y: Math.random() * H,
        r: big ? 0.9 + Math.random() * 1.2 : 0.25 + Math.random() * 0.7,
        a: big ? 0.55 + Math.random() * 0.4 : 0.2 + Math.random() * 0.5,
        tw: 0.15 + Math.random() * 0.6, ph: Math.random() * 6.283,
        v: (0.6 + depth * 2.4) * (big ? 1.4 : 1), glow: big && Math.random() < 0.5,
        tint: tints[(Math.random() * tints.length) | 0],
      };
    });
    draw(performance.now(), 0);
  }
  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30fps is plenty for slow drift
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; draw(now, dt);
  }
  let rt: number | undefined;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(build, 200); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!reduce && !raf) { last = 0; raf = requestAnimationFrame(loop); }
  });
  build();
  if (!reduce) raf = requestAnimationFrame(loop);
})();

// ---------- The player ----------
interface LiveItem { kind: 'live'; id: string; name: string; sub: string; image?: string; streams: string[]; now: string; onDead?: () => void }
interface EpItem { kind: 'episode'; id: string; title: string; show: string; image?: string; src: string; next?: () => EpItem | null }
type Item = LiveItem | EpItem;
type PState = 'idle' | 'connecting' | 'playing' | 'paused';

let pageSyncs: (() => void)[] = [];
const onPlayerChange = (f: () => void) => { pageSyncs.push(f); f(); };

const Player = (() => {
  const audio = $<HTMLAudioElement>('player-audio');
  const dock = $('dock');
  if (!audio || !dock) return null;
  const el = {
    logo: $('dock-logo')!, live: $('dock-live')!, sub: $('dock-sub')!, title: $('dock-title')!, artist: $('dock-artist')!,
    progress: $('dock-progress')!, cur: $('dock-cur')!, dur: $('dock-dur')!, seek: $<HTMLInputElement>('dock-seek')!,
    vol: $<HTMLInputElement>('dock-vol')!, back: $('dock-back')!, fwd: $('dock-fwd')!, toggle: $('dock-toggle')!, icon: document.getElementById('dock-icon')!,
  };
  let item: Item | null = null, state: PState = 'idle', tries = 0, nowTimer = 0, song = { title: '', artist: '' }, dragging = false;

  function render() {
    const it = item;
    dock!.hidden = !it;
    if (!it) return;
    dock!.classList.toggle('connecting', state === 'connecting');
    el.icon.setAttribute('d', state === 'playing' || state === 'connecting' ? PAUSE_D : PLAY_D);
    el.toggle.setAttribute('aria-label', state === 'playing' || state === 'connecting' ? 'Pause' : 'Play');
    el.logo.classList.toggle('has-logo', !!it.image);
    el.logo.style.backgroundImage = it.image ? `url("${it.image}")` : '';
    const live = it.kind === 'live';
    el.live.hidden = !(live && state === 'playing');
    el.progress.hidden = live; el.back.hidden = live; el.fwd.hidden = live;
    if (live) {
      el.sub.textContent = it.name;
      el.title.textContent = song.title || it.name;
      el.artist.textContent = state === 'connecting' ? 'Connecting…' : song.title ? song.artist : it.sub;
    } else {
      el.sub.textContent = it.show;
      el.title.textContent = it.title;
      el.artist.textContent = state === 'connecting' ? 'Loading…' : '';
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: live ? song.title || it.name : it.title,
        artist: live ? song.artist || it.name : it.show,
        album: 'ThereYouAreJesus.com', artwork: it.image ? [{ src: it.image, sizes: '512x512' }] : [],
      });
    }
  }
  function emit() { render(); pageSyncs.forEach((f) => f()); }

  async function refreshNow() {
    const it = item;
    if (!it || it.kind !== 'live' || state !== 'playing') return;
    try {
      const r = await fetch(`/api/radio/now?${it.now}`);
      const n = r.ok ? await r.json() : {};
      if (item !== it) return;
      song = n.title ? { title: n.title, artist: n.artist || '' } : { title: '', artist: '' };
      render();
    } catch { /* keep what's showing */ }
  }
  function tryStream() {
    const it = item;
    if (!it || it.kind !== 'live') return;
    if (tries >= it.streams.length) { close(); it.onDead?.(); return; }
    const src = it.streams[tries];
    audio!.src = src;
    audio!.play().catch((err: DOMException) => { if (err?.name !== 'AbortError') advance(src); });
  }
  function advance(failedSrc: string) {
    if (!item || item.kind !== 'live' || audio!.getAttribute('src') !== failedSrc) return;
    tries++; tryStream();
  }
  function startLive() { tries = 0; state = 'connecting'; emit(); tryStream(); }
  // Pausing live radio disconnects; playing again rejoins what's on now.
  function pauseLive() { audio!.pause(); audio!.removeAttribute('src'); audio!.load(); clearInterval(nowTimer); state = 'paused'; emit(); }

  function play(it: Item) {
    if (item && item.id === it.id) { toggle(); return; }
    audio!.pause(); clearInterval(nowTimer);
    item = it; song = { title: '', artist: '' };
    audio!.volume = +el.vol.value;
    if (it.kind === 'live') { startLive(); return; }
    state = 'connecting'; emit();
    audio!.src = it.src; audio!.playbackRate = 1;
    audio!.play().catch((err: DOMException) => {
      if (err?.name === 'AbortError' || item !== it) return;
      state = 'paused'; render(); el.artist.textContent = "This episode couldn't play. Try another one.";
      pageSyncs.forEach((f) => f());
    });
  }
  function toggle() {
    if (!item) return;
    if (item.kind === 'live') { if (state === 'playing' || state === 'connecting') pauseLive(); else startLive(); return; }
    if (audio!.paused) { audio!.play().catch(() => {}); } else audio!.pause();
  }
  function close() {
    audio!.pause(); audio!.removeAttribute('src'); audio!.load(); clearInterval(nowTimer);
    item = null; state = 'idle'; song = { title: '', artist: '' };
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    emit();
  }

  audio.addEventListener('playing', () => {
    if (!item) return;
    state = 'playing'; emit();
    if (item.kind === 'live') { refreshNow(); clearInterval(nowTimer); nowTimer = window.setInterval(refreshNow, 20000); }
  });
  audio.addEventListener('pause', () => { if (item?.kind === 'episode' && state !== 'idle') { state = 'paused'; emit(); } });
  audio.addEventListener('waiting', () => { if (item && audio.getAttribute('src') && state === 'playing') { state = 'connecting'; emit(); } });
  audio.addEventListener('error', () => {
    const src = audio.getAttribute('src');
    if (!item || !src) return;
    if (item.kind === 'live') advance(src);
    else { state = 'paused'; render(); el.artist.textContent = "This episode couldn't play. Try another one."; pageSyncs.forEach((f) => f()); }
  });
  audio.addEventListener('loadedmetadata', () => { if (item?.kind === 'episode') el.dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    if (item?.kind !== 'episode' || !audio.duration || dragging) return;
    el.seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000)); el.cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended', () => {
    if (item?.kind !== 'episode') return;
    const nxt = item.next?.();
    if (nxt) play(nxt); else { state = 'paused'; emit(); }
  });
  el.seek.addEventListener('pointerdown', () => { dragging = true; });
  el.seek.addEventListener('pointerup', () => { dragging = false; });
  el.seek.addEventListener('input', () => { if (audio.duration) { audio.currentTime = (+el.seek.value / 1000) * audio.duration; el.cur.textContent = fmt(audio.currentTime); } });
  el.back.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
  el.fwd.addEventListener('click', () => { if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 30); });
  el.toggle.addEventListener('click', toggle);
  $('dock-close')!.addEventListener('click', close);
  el.vol.addEventListener('input', () => { audio.volume = +el.vol.value; });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => toggle());
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('seekbackward', () => { if (item?.kind === 'episode') audio.currentTime = Math.max(0, audio.currentTime - 15); });
    navigator.mediaSession.setActionHandler('seekforward', () => { if (item?.kind === 'episode') audio.currentTime += 30; });
  }
  return {
    play, toggle, close,
    isCurrent: (id: string) => item?.id === id,
    isPlaying: (id: string) => item?.id === id && (state === 'playing' || state === 'connecting'),
  };
})();

// Sets a play/pause icon and label on a button that plays something.
function syncButton(b: HTMLElement, id: string, name: string) {
  const on = !!Player?.isPlaying(id);
  b.setAttribute('aria-pressed', String(!!Player?.isCurrent(id)));
  const svg = b.querySelector('svg');
  if (svg) svg.outerHTML = icon(on ? PAUSE_D : PLAY_D);
  b.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + name);
}

// ---------- Page features ----------
function initNotice() {
  const n = $('site-notice');
  $('notice-close')?.addEventListener('click', () => { if (n) n.hidden = true; try { localStorage.setItem('tyaj-notice-dismissed', '1'); } catch { /* private mode */ } });
}

function initMenu() {
  const menuBtn = document.querySelector<HTMLButtonElement>('.menu-btn');
  const nav = $('nav');
  if (!menuBtn || !nav) return;
  const close = () => { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu'; };
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.textContent = open ? 'Close' : 'Menu';
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  // Dropdowns: open on hover or focus on larger screens; the arrow button toggles them for touch and keyboard.
  const groups = Array.from(nav.querySelectorAll<HTMLElement>('.nav-group'));
  const shut = (except?: HTMLElement) => groups.forEach((g) => { if (g !== except) { g.classList.remove('open'); g.querySelector('.nav-caret')?.setAttribute('aria-expanded', 'false'); } });
  groups.forEach((g) => {
    const caret = g.querySelector<HTMLButtonElement>('.nav-caret');
    caret?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !g.classList.contains('open');
      shut(g); g.classList.toggle('open', open); caret.setAttribute('aria-expanded', String(open));
    });
    g.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shut(); caret?.focus(); } });
  });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target as Node)) shut(); });
}

function initSpirits() {
  // ---------- Seven Spirits (hero flames + lampstand) ----------
  interface Spirit { name: string; verse: string; ref: string; meaning: string }
  const spirits = readJSON<Spirit[]>('spirits-data', []);
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.lamp-btn'));
  const panel = $('sp-panel');
  let current = 3;
  function selectSpirit(i: number, focus = false) {
    if (!panel || !spirits[i]) return;
    current = i;
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
    if (focus) tabs[i]?.focus();
    panel.setAttribute('aria-labelledby', `sp-tab-${i}`);
    $('sp-pos')!.textContent = i === 3 ? 'The center flame' : `Spirit ${i + 1} of 7`;
    $('sp-name')!.textContent = spirits[i].name;
    $('sp-verse')!.textContent = spirits[i].verse ? `“${spirits[i].verse}”` : '';
    $('sp-ref')!.textContent = spirits[i].ref ? `${spirits[i].ref} (KJV)` : '';
    $('sp-meaning')!.textContent = spirits[i].meaning;
    panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
  }
  if (panel) {
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectSpirit(i));
      t.addEventListener('keydown', (e) => {
        const map: Record<string, number> = { ArrowRight: (current + 1) % 7, ArrowLeft: (current + 6) % 7, Home: 0, End: 6 };
        if (e.key in map) { e.preventDefault(); selectSpirit(map[e.key], true); }
      });
    });
    $('sp-prev')?.addEventListener('click', () => selectSpirit((current + 6) % 7));
    $('sp-next')?.addEventListener('click', () => selectSpirit((current + 1) % 7));
    selectSpirit(3);
  }
  const flames = Array.from(document.querySelectorAll<HTMLButtonElement>('.flame'));
  const nameEl = $('spirit-name'), hintEl = $('spirit-hint');
  if (flames.length && nameEl && hintEl) {
    const defName = nameEl.textContent || '', defHint = hintEl.textContent || '';
    flames.forEach((b, i) => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') === 'true';
      flames.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      if (on) { nameEl.textContent = defName; hintEl.textContent = defHint; return; }
      b.setAttribute('aria-pressed', 'true');
      nameEl.textContent = spirits[i]?.name || '';
      hintEl.innerHTML = (i === 3 ? 'The center flame. ' : `Spirit ${i + 1} of 7. `) + '<a href="#spirits">Read about this spirit</a>';
      selectSpirit(i);
    }));
  }
}

function initPosts() {
  // ---------- Latest posts filter ----------
  const postList = $('posts');
  if (postList) {
    const items = Array.from(postList.querySelectorAll<HTMLLIElement>('li[data-cats]'));
    const empty = $('posts-empty');
    document.querySelectorAll<HTMLButtonElement>('#post-filters .chip').forEach((chip, _, all) => {
      chip.addEventListener('click', () => {
        all.forEach((c) => c.setAttribute('aria-pressed', 'false')); chip.setAttribute('aria-pressed', 'true');
        const cat = chip.dataset.cat || 'all'; let shown = 0;
        items.forEach((li) => {
          const match = cat === 'all' || (li.dataset.cats || '').split(' ').includes(cat);
          li.hidden = !(match && shown < 6); if (match && shown < 6) shown++;
        });
        if (empty) empty.hidden = shown > 0;
      });
    });
  }
}

function initKit() {
  // ---------- Email signup (Kit) ----------
  document.querySelectorAll<HTMLFormElement>('.kit-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[type=email]')!;
      const msg = form.querySelector<HTMLElement>('.form-msg')!;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) { msg.textContent = 'Enter a full email address, like you@example.com.'; input.focus(); return; }
      const action = form.dataset.kit;
      if (!action) { msg.textContent = 'Email signup opens soon. In the meantime, follow along on Facebook or YouTube.'; return; }
      msg.textContent = 'Subscribing…';
      try {
        await fetch(action, { method: 'POST', body: new FormData(form), mode: 'no-cors' });
        msg.textContent = 'Subscribed. Check your inbox to confirm.'; form.reset();
      } catch { msg.textContent = "That didn't go through. Check your connection and try again."; }
    });
  });
  document.querySelectorAll<HTMLAnchorElement>('a[data-pending]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); const n = $('join-note'); if (n) n.textContent = a.dataset.pending || '';
  }));
}

// John's podcast on the homepage
interface TyajEpisode { title: string; dateLabel: string; minutes: number; description: string; audio: string; link: string }
function initPodcast() {
  const list = $('eps'), playBtn = $('play');
  if (!list || !playBtn || !Player) return;
  let episodes = readJSON<TyajEpisode[]>('podcast-data', []), cur = 0;
  const show = 'There You Are Jesus: The Modern Day Evidence';
  const art = (document.querySelector('.show-art') as HTMLElement | null)?.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] || '';
  const itemFor = (i: number): EpItem | null => {
    const e = episodes[i];
    return e && e.audio ? { kind: 'episode', id: `tyaj:${e.audio}`, title: e.title, show, image: art, src: e.audio, next: () => { select(i + 1); return itemFor(i + 1); } } : null;
  };
  function select(i: number) {
    const e = episodes[i]; if (!e) return; cur = i;
    $('np-title')!.textContent = e.title;
    $('np-meta')!.textContent = [e.dateLabel, e.minutes ? `${e.minutes} min` : ''].filter(Boolean).join(', ');
    $('np-desc')!.textContent = e.description;
    list!.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    sync();
  }
  function sync() {
    const e = episodes[cur];
    const id = e ? `tyaj:${e.audio}` : '';
    const on = !!Player!.isPlaying(id);
    document.getElementById('play-icon')?.setAttribute('d', on ? PAUSE_D : PLAY_D);
    playBtn!.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }
  function render() {
    $('ep-count')!.textContent = episodes.length ? `${episodes.length} episodes, newest first` : '';
    list!.innerHTML = '';
    episodes.forEach((e, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<button type="button"><span class="t"></span><span class="d"></span><span class="m"></span></button>';
      li.querySelector('.t')!.textContent = e.title; li.querySelector('.d')!.textContent = e.dateLabel;
      li.querySelector('.m')!.textContent = e.minutes ? `${e.minutes} min` : '';
      li.querySelector('button')!.addEventListener('click', () => { select(i); const it = itemFor(i); if (it) Player!.play(it); });
      list!.appendChild(li);
    });
    if (episodes.length) select(Math.min(cur, episodes.length - 1));
    else $('np-title')!.textContent = 'Episodes are loading';
  }
  playBtn.addEventListener('click', () => { const it = itemFor(cur); if (it) Player!.play(it); else $('pod-status')!.textContent = 'This episode has no audio file yet.'; });
  render();
  onPlayerChange(sync);
  fetch('/api/podcast').then((r) => (r.ok ? r.json() : null)).then((fresh) => {
    if (Array.isArray(fresh) && fresh.length && (fresh.length !== episodes.length || fresh[0].title !== episodes[0]?.title)) { episodes = fresh; cur = 0; render(); }
  }).catch(() => {});
}

// Featured stations on the homepage
interface LiveStation { key: string; name: string; genre: string; description: string; site: string; streams: string[]; image: string }
function initFeaturedRadio() {
  const listEl = $('stations'), statusEl = $('radio-status');
  if (!listEl || !statusEl || !Player) return;
  const list = listEl, status = statusEl;
  const data = new Map<string, LiveStation>();
  let loaded: Promise<boolean> | null = null;
  const buttons = () => Array.from(list.querySelectorAll<HTMLButtonElement>('button.station'));
  const hideEmptyFilters = () => document.querySelectorAll<HTMLButtonElement>('#radio-filters .chip').forEach((chip) => {
    if (chip.dataset.g !== 'All') chip.hidden = !list.querySelector(`li[data-g="${CSS.escape(chip.dataset.g || '')}"]`);
  });
  const removeCard = (b: HTMLElement) => { b.closest('li')?.remove(); hideEmptyFilters(); };
  function load() {
    loaded ??= fetch('/api/radio').then((r) => (r.ok ? r.json() : null)).then((d: { stations: LiveStation[] } | null) => {
      if (!d) return false;
      d.stations.forEach((st) => data.set(st.key, st));
      // Only stations with a working live stream stay on the page.
      buttons().forEach((b) => {
        const st = data.get(b.dataset.key || '');
        if (!st) { removeCard(b); return; }
        if (st.image) { const pb = b.querySelector<HTMLElement>('.pb')!; pb.classList.add('has-logo'); pb.style.backgroundImage = `url("${st.image}")`; }
      });
      hideEmptyFilters();
      if (!list.querySelector('li')) status.textContent = 'Featured stations are resting right now. Browse all Christian radio below.';
      return true;
    }).catch(() => false);
    return loaded;
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: '800px' });
    io.observe($('radio')!);
  } else load();
  buttons().forEach((b) => b.addEventListener('click', async () => {
    const id = `feat:${b.dataset.key}`;
    if (Player.isCurrent(id)) { Player.toggle(); return; }
    status.textContent = '';
    const ok = await load();
    const st = data.get(b.dataset.key || '');
    if (!ok || !st) { status.textContent = "Live radio couldn't load. Check your connection and try again."; return; }
    Player.play({
      kind: 'live', id, name: st.name, sub: st.genre ? `${st.genre}, live` : 'Live', image: st.image, streams: st.streams, now: `key=${encodeURIComponent(st.key)}`,
      onDead: () => { removeCard(b); status.textContent = `${st.name} isn't available right now, so it's been removed from the list.`; },
    });
  }));
  document.querySelectorAll<HTMLButtonElement>('#radio-filters .chip').forEach((chip, _, all) => chip.addEventListener('click', () => {
    all.forEach((c) => c.setAttribute('aria-pressed', 'false')); chip.setAttribute('aria-pressed', 'true');
    const g = chip.dataset.g;
    list.querySelectorAll<HTMLLIElement>('li').forEach((li) => { li.hidden = !(g === 'All' || li.dataset.g === g); });
  }));
  onPlayerChange(() => buttons().forEach((b) => syncButton(b, `feat:${b.dataset.key}`, b.dataset.name || 'station')));
}

// The full radio directory page
interface DirStation { i: string; n: string; u: string; f: string; c: string; r: string; l: string; g: string; s: string; k: number }
function initRadioDir() {
  const listEl = $('rd-list'), count = $('rd-count'), more = $<HTMLButtonElement>('rd-more');
  const q = $<HTMLInputElement>('rd-q'), region = $<HTMLSelectElement>('rd-region'), genre = $<HTMLSelectElement>('rd-genre'), lang = $<HTMLSelectElement>('rd-lang');
  if (!listEl || !count || !more || !q || !region || !genre || !lang || !Player) return;
  const list = listEl;
  let all: DirStation[] = [], shown = 0, filtered: DirStation[] = [];
  const dead = new Set<string>();
  const PAGE = 48;
  const params = new URLSearchParams(location.search);

  function fillSelect(sel: HTMLSelectElement, key: 'r' | 'g' | 'l', limit = 999) {
    const counts = new Map<string, number>();
    all.forEach((s) => counts.set(s[key], (counts.get(s[key]) || 0) + 1));
    [...counts.entries()].sort((a, b) => (a[0] === 'Other' ? 1 : b[0] === 'Other' ? -1 : b[1] - a[1])).slice(0, limit).forEach(([v, n]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = `${v} (${n.toLocaleString()})`; sel.appendChild(o);
    });
  }
  function apply() {
    const term = q!.value.trim().toLowerCase();
    filtered = all.filter((s) => !dead.has(s.i)
      && (!region!.value || s.r === region!.value) && (!genre!.value || s.g === genre!.value) && (!lang!.value || s.l === lang!.value)
      && (!term || `${s.n} ${s.c} ${s.s}`.toLowerCase().includes(term)));
    shown = 0; list.innerHTML = ''; renderMore();
    count!.textContent = filtered.length ? `${filtered.length.toLocaleString()} station${filtered.length === 1 ? '' : 's'}` : 'No stations match. Try another region, genre or language.';
    const p = new URLSearchParams();
    if (region!.value) p.set('region', region!.value); if (genre!.value) p.set('genre', genre!.value); if (lang!.value) p.set('language', lang!.value); if (term) p.set('q', q!.value.trim());
    history.replaceState(history.state, '', p.toString() ? `?${p}` : location.pathname);
  }
  function card(s: DirStation) {
    const li = document.createElement('li');
    li.innerHTML = `<button class="station" type="button" aria-pressed="false"><span class="pb${s.f ? ' has-logo' : ''}">${icon(PLAY_D)}</span><span class="g">${esc(s.g)}</span><span class="nm">${esc(s.n)}</span><span class="loc">${esc([s.s, s.c].filter(Boolean).join(', ') || s.r)}${s.l && s.l !== 'Other' ? `, ${esc(s.l)}` : ''}</span></button>`;
    const b = li.querySelector('button')!;
    if (s.f) b.querySelector<HTMLElement>('.pb')!.style.backgroundImage = `url("${s.f}")`;
    b.dataset.id = `dir:${s.i}`; b.dataset.name = s.n;
    b.addEventListener('click', () => Player!.play({
      kind: 'live', id: `dir:${s.i}`, name: s.n, sub: [s.c, s.l !== 'Other' ? s.l : ''].filter(Boolean).join(', ') || 'Live', image: s.f, streams: [s.u],
      now: `url=${encodeURIComponent(s.u)}`,
      onDead: () => { dead.add(s.i); li.remove(); count!.textContent = `${s.n} isn't available right now, so it's been removed.`; },
    }));
    syncButton(b, `dir:${s.i}`, s.n);
    return li;
  }
  function renderMore() {
    const frag = document.createDocumentFragment();
    filtered.slice(shown, shown + PAGE).forEach((s) => frag.appendChild(card(s)));
    list.appendChild(frag); shown += PAGE; more!.hidden = shown >= filtered.length;
  }
  let t = 0;
  q.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(apply, 200); });
  [region, genre, lang].forEach((s) => s.addEventListener('change', apply));
  more.addEventListener('click', renderMore);
  fetch('/radio/directory.json').then((r) => (r.ok ? r.json() : { stations: [] })).then((d: { stations: DirStation[] }) => {
    all = d.stations || [];
    if (!all.length) { count!.textContent = 'The station directory is updating. Please check back in a few minutes.'; return; }
    fillSelect(region!, 'r'); fillSelect(genre!, 'g'); fillSelect(lang!, 'l', 40);
    region!.value = params.get('region') || ''; genre!.value = params.get('genre') || ''; lang!.value = params.get('language') || ''; q!.value = params.get('q') || '';
    apply();
  }).catch(() => { count!.textContent = "Stations couldn't load. Check your connection and refresh the page."; });
  onPlayerChange(() => list.querySelectorAll<HTMLButtonElement>('button.station').forEach((b) => syncButton(b, b.dataset.id || '', b.dataset.name || 'station')));
}

// Discover podcasts page
interface Pod { id: string; title: string; author: string; art: string; summary: string; rank: number; regions?: number; url: string }
interface ShowEp { title: string; date: string; minutes: number; description: string; audio: string; art: string }
interface ShowData extends Pod { description: string; episodes: ShowEp[] }
function initPodDir() {
  const gridEl = $('pd-grid'), count = $('pd-count'), form = $<HTMLFormElement>('pd-form');
  const q = $<HTMLInputElement>('pd-q'), region = $<HTMLSelectElement>('pd-region'), sort = $<HTMLSelectElement>('pd-sort');
  if (!gridEl || !count || !form || !q || !region || !sort || !Player) return;
  const grid = gridEl;
  let pods: Pod[] = [], openId = '', req = 0;
  const params = new URLSearchParams(location.search);
  region.value = params.get('region') || 'all'; sort.value = params.get('sort') || 'rank'; q.value = params.get('q') || '';
  const regionName = () => region!.selectedOptions[0]?.textContent || '';

  async function load() {
    const my = ++req;
    const term = q!.value.trim();
    count!.textContent = term ? `Searching for “${term}”…` : 'Loading podcasts…';
    grid.innerHTML = ''; openId = '';
    const cc = region!.value;
    const url = term ? `/api/podcasts/search?q=${encodeURIComponent(term)}&cc=${cc === 'all' ? 'us' : cc}` : `/api/podcasts/top?cc=${cc}`;
    const p = new URLSearchParams(); if (cc !== 'all') p.set('region', cc); if (sort!.value !== 'rank') p.set('sort', sort!.value); if (term) p.set('q', term);
    history.replaceState(history.state, '', p.toString() ? `?${p}` : location.pathname);
    try {
      const r = await fetch(url); const d = r.ok ? await r.json() : [];
      if (my !== req) return;
      pods = Array.isArray(d) ? d : [];
      render(term);
    } catch { if (my === req) count!.textContent = "Podcasts couldn't load. Check your connection and try again."; }
  }
  function render(term: string) {
    const list = sort!.value === 'az' ? [...pods].sort((a, b) => a.title.localeCompare(b.title)) : pods;
    count!.textContent = list.length
      ? term ? `${list.length} Christian podcast${list.length === 1 ? '' : 's'} matching “${term}”` : region!.value === 'all' ? 'Most popular Christian podcasts worldwide' : `Top Christian podcasts in ${regionName()}`
      : term ? `No Christian podcasts match “${term}”. Try another name or topic.` : 'No podcasts found for this region. Try another.';
    grid.innerHTML = '';
    list.forEach((p) => {
      const li = document.createElement('li'); li.dataset.id = p.id;
      const rank = term ? '' : region!.value === 'all' ? `#${p.rank} worldwide` : `#${p.rank} in ${regionName()}`;
      li.innerHTML = `<button class="pod-tile" type="button" aria-expanded="false">${p.art ? `<img src="${esc(p.art)}" alt="" loading="lazy" decoding="async">` : '<span class="noart"></span>'}${rank ? `<span class="rk">${esc(rank)}</span>` : ''}<span class="tt">${esc(p.title)}</span><span class="au">${esc(p.author)}</span></button>`;
      li.querySelector('button')!.addEventListener('click', () => toggleDetail(p, li));
      grid.appendChild(li);
    });
  }
  function closeDetail() {
    grid.querySelector('.pod-detail')?.remove();
    grid.querySelectorAll('.pod-tile').forEach((t) => t.setAttribute('aria-expanded', 'false'));
    openId = '';
  }
  // The details open on the row right below the tapped tile.
  function placeAfterRow(li: HTMLElement, panel: HTMLElement) {
    const tiles = Array.from(grid.querySelectorAll<HTMLLIElement>('li[data-id]'));
    const top = li.offsetTop;
    let last = li;
    for (const t of tiles) if (t.offsetTop === top) last = t;
    last.after(panel);
  }
  async function toggleDetail(p: Pod, li: HTMLLIElement) {
    if (openId === p.id) { closeDetail(); return; }
    closeDetail(); openId = p.id;
    li.querySelector('.pod-tile')!.setAttribute('aria-expanded', 'true');
    const panel = document.createElement('li'); panel.className = 'pod-detail'; panel.dataset.for = p.id;
    panel.innerHTML = `<div class="top">${p.art ? `<img src="${esc(p.art)}" alt="">` : '<span></span>'}<div><h3>${esc(p.title)}</h3><p class="by">${esc(p.author)}</p><p class="desc">${esc(p.summary)}</p><div class="acts"></div></div><button class="x" type="button" aria-label="Close">×</button></div><p class="loading">Loading episodes…</p>`;
    panel.querySelector('.x')!.addEventListener('click', closeDetail);
    placeAfterRow(li, panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const cc = region!.value === 'all' ? 'us' : region!.value;
    try {
      const r = await fetch(`/api/podcasts/show?id=${encodeURIComponent(p.id)}&cc=${cc}`);
      const s: ShowData | null = r.ok ? await r.json() : null;
      if (openId !== p.id) return;
      const loading = panel.querySelector('.loading')!;
      if (!s || !s.episodes?.length) { loading.textContent = "Episodes couldn't load for this show."; return; }
      if (s.description) panel.querySelector('.desc')!.textContent = s.description;
      const itemFor = (i: number): EpItem | null => {
        const e = s.episodes[i];
        return e ? { kind: 'episode', id: `pod:${s.id}:${e.audio}`, title: e.title, show: s.title, image: e.art || s.art, src: e.audio, next: () => itemFor(i + 1) } : null;
      };
      const acts = panel.querySelector('.acts')!;
      acts.innerHTML = `<button class="btn btn-gold" type="button">Play latest episode</button>${s.url ? `<a class="text-link" href="${esc(s.url)}" target="_blank" rel="noopener">Open in Apple Podcasts</a>` : ''}`;
      acts.querySelector('button')!.addEventListener('click', () => { const it = itemFor(0); if (it) Player!.play(it); });
      const ul = document.createElement('ul'); ul.className = 'ep-list';
      s.episodes.forEach((e, i) => {
        const row = document.createElement('li');
        const when = e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        row.innerHTML = `<button class="epb" type="button" aria-pressed="false">${icon(PLAY_D)}</button><span class="et">${esc(e.title)}</span><span class="ed">${esc([when, e.description].filter(Boolean).join('. '))}</span><span class="em">${e.minutes ? `${e.minutes} min` : ''}</span>`;
        const b = row.querySelector<HTMLButtonElement>('.epb')!;
        b.dataset.id = `pod:${s.id}:${e.audio}`; b.dataset.name = e.title;
        b.addEventListener('click', () => { const it = itemFor(i); if (it) Player!.play(it); });
        ul.appendChild(row);
      });
      loading.replaceWith(ul);
      syncEpisodes();
    } catch { if (openId === p.id) panel.querySelector('.loading')!.textContent = "Episodes couldn't load. Check your connection and try again."; }
  }
  function syncEpisodes() { grid.querySelectorAll<HTMLButtonElement>('.epb').forEach((b) => syncButton(b, b.dataset.id || '', b.dataset.name || 'episode')); }
  let t = 0;
  q.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(load, 500); });
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(t); load(); });
  region.addEventListener('change', load);
  sort.addEventListener('change', () => { closeDetail(); render(q!.value.trim()); const p = new URL(location.href); if (sort!.value === 'rank') p.searchParams.delete('sort'); else p.searchParams.set('sort', sort!.value); history.replaceState(history.state, '', p); });
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      const panel = grid.querySelector<HTMLElement>('.pod-detail');
      const li = panel && grid.querySelector<HTMLLIElement>(`li[data-id="${CSS.escape(panel.dataset.for || '')}"]`);
      if (panel && li) placeAfterRow(li, panel);
    }, 150);
  });
  onPlayerChange(syncEpisodes);
  load();
}


// ---------- Bible ----------
type Mode = 'kjv' | 'bbe' | 'both';
interface StudyNote { verse_key: string; label: string; verse_text: string; note: string; highlight: string; saved: boolean; updated_at?: string }
const dayIndex = (n: number) => Math.floor(Date.now() / 86400000) % n;

function initVotdHome() {
  const box = $('votd-home');
  if (!box) return;
  const daily = ['Isaiah 11:2', 'Revelation 4:5', 'John 3:16', 'Psalm 23:1', 'Proverbs 3:5', 'James 1:5', 'Philippians 4:13', 'Romans 8:28', 'Jeremiah 29:11', 'Joshua 1:9', 'Matthew 11:28', 'Psalm 46:10', 'Isaiah 40:31', 'Revelation 5:6', 'Hebrews 11:1', 'Psalm 32:8', '1 Corinthians 13:4', 'Romans 12:2', 'Galatians 5:22', 'Proverbs 9:10', 'Micah 6:8', 'Lamentations 3:22', 'John 14:6', 'Revelation 1:4', 'Zechariah 4:6', 'Psalm 119:105', 'Matthew 6:33', '2 Timothy 1:7', 'Ephesians 2:8', 'Job 32:8', 'Acts 1:8'];
  const ref = daily[dayIndex(daily.length)];
  fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d?.kjv?.length) return;
    $('vh-text')!.textContent = `“${d.kjv.map((v: { text: string }) => v.text).join(' ')}”`;
    $('vh-alt')!.textContent = d.bbe?.length ? `In Basic English: “${d.bbe.map((v: { text: string }) => v.text).join(' ')}”` : '';
    $('vh-ref')!.textContent = `${d.ref.label} (KJV)`;
    ($('vh-link') as HTMLAnchorElement).href = `/bible/?ref=${encodeURIComponent(d.ref.label)}`;
    box.hidden = false;
  }).catch(() => {});
}

function initBibleApp() {
  const app = $('bible-app');
  if (!app) return;
  const BOOKS: [string, number][] = JSON.parse(app.dataset.books || '[]');
  const DAILY: string[] = JSON.parse(app.dataset.daily || '[]');
  const PATHS: { title: string; about: string; refs: string[] }[] = JSON.parse(app.dataset.paths || '[]');
  const bookSel = $<HTMLSelectElement>('bb-book')!, chSel = $<HTMLSelectElement>('bb-ch')!, versesEl = $('verses')!, title = $('ch-title')!;
  const results = $('bible-results')!, reader = $('bible-read')!, sheet = $('verse-sheet')!, msg = $('vs-msg')!, study = $('study-body')!;
  const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  let b = 42, c = 1, mode: Mode = (store.get('tyaj-bible-mode') as Mode) || 'kjv';
  let text: { kjv?: string[]; bbe?: string[] } = {}, openV = 0;
  const notes = new Map<string, StudyNote>();
  const nameOf = (bi: number) => (BOOKS[bi][0] === 'Psalms' ? 'Psalm' : BOOKS[bi][0]);
  const labelOf = (bi: number, ci: number, v?: number) => `${v ? nameOf(bi) : BOOKS[bi][0]} ${ci}${v ? `:${v}` : ''}`;
  const keyOf = (v: number) => `${b}.${c}.${v}`;
  const shareUrl = (label: string) => `${location.origin}/bible/?ref=${encodeURIComponent(label)}`;

  // --- account (Passion and Devout members) ---
  let sb: any = null, user: any = null, tier = 'free';
  const isMember = () => !!user && (tier === 'passion' || tier === 'devout');
  async function setupAccount() {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { study.innerHTML = '<p>Saving verses, highlights and study notes is coming soon for Passion and Devout members.</p>'; return; }
    try {
      const { createClient } = await import('@supabase/supabase-js');
      sb = createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
      const { data } = await sb.auth.getSession();
      await setUser(data.session?.user || null);
      sb.auth.onAuthStateChange((_e: string, session: any) => { if ((session?.user?.id || null) !== (user?.id || null)) setUser(session?.user || null); });
    } catch { study.innerHTML = "<p>Study tools couldn't load. Refresh the page to try again.</p>"; }
  }
  async function setUser(u: any) {
    user = u; tier = 'free'; notes.clear();
    if (user) {
      const { data } = await sb.from('memberships').select('tier').maybeSingle();
      tier = data?.tier || 'free';
    }
    await loadNotes(); renderStudy(); paintVerses();
  }
  async function loadNotes() {
    notes.clear();
    if (!isMember()) return;
    const { data } = await sb.from('bible_notes').select('*').like('verse_key', `${b}.${c}.%`);
    (data || []).forEach((n: StudyNote) => notes.set(n.verse_key, n));
  }
  async function renderStudy() {
    if (!sb) return;
    if (!user) {
      study.innerHTML = `<p>Passion and Devout members can save verses, highlight and keep study notes here. Sign in with the email you joined with.</p>
        <form class="study-signin" id="study-signin"><label for="st-email" class="sr-only">Email</label><input id="st-email" type="email" placeholder="you@example.com" autocomplete="email"><button class="btn btn-ink" type="submit">Email me a sign-in link</button><p class="form-msg" id="st-msg" aria-live="polite"></p></form>
        <p style="margin-top:10px"><a class="text-link" href="/#join">See membership options</a></p>`;
      $('study-signin')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $<HTMLInputElement>('st-email')!.value.trim(), out = $('st-msg')!;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { out.textContent = 'Enter a full email address, like you@example.com.'; return; }
        out.textContent = 'Sending…';
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/bible/` } });
        out.textContent = error ? "That didn't send. Check the address and try again." : 'Check your email for a sign-in link.';
      });
      return;
    }
    if (!isMember()) {
      study.innerHTML = `<p>Signed in as ${esc(user.email)}. Your account doesn't include study tools yet. Passion and Devout members can save verses, highlight and write notes.</p>
        <div class="study-actions"><a class="btn btn-gold" href="/#join">Become a member</a><button class="btn-line" type="button" id="st-out">Sign out</button></div>
        <p class="radio-note">Already a member? Join and sign in with the same email address, and allow a minute for your membership to connect.</p>`;
      $('st-out')!.addEventListener('click', () => sb.auth.signOut());
      return;
    }
    const { data } = await sb.from('bible_notes').select('*').order('updated_at', { ascending: false }).limit(300);
    const rows: StudyNote[] = data || [];
    study.innerHTML = `<p>Signed in as ${esc(user.email)}.</p>${rows.length ? `<ul class="study-list">${rows.map((n) => `<li><a href="/bible/?ref=${encodeURIComponent(n.label)}" data-label="${esc(n.label)}">${esc(n.label)}</a>${n.saved ? ' <span class="has-note">saved</span>' : ''}${n.note ? `<p>${esc(n.note.slice(0, 140))}</p>` : ''}</li>`).join('')}</ul>` : '<p>Tap any verse to save it, highlight it or write a note.</p>'}
      <div class="study-actions">${rows.length ? '<button class="btn-line" type="button" id="st-export">Download my notes</button>' : ''}<button class="btn-line" type="button" id="st-out">Sign out</button></div>`;
    study.querySelectorAll<HTMLAnchorElement>('.study-list a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goRef(a.dataset.label || ''); }));
    $('st-out')!.addEventListener('click', () => sb.auth.signOut());
    $('st-export')?.addEventListener('click', () => {
      const body = rows.map((n) => `${n.label}\n${n.verse_text}\n${n.note ? `Note: ${n.note}\n` : ''}`).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' })); a.download = 'my-bible-notes.txt'; a.click();
    });
  }
  async function saveNote(v: number, patch: Partial<StudyNote>) {
    if (!isMember()) return;
    const k = keyOf(v), cur = notes.get(k);
    const row = { verse_key: k, label: labelOf(b, c, v), verse_text: text.kjv?.[v - 1] || '', note: cur?.note || '', highlight: cur?.highlight || '', saved: cur?.saved || false, ...patch, updated_at: new Date().toISOString() };
    if (!row.note && !row.highlight && !row.saved) {
      await sb.from('bible_notes').delete().eq('verse_key', k); notes.delete(k);
    } else {
      const { error } = await sb.from('bible_notes').upsert({ ...row, user_id: user.id }, { onConflict: 'user_id,verse_key' });
      if (error) { msg.textContent = "That didn't save. Check your connection and try again."; return; }
      notes.set(k, row);
    }
    paintVerses(); syncSheet(); renderStudy();
  }

  // --- reading ---
  function fillChapters() {
    chSel.innerHTML = '';
    for (let i = 1; i <= BOOKS[b][1]; i++) { const o = document.createElement('option'); o.value = String(i); o.textContent = `Chapter ${i}`; chSel.appendChild(o); }
    chSel.value = String(c); bookSel.value = String(b);
  }
  function paintVerses() {
    versesEl.querySelectorAll<HTMLLIElement>('li').forEach((li) => {
      const n = notes.get(keyOf(+li.dataset.v!));
      li.dataset.hl = n?.highlight || '';
      li.querySelector('.has-note')?.remove();
      if (n && (n.note || n.saved)) { const m = document.createElement('span'); m.className = 'has-note'; m.textContent = n.note ? 'note' : 'saved'; li.lastElementChild!.appendChild(m); }
    });
  }
  function render() {
    const main = mode === 'bbe' ? text.bbe : text.kjv;
    title.textContent = labelOf(b, c);
    versesEl.innerHTML = '';
    (main || []).forEach((t, i) => {
      const li = document.createElement('li'); li.dataset.v = String(i + 1); li.tabIndex = 0;
      li.innerHTML = mode === 'both'
        ? `<div class="both"><span><sup>${i + 1}</sup>${esc(t)}</span><span class="b2">${esc(text.bbe?.[i] || '')}</span></div>`
        : `<span><sup>${i + 1}</sup>${esc(t)}</span>`;
      li.addEventListener('click', () => openSheet(i + 1));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(i + 1); } });
      versesEl.appendChild(li);
    });
    paintVerses();
    $<HTMLButtonElement>('ch-prev')!.disabled = b === 0 && c === 1;
    $<HTMLButtonElement>('ch-next')!.disabled = b === BOOKS.length - 1 && c === BOOKS[b][1];
  }
  async function loadChapter(bi: number, ci: number, v?: number) {
    b = bi; c = ci; fillChapters(); closeSheet();
    results.hidden = true; reader.hidden = false;
    title.textContent = 'Loading…'; versesEl.innerHTML = '';
    try {
      const r = await fetch(`/api/bible/chapter?b=${b}&c=${c}&t=kjv,bbe`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (b !== bi || c !== ci) return;
      text = d.text;
    } catch { title.textContent = "This chapter couldn't load. Check your connection and try again."; return; }
    await loadNotes(); render();
    store.set('tyaj-bible-last', `${b}:${c}`);
    history.replaceState(history.state, '', `/bible/?ref=${encodeURIComponent(labelOf(b, c, v))}`);
    if (v) {
      const li = versesEl.querySelector<HTMLLIElement>(`li[data-v="${v}"]`);
      if (li) { li.classList.add('target'); li.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    } else app!.scrollIntoView({ block: 'start' });
  }
  async function goRef(label: string) {
    try {
      const r = await fetch(`/api/bible/search?q=${encodeURIComponent(label)}`);
      const d = await r.json();
      if (d.ref) { loadChapter(d.ref.b, d.ref.c, d.ref.v1); return true; }
    } catch { /* fall through */ }
    return false;
  }

  // --- verse sheet ---
  function syncSheet() {
    if (!openV) return;
    const n = notes.get(keyOf(openV)), member = isMember();
    const save = $<HTMLButtonElement>('vs-save')!;
    save.textContent = n?.saved ? 'Saved' : 'Save';
    sheet.querySelectorAll<HTMLButtonElement>('.hl button').forEach((h) => h.setAttribute('aria-pressed', String((n?.highlight || '') === h.dataset.hl && !!h.dataset.hl)));
    [save, ...Array.from(sheet.querySelectorAll<HTMLButtonElement>('.hl button')), $<HTMLButtonElement>('vs-note-save')!].forEach((x) => x.classList.toggle('locked', !member));
    const ta = $<HTMLTextAreaElement>('vs-note')!; ta.disabled = !member; ta.value = n?.note || '';
    ta.placeholder = member ? 'Write a note on this verse…' : 'Notes are for Passion and Devout members.';
  }
  function openSheet(v: number) {
    openV = v;
    versesEl.querySelectorAll('li').forEach((li) => li.classList.toggle('sel', li.getAttribute('data-v') === String(v)));
    const kjv = text.kjv?.[v - 1] || '', bbe = text.bbe?.[v - 1] || '';
    $('vs-ref')!.textContent = labelOf(b, c, v);
    $('vs-text')!.textContent = mode === 'bbe' ? `“${bbe}” (Basic English)` : `“${kjv}” (KJV)`;
    $('vs-alt')!.textContent = mode === 'bbe' ? (kjv ? `King James: “${kjv}”` : '') : (bbe ? `In Basic English: “${bbe}”` : '');
    msg.textContent = '';
    sheet.hidden = false; syncSheet();
  }
  function closeSheet() { sheet.hidden = true; openV = 0; versesEl.querySelectorAll('li.sel').forEach((li) => li.classList.remove('sel')); }
  const memberGate = () => {
    if (isMember()) return true;
    msg.innerHTML = user ? 'Saving, highlights and notes are part of Passion and Devout memberships. <a class="text-link" href="/#join">Become a member</a>'
      : sb ? 'Saving, highlights and notes are for Passion and Devout members. Sign in under My study, or <a class="text-link" href="/#join">become a member</a>.'
        : 'Saving, highlights and notes for members are coming soon.';
    return false;
  };
  const verseLine = () => { const label = labelOf(b, c, openV); const t = mode === 'bbe' ? text.bbe?.[openV - 1] : text.kjv?.[openV - 1]; return { label, t: t || '', tr: mode === 'bbe' ? 'Basic English' : 'KJV' }; };
  $('vs-close')!.addEventListener('click', closeSheet);
  $('vs-copy')!.addEventListener('click', () => {
    const { label, t, tr } = verseLine();
    navigator.clipboard?.writeText(`“${t}” ${label} (${tr})\n${shareUrl(label)}`).then(() => { msg.textContent = 'Copied.'; }, () => { msg.textContent = "Copying isn't available in this browser."; });
  });
  $('vs-share')!.addEventListener('click', async () => {
    const { label, t, tr } = verseLine();
    const data = { title: label, text: `“${t}” ${label} (${tr})`, url: shareUrl(label) };
    if (navigator.share) { try { await navigator.share(data); } catch { /* closed */ } }
    else { navigator.clipboard?.writeText(`${data.text}\n${data.url}`).then(() => { msg.textContent = 'Link copied. Paste it anywhere to share.'; }); }
  });
  $('vs-save')!.addEventListener('click', () => { if (memberGate()) saveNote(openV, { saved: !notes.get(keyOf(openV))?.saved }); });
  sheet.querySelectorAll<HTMLButtonElement>('.hl button').forEach((h) => h.addEventListener('click', () => { if (memberGate()) saveNote(openV, { highlight: h.dataset.hl || '' }); }));
  $('vs-note-save')!.addEventListener('click', () => { if (memberGate()) { saveNote(openV, { note: $<HTMLTextAreaElement>('vs-note')!.value.trim() }); msg.textContent = 'Note saved.'; } });

  // --- search and study paths ---
  const mark = (t: string, q: string) => {
    let h = esc(t);
    q.split(/\s+/).filter((w) => w.length > 1).forEach((w) => { h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'); });
    return h;
  };
  function showResults(html: string) {
    closeSheet(); results.innerHTML = html; results.hidden = false; reader.hidden = true;
    results.querySelector('#res-back')?.addEventListener('click', () => { results.hidden = true; reader.hidden = false; history.replaceState(history.state, '', `/bible/?ref=${encodeURIComponent(labelOf(b, c))}`); });
    results.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((x) => x.addEventListener('click', () => { const [bi, ci, vi] = (x.dataset.go || '').split('.').map(Number); loadChapter(bi, ci, vi); }));
    results.querySelectorAll<HTMLButtonElement>('[data-ref]').forEach((x) => x.addEventListener('click', () => goRef(x.dataset.ref || '')));
    app!.scrollIntoView({ block: 'start' });
  }
  async function runSearch(q: string, scope: string) {
    if (q.trim().length < 2) return;
    showResults(`<p class="loading">Searching for “${esc(q)}”…</p>`);
    try {
      const r = await fetch(`/api/bible/search?q=${encodeURIComponent(q)}&t=${mode === 'bbe' ? 'bbe' : 'kjv'}&scope=${scope}`);
      const d = await r.json();
      if (d.ref) { loadChapter(d.ref.b, d.ref.c, d.ref.v1); return; }
      if (!r.ok) throw new Error();
      history.replaceState(history.state, '', `/bible/?q=${encodeURIComponent(q)}`);
      showResults(`<div class="results-head"><h2>${d.total ? `${d.total.toLocaleString()} verse${d.total === 1 ? '' : 's'} with “${esc(q)}”` : `No verses contain “${esc(q)}”`}</h2><button class="btn-line" type="button" id="res-back">Back to reading</button></div>
        ${d.total > d.hits.length ? `<p class="dir-count">Showing the first ${d.hits.length}. Add another word to narrow it down.</p>` : ''}
        ${d.total ? '' : '<p class="dir-count">Try fewer words, a different spelling, or the other translation.</p>'}
        <ul class="hits">${d.hits.map((h: any) => `<li><button type="button" data-go="${h.b}.${h.c}.${h.v}"><b>${esc(h.label)}</b>${mark(h.text, q)}</button></li>`).join('')}</ul>`);
    } catch { showResults('<div class="results-head"><h2>Search is unavailable right now</h2><button class="btn-line" type="button" id="res-back">Back to reading</button></div><p class="dir-count">Check your connection and try again.</p>'); }
  }
  async function openPath(i: number) {
    const p = PATHS[i]; if (!p) return;
    showResults(`<p class="loading">Opening ${esc(p.title)}…</p>`);
    const parts = await Promise.all(p.refs.map((ref) => fetch(`/api/bible/passage?ref=${encodeURIComponent(ref)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    history.replaceState(history.state, '', `/bible/?path=${i}`);
    showResults(`<div class="results-head"><h2>${esc(p.title)}</h2><button class="btn-line" type="button" id="res-back">Back to reading</button></div><p class="dir-count">${esc(p.about)}</p>
      <ul class="hits">${parts.filter(Boolean).map((d: any) => `<li><button type="button" data-ref="${esc(d.ref.label)}"><b>${esc(d.ref.label)}</b>${d.kjv.map((v: any) => `<sup>${v.v}</sup>${esc(v.text)}`).join(' ')}</button></li>`).join('')}</ul>`);
  }

  // --- wiring ---
  bookSel.addEventListener('change', () => loadChapter(+bookSel.value, 1));
  chSel.addEventListener('change', () => loadChapter(b, +chSel.value));
  $('ch-prev')!.addEventListener('click', () => { if (c > 1) loadChapter(b, c - 1); else if (b > 0) loadChapter(b - 1, BOOKS[b - 1][1]); });
  $('ch-next')!.addEventListener('click', () => { if (c < BOOKS[b][1]) loadChapter(b, c + 1); else if (b < BOOKS.length - 1) loadChapter(b + 1, 1); });
  app.querySelectorAll<HTMLButtonElement>('.seg button').forEach((x) => {
    x.setAttribute('aria-pressed', String(x.dataset.t === mode));
    x.addEventListener('click', () => {
      mode = x.dataset.t as Mode; store.set('tyaj-bible-mode', mode);
      app.querySelectorAll('.seg button').forEach((y) => y.setAttribute('aria-pressed', String(y === x)));
      render(); if (openV) openSheet(openV);
    });
  });
  $<HTMLFormElement>('bible-search')!.addEventListener('submit', (e) => { e.preventDefault(); runSearch($<HTMLInputElement>('bs-q')!.value, $<HTMLSelectElement>('bs-scope')!.value); });
  app.querySelectorAll<HTMLButtonElement>('.path-btn').forEach((x) => x.addEventListener('click', () => openPath(+(x.dataset.path || 0))));
  document.addEventListener('keydown', function esc2(e) { if (!document.body.contains(sheet)) { document.removeEventListener('keydown', esc2); return; } if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // Verse of the day
  const daily = DAILY[dayIndex(DAILY.length)];
  fetch(`/api/bible/passage?ref=${encodeURIComponent(daily)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d?.kjv?.length) return;
    $('votd-text')!.textContent = `“${d.kjv.map((v: any) => v.text).join(' ')}”`;
    $('votd-ref')!.textContent = `${d.ref.label} (KJV)`;
    $('votd-open')!.addEventListener('click', () => loadChapter(d.ref.b, d.ref.c, d.ref.v1));
    $('votd')!.hidden = false;
  }).catch(() => {});

  // Start where the link points, or where the reader left off.
  const params = new URLSearchParams(location.search);
  const last = (store.get('tyaj-bible-last') || '42:1').split(':').map(Number);
  setupAccount();
  if (params.get('q')) { $<HTMLInputElement>('bs-q')!.value = params.get('q')!; b = last[0]; c = last[1]; fillChapters(); runSearch(params.get('q')!, 'all'); }
  else if (params.get('path')) { b = last[0]; c = last[1]; fillChapters(); openPath(+params.get('path')!); }
  else if (params.get('ref')) { goRef(params.get('ref')!).then((ok) => { if (!ok) loadChapter(last[0] || 0, last[1] || 1); }); }
  else loadChapter(BOOKS[last[0]] ? last[0] : 42, last[1] || 1);
}


// Partnerships, press and licensing forms
function initInquiry() {
  document.querySelectorAll<HTMLFormElement>('.inquiry-form').forEach((form) => {
    const out = form.querySelector<HTMLElement>('.form-msg')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = (k: string) => String(fd.get(k) || '').trim();
      const problem = !v('name') ? 'Enter your name.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')) ? 'Enter a full email address, like you@example.com.' : !v('message') ? 'Tell us a little about your request.' : '';
      if (problem) { out.textContent = problem; return; }
      const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!, label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…'; out.textContent = '';
      try {
        const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(fd.entries()), topic: form.dataset.topic, started: form.dataset.started }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "That didn't send. Try again in a minute.");
        form.reset(); out.textContent = "Thank you. Your message was sent, and we'll be in touch soon.";
      } catch (ex) { out.textContent = (ex as Error).message; } finally { btn.disabled = false; btn.textContent = label; }
    });
  });
}


// ---------- Store and cart ----------
interface CatItem { id: string; name: string; price: number; options: { label: string; price: number }[] | null; digital: boolean; img: string; art: string }
interface CartLine { id: string; option: string; qty: number }
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const Cart = {
  read(): CartLine[] { try { return JSON.parse(localStorage.getItem('tyaj-cart') || '[]'); } catch { return []; } },
  write(lines: CartLine[]) { try { localStorage.setItem('tyaj-cart', JSON.stringify(lines)); } catch { /* private mode */ } renderCart(); },
  add(id: string, option: string, qty: number, digital: boolean) {
    const lines = Cart.read();
    const cur = lines.find((l) => l.id === id && l.option === option);
    if (cur) cur.qty = digital ? 1 : Math.min(20, cur.qty + qty); else lines.push({ id, option, qty: digital ? 1 : qty });
    Cart.write(lines);
  },
};
function catalog(): CatItem[] { return readJSON<CatItem[]>('catalog', []); }
function linePrice(c: CatItem, option: string) { return c.options?.find((o) => o.label === option)?.price ?? c.price; }
function renderCart() {
  const btn = $('cart-btn'), list = $('cart-items');
  const cat = catalog();
  const lines = Cart.read().filter((l) => cat.some((c) => c.id === l.id));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  if (btn) { btn.hidden = count === 0; $('cart-count')!.textContent = String(count); btn.setAttribute('aria-label', `Open your cart, ${count} item${count === 1 ? '' : 's'}`); }
  if (!list) return;
  if (!lines.length) {
    list.innerHTML = '<li class="cart-empty">Your cart is empty. <a class="text-link" href="/store/">Browse the store</a></li>';
    $('cart-foot')!.hidden = true; return;
  }
  $('cart-foot')!.hidden = false;
  let sub = 0;
  list.innerHTML = '';
  lines.forEach((l, i) => {
    const c = cat.find((x) => x.id === l.id)!;
    const each = linePrice(c, l.option); sub += each * l.qty;
    const li = document.createElement('li');
    li.innerHTML = `<span class="thumb">${c.img ? `<img src="${esc(c.img)}" alt="">` : `<span class="art ${esc(c.art)}"></span>`}</span>
      <div><div class="nm">${esc(c.name)}</div>${l.option ? `<div class="op">${esc(l.option)}</div>` : ''}
      <div class="qrow">${c.digital ? '<span class="op">Digital download</span>' : `<button type="button" data-d="-1" aria-label="One fewer">−</button><span>${l.qty}</span><button type="button" data-d="1" aria-label="One more">+</button>`}<button class="rm" type="button">Remove</button></div></div>
      <span class="pr">${money(each * l.qty)}</span>`;
    li.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
      const all = Cart.read(); const t = all.find((x) => x.id === l.id && x.option === l.option);
      if (t) { t.qty = Math.max(1, Math.min(20, t.qty + Number(b.dataset.d))); Cart.write(all); }
    }));
    li.querySelector('.rm')!.addEventListener('click', () => { const all = Cart.read(); all.splice(all.findIndex((x) => x.id === l.id && x.option === l.option), 1); Cart.write(all); });
    list.appendChild(li); void i;
  });
  $('cart-subtotal')!.textContent = money(sub);
  // Free shipping goal (physical items only)
  const goal = Number($('cart')?.dataset.free || 0), goalEl = $('ship-goal');
  const physical = lines.reduce((n, l) => { const c = cat.find((x) => x.id === l.id)!; return c.digital ? n : n + linePrice(c, l.option) * l.qty; }, 0);
  if (goalEl) {
    goalEl.hidden = !goal || physical === 0;
    $('ship-goal-text')!.textContent = physical >= goal ? 'You’ve earned free shipping.' : `Add ${money(goal - physical)} more for free shipping.`;
    ($('ship-goal-bar') as HTMLElement).style.width = `${Math.min(100, (physical / goal) * 100)}%`;
  }
}
function openCart() { const c = $('cart'); if (!c) return; renderCart(); c.hidden = false; $('cart-close')?.focus(); }
function closeCart() { const c = $('cart'); if (c) c.hidden = true; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
window.addEventListener('storage', (e) => { if (e.key === 'tyaj-cart') renderCart(); });

function initCart() {
  renderCart();
  $('cart-btn')?.addEventListener('click', openCart);
  $('cart-close')?.addEventListener('click', closeCart);
  $('cart-shade')?.addEventListener('click', closeCart);
  const go = $<HTMLButtonElement>('cart-checkout');
  go?.addEventListener('click', async () => {
    const out = $('cart-msg')!;
    go.disabled = true; go.textContent = 'Opening secure checkout…'; out.textContent = '';
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: Cart.read() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) throw new Error(d.error || "Checkout couldn't start. Try again in a minute.");
      location.href = d.url;
    } catch (ex) { out.textContent = (ex as Error).message; go.disabled = false; go.textContent = 'Check out'; }
  });
}

function initStorePages() {
  // Category filter on /store
  document.querySelectorAll<HTMLButtonElement>('#store-filters .chip').forEach((chip, _, all) => chip.addEventListener('click', () => {
    all.forEach((c) => c.setAttribute('aria-pressed', 'false')); chip.setAttribute('aria-pressed', 'true');
    document.querySelectorAll<HTMLLIElement>('#store-list > li').forEach((li) => { li.hidden = !(chip.dataset.cat === 'All' || li.dataset.cat === chip.dataset.cat); });
  }));
  if (new URLSearchParams(location.search).get('checkout') === 'cancelled') { openCart(); const m = $('cart-msg'); if (m) m.textContent = 'Checkout was cancelled. Your cart is saved.'; }

  // Product page
  const form = $<HTMLFormElement>('pdp-form');
  if (form) {
    const c = catalog().find((x) => x.id === form.dataset.id);
    const priceEl = $('pdp-price')!, qty = $<HTMLInputElement>('pdp-qty');
    const option = () => form.querySelector<HTMLInputElement>('input[name="option"]:checked')?.value || '';
    const showPrice = () => { if (c) priceEl.textContent = money(linePrice(c, option())); };
    if (c?.options) showPrice();
    form.querySelectorAll('input[name="option"]').forEach((r) => r.addEventListener('change', showPrice));
    form.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => b.addEventListener('click', () => { if (qty) qty.value = String(Math.max(1, Math.min(20, (Number(qty.value) || 1) + Number(b.dataset.step)))); }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!c) return;
      Cart.add(c.id, option(), Math.max(1, Math.min(20, Number(qty?.value) || 1)), c.digital);
      $('pdp-msg')!.innerHTML = 'Added to your cart. <button class="text-link" type="button" style="background:none;border:0;cursor:pointer;padding:0;font:inherit">View cart</button>';
      $('pdp-msg')!.querySelector('button')!.addEventListener('click', openCart);
    });
    document.querySelectorAll<HTMLButtonElement>('.pdp-thumbs button').forEach((b, i, all) => {
      b.setAttribute('aria-pressed', String(i === 0));
      b.addEventListener('click', () => {
        const img = document.querySelector<HTMLImageElement>('.pdp-main img'); if (img) img.src = b.dataset.src || img.src;
        all.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
    });
  }

  // Order confirmation
  const body = $('ty-body');
  if (body) {
    const id = new URLSearchParams(location.search).get('session_id') || '';
    fetch(`/api/checkout/session?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((d) => {
      if (d.error) { $('ty-sub')!.textContent = "We couldn't find this order. If you were charged, your receipt from Stripe has the details, or contact us."; return; }
      if (d.paid) Cart.write([]);
      $('ty-title')!.textContent = d.paid ? `Thank you${d.name ? `, ${d.name.split(' ')[0]}` : ''}` : 'Your order is processing';
      $('ty-sub')!.textContent = d.paid ? `Your order is confirmed. A receipt is on its way to ${d.email}.` : "Your payment hasn't finished yet. This page will show your downloads once it does; your receipt will arrive by email.";
      body.innerHTML = `<ul class="ty-list">${d.items.map((it: any) => `<li><span><strong>${esc(it.name)}</strong>${it.option ? `, ${esc(it.option)}` : ''}${it.qty > 1 ? ` × ${it.qty}` : ''}<br><span class="op" style="color:var(--muted);font-size:.9rem">${it.digital ? 'Digital download' : 'Ships to you, usually within 2 to 7 business days'}</span></span>${it.download ? `<a class="btn btn-gold" href="${esc(it.download)}" target="_blank" rel="noopener">Download</a>` : it.digital && d.paid ? '<span class="op" style="color:var(--muted)">Your download link is being emailed to you.</span>' : ''}</li>`).join('')}</ul>
        <p class="cart-sub"><span>Total paid</span><strong>${money(d.total)}</strong></p>`;
    }).catch(() => { $('ty-sub')!.textContent = "We couldn't load your order details. Your receipt from Stripe has everything."; });
  }
}


// Homepage quick share: pick a topic, start writing, continue to the full form with it carried over
function initQuickShare() {
  const form = $<HTMLFormElement>('quick-share');
  if (!form) return;
  const info = readJSON<{ key: string; label: string; help: string }[]>('qs-topics-data', []);
  const msg = $<HTMLTextAreaElement>('qs-msg')!, label = $('qs-label')!, note = $('qs-note')!;
  const sync = () => {
    const k = form.querySelector<HTMLInputElement>('input[name="topic"]:checked')?.value || 'question';
    const t = info.find((x) => x.key === k);
    label.textContent = t?.label || 'Your message';
    note.textContent = k === 'prayer' ? 'Prayer requests are always kept private. You\u2019ll add your name and email on the next step.' : 'You\u2019ll add your name and email on the next step.';
  };
  form.querySelectorAll('input[name="topic"]').forEach((r) => r.addEventListener('change', sync));
  sync();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const k = form.querySelector<HTMLInputElement>('input[name="topic"]:checked')?.value || 'question';
    try { sessionStorage.setItem('tyaj-share-draft', JSON.stringify({ topic: k, message: msg.value })); } catch { /* private mode */ }
    location.href = `/share/?topic=${encodeURIComponent(k)}`;
  });
}

function initShare() {
  // ---------- Share your thoughts ----------
  const shareForm = $<HTMLFormElement>('share-form');
  if (shareForm) {
    const params = new URLSearchParams(location.search);
    const radios = Array.from(shareForm.querySelectorAll<HTMLInputElement>('input[name="topic"]'));
    function setTopic(k: string) {
      const r = radios.find((x) => x.value === k);
      shareForm!.querySelectorAll<HTMLElement>('.cond').forEach((c) => { c.hidden = !r || c.dataset.for !== k; });
      if (!r) return;
      r.checked = true;
      $('share-h1')!.textContent = r.dataset.heading || 'Share your thoughts';
      $('msg-label')!.textContent = r.dataset.label || 'Your message';
      const help = $('msg-help')!; help.textContent = r.dataset.help || ''; help.hidden = !r.dataset.help;
      $('perm-set')!.hidden = k === 'prayer';
      $('err-topic')!.hidden = true;
      const url = new URL(location.href); url.searchParams.set('topic', k); history.replaceState(null, '', url);
    }
    radios.forEach((r) => r.addEventListener('change', () => setTopic(r.value)));
    if (params.get('topic')) setTopic(params.get('topic')!);
    try {
      const draft = JSON.parse(sessionStorage.getItem('tyaj-share-draft') || 'null');
      if (draft?.message) { const ta = $<HTMLTextAreaElement>('f-msg'); if (ta && !ta.value) ta.value = draft.message; }
      sessionStorage.removeItem('tyaj-share-draft');
    } catch { /* nothing to carry over */ }
    const postParam = params.get('post');
    if (postParam) { const sel = $<HTMLSelectElement>('f-post'); if (sel) sel.value = postParam; }

    const replies: Record<string, string> = {
      question: 'John will reply to your question by email.',
      story: "If John would like to feature your experience, he'll reach out by email first.",
      guest: "We'll email you about recording a conversation with John.",
      prayer: "Your request is private. We're praying with you.",
      feedback: 'John appreciates hearing how his posts land with readers.',
    };
    shareForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(shareForm);
      const v = (k: string) => String(fd.get(k) || '').trim();
      const checks: [string, boolean, string][] = [
        ['err-topic', !!v('topic'), 'tp-question'], ['err-name', !!v('name'), 'f-name'],
        ['err-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')), 'f-email'], ['err-msg', !!v('message'), 'f-msg'],
      ];
      checks.forEach(([id, ok]) => { $(id)!.hidden = ok; });
      const bad = checks.find(([, ok]) => !ok);
      if (bad) { $(bad[2])?.focus(); return; }
      const btn = $<HTMLButtonElement>('send-btn')!, err = $('send-error')!;
      btn.disabled = true; btn.textContent = 'Sending…'; err.textContent = '';
      try {
        const body = Object.fromEntries(fd.entries());
        const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, started: shareForm.dataset.started }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Your message didn\'t send. Try again in a minute.');
        $('sent-msg')!.textContent = replies[v('topic')] || '';
        shareForm.hidden = true; const sent = $('sent')!; sent.hidden = false; sent.focus(); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      } catch (ex) {
        err.textContent = (ex as Error).message;
      } finally { btn.disabled = false; btn.textContent = 'Send to John'; }
    });
  }
}

function initPostPage() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const out = b.parentElement?.querySelector<HTMLElement>('.copied');
    const url = b.dataset.copy || location.href;
    navigator.clipboard?.writeText(url).then(() => { if (out) out.textContent = 'Link copied.'; }, () => { if (out) out.textContent = url; });
  }));
  updateProgress();
}
function updateProgress() {
  const postPage = $('post-page'), prog = $('read-progress');
  if (!prog) return;
  if (!postPage) { prog.style.width = '0'; return; }
  const h = postPage.offsetHeight - window.innerHeight;
  prog.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + '%';
}
window.addEventListener('scroll', updateProgress, { passive: true });

function initPage() {
  pageSyncs = [];
  for (const f of [initNotice, initMenu, initSpirits, initPosts, initKit, initPodcast, initFeaturedRadio, initRadioDir, initPodDir, initVotdHome, initBibleApp, initInquiry, initQuickShare, initCart, initStorePages, initShare, initPostPage]) {
    try { f(); } catch (e) { console.error('[tyaj]', f.name, e); }
  }
}
// Runs on the first load and after every page change.
document.addEventListener('astro:page-load', initPage);
