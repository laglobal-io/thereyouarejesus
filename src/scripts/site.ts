// Interactive pieces of the site. Each block only runs if its section is on the page.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const readJSON = <T>(id: string, fallback: T): T => {
  try { const el = $(id); return el ? (JSON.parse(el.textContent || '') as T) : fallback; } catch { return fallback; }
};

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

// ---------- Mobile menu ----------
const menuBtn = document.querySelector<HTMLButtonElement>('.menu-btn');
const nav = $('nav');
if (menuBtn && nav) {
  const close = () => { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu'; };
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.textContent = open ? 'Close' : 'Menu';
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
}

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

// ---------- Bible search ----------
$('bible-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $<HTMLInputElement>('bible-q');
  if (!q?.value.trim()) { q?.focus(); return; }
  window.open('https://www.biblegateway.com/quicksearch/?quicksearch=' + encodeURIComponent(q.value.trim()), '_blank', 'noopener');
});

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

// ---------- Podcast player ----------
interface Episode { title: string; dateLabel: string; minutes: number; description: string; audio: string; link: string }
const audio = $<HTMLAudioElement>('audio');
const radio = $<HTMLAudioElement>('radio-audio');
if (audio && $('eps')) {
  let episodes = readJSON<Episode[]>('podcast-data', []);
  const list = $('eps')!, playBtn = $('play')!, icon = document.getElementById('play-icon')!;
  const seek = $<HTMLInputElement>('seek')!, tCur = $('t-cur')!, tDur = $('t-dur')!, status = $('pod-status')!;
  const speeds = [1, 1.25, 1.5, 2, 0.75]; let sp = 0, cur = 0;
  const fmt = (x: number) => { x = Math.max(0, Math.floor(x || 0)); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; };
  const setIcon = (p: boolean) => { icon.setAttribute('d', p ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4l13 8-13 8z'); playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play'); };
  function load(i: number, autoplay = false) {
    const e = episodes[i]; if (!e) return; cur = i;
    $('np-title')!.textContent = e.title;
    $('np-meta')!.textContent = [e.dateLabel, e.minutes ? `${e.minutes} min` : ''].filter(Boolean).join(', ');
    $('np-desc')!.textContent = e.description;
    list.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    audio!.src = e.audio; seek.value = '0'; tCur.textContent = '0:00'; tDur.textContent = fmt(e.minutes * 60); setIcon(false); status.textContent = '';
    if (autoplay) toggle();
  }
  function toggle() {
    if (!episodes[cur]?.audio) { status.textContent = 'This episode has no audio file yet.'; return; }
    if (audio!.paused) audio!.play().catch(() => { status.textContent = "This episode couldn't start. Check your connection and try again."; });
    else audio!.pause();
  }
  function render() {
    $('ep-count')!.textContent = episodes.length ? `${episodes.length} episodes, newest first` : '';
    list.innerHTML = '';
    episodes.forEach((e, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<button type="button"><span class="t"></span><span class="d"></span><span class="m"></span></button>';
      li.querySelector('.t')!.textContent = e.title; li.querySelector('.d')!.textContent = e.dateLabel;
      li.querySelector('.m')!.textContent = e.minutes ? `${e.minutes} min` : '';
      li.querySelector('button')!.addEventListener('click', () => load(i, true));
      list.appendChild(li);
    });
    if (episodes.length) load(Math.min(cur, episodes.length - 1));
    else { $('np-title')!.textContent = 'Episodes are loading'; status.textContent = 'If this takes a while, listen on iHeart using the button on the left.'; }
  }
  playBtn.addEventListener('click', toggle);
  audio.addEventListener('play', () => { setIcon(true); if (radio && !radio.paused) (document.getElementById('dock-toggle') as HTMLButtonElement | null)?.click(); });
  audio.addEventListener('pause', () => setIcon(false));
  audio.addEventListener('loadedmetadata', () => { tDur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => { if (audio.duration) { seek.value = String((audio.currentTime / audio.duration) * 100); tCur.textContent = fmt(audio.currentTime); } });
  audio.addEventListener('ended', () => { if (cur + 1 < episodes.length) load(cur + 1, true); });
  seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (+seek.value / 100) * audio.duration; });
  $('back15')!.addEventListener('click', () => { if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 15); });
  $('fwd30')!.addEventListener('click', () => { if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 30); });
  $('speed')!.addEventListener('click', (ev) => { sp = (sp + 1) % speeds.length; audio.playbackRate = speeds[sp]; (ev.currentTarget as HTMLElement).textContent = speeds[sp] + 'x'; });
  render();
  // Pick up episodes published since the last build.
  fetch('/api/podcast').then((r) => (r.ok ? r.json() : null)).then((fresh) => {
    if (Array.isArray(fresh) && fresh.length && (fresh.length !== episodes.length || fresh[0].title !== episodes[0]?.title) && audio.paused) {
      episodes = fresh; cur = 0; render();
    }
  }).catch(() => {});
}

