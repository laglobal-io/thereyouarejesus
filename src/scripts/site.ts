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
  audio.addEventListener('play', () => { setIcon(true); if (radio && !radio.paused) document.getElementById('radio-stop')?.click(); });
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
  const tuner = $('tuner')!, status = $('radio-status')!, stop = $('radio-stop')!, list = $('stations')!;
  const pill = $('live-pill')!, song = $('now-song')!, genreEl = $('tuned-genre')!, nameEl2 = $('tuned-name')!;
  const playSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';
  const stopSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" fill="currentColor"/></svg>';
  const data = new Map<string, LiveStation>();
  let active: HTMLButtonElement | null = null, tries = 0, nowTimer = 0;
  let loaded: Promise<void> | null = null;

  const buttons = () => Array.from(list.querySelectorAll<HTMLButtonElement>('button.station'));
  function setActive(b: HTMLButtonElement | null) {
    buttons().forEach((x) => {
      const on = x === b; x.setAttribute('aria-pressed', String(on));
      x.querySelector('svg')!.outerHTML = on ? stopSvg : playSvg;
      x.setAttribute('aria-label', (on ? 'Stop ' : 'Play ') + x.dataset.name);
    });
  }
  function decorate(b: HTMLButtonElement, st: LiveStation) {
    const pb = b.querySelector<HTMLElement>('.pb')!;
    if (st.image) { pb.classList.add('has-logo'); pb.style.backgroundImage = `url("${st.image}")`; }
  }
  function load() {
    loaded ??= fetch('/api/radio').then((r) => (r.ok ? r.json() : { stations: [], discover: [] })).then((d: { stations: LiveStation[]; discover: LiveStation[] }) => {
      d.stations.forEach((st) => {
        data.set(st.key, st);
        const b = list.querySelector<HTMLButtonElement>(`button[data-key="${st.key}"]`);
        if (b) decorate(b, st);
      });
      if (d.discover.length) {
        d.discover.forEach((st) => {
          data.set(st.key, st);
          const li = document.createElement('li'); li.dataset.g = 'Discover'; li.hidden = true;
          li.innerHTML = `<button class="station" type="button" aria-pressed="false"><span class="pb">${playSvg}</span><span class="g"></span><span class="nm"></span><span class="ds"></span></button>`;
          const b = li.querySelector('button')!;
          Object.assign(b.dataset, { key: st.key, name: st.name, genre: st.genre, site: st.site });
          b.setAttribute('aria-label', `Play ${st.name}`);
          li.querySelector('.g')!.textContent = st.genre; li.querySelector('.nm')!.textContent = st.name; li.querySelector('.ds')!.textContent = st.description;
          decorate(b, st); b.addEventListener('click', () => onStation(b)); list.appendChild(li);
        });
        $('discover-chip')!.hidden = false;
      }
    }).catch(() => {});
    return loaded;
  }
  // Load the station list when the radio section comes into view.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: '600px' });
    io.observe($('radio')!);
  } else load();

  async function refreshNow() {
    if (!active) return;
    const key = active.dataset.key;
    try {
      const r = await fetch(`/api/radio/now?key=${encodeURIComponent(key || '')}`);
      const n = r.ok ? await r.json() : {};
      if (active?.dataset.key !== key) return;
      song.textContent = n.title ? (n.artist ? `${n.title}, ${n.artist}` : n.title) : '';
    } catch { /* keep the last value */ }
  }
  function stopRadio() {
    radio!.pause(); radio!.removeAttribute('src'); radio!.load();
    if (active) active.classList.remove('connecting');
    active = null; setActive(null); tuner.classList.remove('tuning'); clearInterval(nowTimer);
    nameEl2.textContent = 'Choose a station'; genreEl.textContent = 'Pick any station below to start listening';
    pill.hidden = true; song.textContent = ''; stop.hidden = true; status.textContent = '';
  }
  function tryStream(b: HTMLButtonElement, streams: string[]) {
    if (tries >= streams.length) {
      b.classList.remove('connecting'); tuner.classList.remove('tuning'); pill.hidden = true;
      const site = b.dataset.site;
      status.innerHTML = '';
      status.append(`${b.dataset.name} isn't responding right now. Try again in a moment or choose another station.`);
      if (site) { const a = document.createElement('a'); a.href = site; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' Listen on the station\u2019s website'; status.append(a); }
      return;
    }
    const src = streams[tries];
    radio!.src = src;
    radio!.play().catch((err: DOMException) => { if (err?.name !== 'AbortError') advance(b, src); });
  }
  // Move to the station's next backup stream, once per failed stream.
  function advance(b: HTMLButtonElement, failedSrc: string) {
    if (active !== b || radio!.getAttribute('src') !== failedSrc) return;
    const streams = b.dataset.stream ? [b.dataset.stream] : data.get(b.dataset.key || '')?.streams || [];
    tries++; tryStream(b, streams);
  }
  async function onStation(b: HTMLButtonElement) {
    if (active === b) { stopRadio(); return; }
    if (audio && !audio.paused) audio.pause();
    if (active) active.classList.remove('connecting');
    active = b; setActive(b); stop.hidden = false; tries = 0; clearInterval(nowTimer);
    nameEl2.textContent = b.dataset.name || ''; genreEl.textContent = b.dataset.genre || ''; song.textContent = '';
    status.textContent = `Connecting to ${b.dataset.name}\u2026`; b.classList.add('connecting');
    await load();
    if (active !== b) return;
    const streams = b.dataset.stream ? [b.dataset.stream] : data.get(b.dataset.key || '')?.streams || [];
    if (!streams.length) {
      b.classList.remove('connecting'); stopRadio();
      status.innerHTML = '';
      status.append(`${b.dataset.name} doesn't offer a stream that plays inside other sites.`);
      if (b.dataset.site) { const a = document.createElement('a'); a.href = b.dataset.site; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' Listen on the station\u2019s website'; status.append(a); }
      return;
    }
    radio!.volume = +($<HTMLInputElement>('radio-vol')?.value || 0.8);
    tryStream(b, streams);
  }
  radio.addEventListener('playing', () => {
    if (!active) return;
    active.classList.remove('connecting'); tuner.classList.add('tuning'); pill.hidden = false; status.textContent = '';
    refreshNow(); clearInterval(nowTimer); nowTimer = window.setInterval(refreshNow, 20000);
  });
  radio.addEventListener('error', () => { const src = radio!.getAttribute('src'); if (active && src) advance(active, src); });
  radio.addEventListener('waiting', () => { if (active) status.textContent = 'Buffering\u2026'; });
  buttons().forEach((b) => b.addEventListener('click', () => onStation(b)));
  stop.addEventListener('click', stopRadio);
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