// ---------- Live radio ----------
interface LiveStation { key: string; name: string; genre: string; description: string; site: string; streams: string[]; image: string }
if (radio && $('stations')) {
  const list = $('stations')!, status = $('radio-status')!, dock = $('radio-dock')!;
  const dLogo = $('dock-logo')!, dLive = $('dock-live')!, dStation = $('dock-station')!, dTitle = $('dock-title')!, dArtist = $('dock-artist')!;
  const dToggle = $<HTMLButtonElement>('dock-toggle')!, dIcon = document.getElementById('dock-icon')!;
  const PLAY = 'M7 4l13 8-13 8z', PAUSE = 'M6 4h4v16H6zM14 4h4v16h-4z';
  const playSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';
  const pauseSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>';
  const data = new Map<string, LiveStation>();
  let current: HTMLButtonElement | null = null, tries = 0, nowTimer = 0, loaded: Promise<boolean> | null = null;

  const buttons = () => Array.from(list.querySelectorAll<HTMLButtonElement>('button.station'));
  const streamsOf = (b: HTMLButtonElement) => data.get(b.dataset.key || '')?.streams || [];
  const isOn = () => !!radio!.getAttribute('src') && !radio!.paused;

  function paintCards() {
    buttons().forEach((x) => {
      const on = x === current && isOn();
      x.setAttribute('aria-pressed', String(x === current));
      x.querySelector('svg')!.outerHTML = on ? pauseSvg : playSvg;
      x.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + x.dataset.name);
    });
  }
  function paintDock(state: 'connecting' | 'playing' | 'paused') {
    dock.classList.toggle('connecting', state === 'connecting');
    dIcon.setAttribute('d', state === 'paused' ? PLAY : PAUSE);
    dToggle.setAttribute('aria-label', state === 'paused' ? 'Play' : 'Pause');
    dLive.hidden = state !== 'playing';
    paintCards();
  }
  function decorate(b: HTMLButtonElement, st: LiveStation) {
    if (!st.image) return;
    const pb = b.querySelector<HTMLElement>('.pb')!;
    pb.classList.add('has-logo'); pb.style.backgroundImage = `url("${st.image}")`;
  }
  function hideEmptyFilters() {
    document.querySelectorAll<HTMLButtonElement>('#radio-filters .chip').forEach((chip) => {
      const g = chip.dataset.g;
      if (g === 'All') return;
      chip.hidden = !list.querySelector(`li[data-g="${CSS.escape(g || '')}"]`);
    });
  }
  function removeCard(b: HTMLButtonElement) { b.closest('li')?.remove(); hideEmptyFilters(); }

  function load(): Promise<boolean> {
    loaded ??= fetch('/api/radio').then((r) => (r.ok ? r.json() : null)).then((d: { stations: LiveStation[]; discover: LiveStation[] } | null) => {
      if (!d) return false;
      d.stations.forEach((st) => data.set(st.key, st));
      // Only stations with a working live stream stay on the page.
      buttons().forEach((b) => { const st = data.get(b.dataset.key || ''); if (st) decorate(b, st); else removeCard(b); });
      d.discover.forEach((st) => {
        data.set(st.key, st);
        const li = document.createElement('li'); li.dataset.g = 'Discover'; li.hidden = true;
        li.innerHTML = `<button class="station" type="button" aria-pressed="false"><span class="pb">${playSvg}</span><span class="g"></span><span class="nm"></span><span class="ds"></span></button>`;
        const b = li.querySelector('button')!;
        Object.assign(b.dataset, { key: st.key, name: st.name, genre: st.genre });
        b.setAttribute('aria-label', `Play ${st.name}`);
        li.querySelector('.g')!.textContent = st.genre; li.querySelector('.nm')!.textContent = st.name; li.querySelector('.ds')!.textContent = st.description;
        decorate(b, st); b.addEventListener('click', () => onStation(b)); list.appendChild(li);
      });
      $('discover-chip')!.hidden = !d.discover.length;
      hideEmptyFilters();
      if (!list.querySelector('li')) status.textContent = 'Live radio is resting right now. Please check back soon.';
      return true;
    }).catch(() => false);
    return loaded;
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: '800px' });
    io.observe($('radio')!);
  } else load();

  function setSong(title: string, artist: string) {
    const st = current ? data.get(current.dataset.key || '') : null;
    dTitle.textContent = title || current?.dataset.name || '';
    dArtist.textContent = artist;
    if ('mediaSession' in navigator && current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || current.dataset.name || '', artist: artist || current.dataset.name || '',
        album: 'Live on ThereYouAreJesus', artwork: st?.image ? [{ src: st.image, sizes: '256x256' }] : [],
      });
    }
  }
  async function refreshNow() {
    if (!current || !isOn()) return;
    const key = current.dataset.key;
    try {
      const r = await fetch(`/api/radio/now?key=${encodeURIComponent(key || '')}`);
      const n = r.ok ? await r.json() : {};
      if (current?.dataset.key !== key) return;
      if (n.title) setSong(n.title, n.artist || '');
      else if (!dArtist.textContent) setSong('', current.dataset.genre ? `${current.dataset.genre}, live` : 'Live');
    } catch { /* keep what's showing */ }
  }

  function tryStream(b: HTMLButtonElement) {
    const streams = streamsOf(b);
    if (tries >= streams.length) {
      // Every stream for this station failed: take it off the list.
      const name = b.dataset.name;
      closeDock(); removeCard(b);
      status.textContent = `${name} isn't available right now, so it's been removed from the list.`;
      return;
    }
    const src = streams[tries];
    radio!.src = src;
    radio!.play().catch((err: DOMException) => { if (err?.name !== 'AbortError') advance(b, src); });
  }
  function advance(b: HTMLButtonElement, failedSrc: string) {
    if (current !== b || radio!.getAttribute('src') !== failedSrc) return;
    tries++; tryStream(b);
  }
  function start(b: HTMLButtonElement) {
    tries = 0; paintDock('connecting'); tryStream(b);
  }
  // Pausing live radio disconnects; playing again rejoins what's on now.
  function pause() {
    radio!.pause(); radio!.removeAttribute('src'); radio!.load(); clearInterval(nowTimer); paintDock('paused');
  }
  function closeDock() {
    pause(); current = null; dock.hidden = true; document.body.classList.remove('has-dock'); paintCards();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }
  async function onStation(b: HTMLButtonElement) {
    if (current === b) { if (isOn()) pause(); else start(b); return; }
    if (audio && !audio.paused) audio.pause();
    if (current) pause();
    current = b; status.textContent = '';
    dStation.textContent = b.dataset.name || '';
    const st = data.get(b.dataset.key || '');
    dLogo.classList.toggle('has-logo', !!st?.image);
    dLogo.style.backgroundImage = st?.image ? `url("${st.image}")` : '';
    setSong('', 'Connecting\u2026');
    dock.hidden = false; document.body.classList.add('has-dock');
    paintDock('connecting');
    const ok = await load();
    if (current !== b) return;
    if (!ok || !streamsOf(b).length) {
      closeDock();
      status.textContent = "Live radio couldn't load. Check your connection and try again.";
      return;
    }
    start(b);
  }

  radio.addEventListener('playing', () => {
    if (!current) return;
    paintDock('playing');
    if (dArtist.textContent === 'Connecting\u2026') setSong('', '');
    refreshNow(); clearInterval(nowTimer); nowTimer = window.setInterval(refreshNow, 20000);
  });
  radio.addEventListener('waiting', () => { if (current && radio!.getAttribute('src')) paintDock('connecting'); });
  radio.addEventListener('error', () => { const src = radio!.getAttribute('src'); if (current && src) advance(current, src); });
  dToggle.addEventListener('click', () => { if (!current) return; if (isOn()) pause(); else start(current); });
  $('dock-close')!.addEventListener('click', closeDock);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { if (current) start(current); });
    navigator.mediaSession.setActionHandler('pause', () => pause());
  }
  buttons().forEach((b) => b.addEventListener('click', () => onStation(b)));
  $<HTMLInputElement>('radio-vol')?.addEventListener('input', (e) => { radio!.volume = +(e.target as HTMLInputElement).value; });
  document.querySelectorAll<HTMLButtonElement>('#radio-filters .chip').forEach((chip, _, all) => chip.addEventListener('click', () => {
    all.forEach((c) => c.setAttribute('aria-pressed', 'false')); chip.setAttribute('aria-pressed', 'true');
    const g = chip.dataset.g;
    list.querySelectorAll<HTMLLIElement>('li').forEach((li) => {
      li.hidden = g === 'Discover' ? li.dataset.g !== 'Discover' : (li.dataset.g === 'Discover' || !(g === 'All' || li.dataset.g === g));
    });
  }));
}

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

// ---------- Post page: reading progress + copy link ----------
const postPage = $('post-page'), prog = $('read-progress');
if (postPage && prog) {
  const update = () => { const h = postPage.offsetHeight - window.innerHeight; prog.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + '%'; };
  window.addEventListener('scroll', update, { passive: true }); update();
}
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => b.addEventListener('click', () => {
  const out = b.parentElement?.querySelector<HTMLElement>('.copied');
  const url = b.dataset.copy || location.href;
  navigator.clipboard?.writeText(url).then(() => { if (out) out.textContent = 'Link copied.'; }, () => { if (out) out.textContent = url; });
}));
