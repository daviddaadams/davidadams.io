(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  /* Slow crossfade of the operations-room photographs. */
  const fades = $$('.frame-a .fade');
  if (!reduce && fades.length > 1) {
    let i = 0, timer = null;
    const step = () => {
      fades[i].classList.remove('is-on');
      i = (i + 1) % fades.length;
      fades[i].classList.add('is-on');
    };
    const start = () => { if (!timer) timer = setInterval(step, 7000); };
    const stop = () => { clearInterval(timer); timer = null; };
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  /* The rail docks on the page ground once both pictures have passed. */
  const rail = $('.rail');
  const pics = $('.pics');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const end = pics.getBoundingClientRect().bottom;
    rail.classList.toggle('docked', end <= rail.offsetHeight);
    document.querySelector('meta[name="theme-color"]').content = end <= rail.offsetHeight ? '#e8e8e3' : '#181715';
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* Close the phone menu after a choice. */
  const menu = $('.rail-menu');
  if (menu) menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });

  /* Ledger: hovering or focusing a row shows its interface fragment beside it. */
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const col = $('.col-preview');
  const rows = $$('.ledger-row');
  const show = (row) => {
    if (!fine.matches || innerWidth <= 760) return;
    const p = document.getElementById(row.dataset.preview);
    if (!p) return;
    $$('.preview', col).forEach((el) => el.classList.toggle('is-on', el === p));
    const top = row.getBoundingClientRect().top - col.getBoundingClientRect().top;
    const max = col.offsetHeight - p.offsetHeight;
    p.style.setProperty('--y', Math.max(0, Math.min(top - 8, max)) + 'px');
    $$('.ledger').forEach((l) => l.classList.add('dim'));
    rows.forEach((r) => r.classList.toggle('active', r === row));
  };
  const clear = () => {
    $$('.ledger').forEach((l) => l.classList.remove('dim'));
    rows.forEach((r) => r.classList.remove('active'));
  };
  rows.forEach((r) => {
    r.addEventListener('mouseenter', () => show(r));
    r.addEventListener('focusin', () => show(r));
  });
  $$('.ledger').forEach((l) => l.addEventListener('mouseleave', clear));

  /* The board: real schedules, Pasadena time. */
  const SYSTEMS = [
    { name: 'QuickBooks import', group: 'IVB', kind: 'ivb', at: (d) => range(8 * 60, 18 * 60, 30) },
    { name: 'Sales refresh', group: 'IVB', kind: 'ivb', at: () => [150], note: 'buyers, ranking, first emails' },
    { name: 'Trading cycle', group: 'Trading', kind: 'trade', at: () => range(0, 1439, 15) },
    { name: 'Trade records', group: 'Trading', kind: 'trade', at: () => [300] },
    { name: 'Daily monitor', group: 'Trading', kind: 'trade', at: () => [367] },
    { name: 'Model retrain', group: 'Trading', kind: 'trade', at: (d) => (d === 1 ? [360] : []), weekly: 1 },
  ];
  function range(a, b, s) { const out = []; for (let m = a; m <= b; m += s) out.push(m); return out; }
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const clock = (m) => {
    const h = Math.floor(m / 60) % 24, mm = m % 60;
    const ap = h < 12 ? 'a.m.' : 'p.m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
  };
  const span = (mins) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  };
  const pasadenaNow = () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { m: Number(get('hour')) * 60 + Number(get('minute')), d: day < 0 ? 0 : day };
  };
  const next = (sys, m, d) => {
    for (let k = 0; k < 8; k++) {
      const day = (d + k) % 7;
      const times = sys.at(day);
      for (const t of times) {
        const diff = k * 1440 + t - m;
        if (diff >= 0) return { diff, t, day, k };
      }
    }
    return null;
  };

  const form = $('#b-form');
  if (form) {
    const tEl = $('#c-time'), dEl = $('#c-day'), ivbEl = $('#c-ivb'), trEl = $('#c-trade'), soonEl = $('#c-soon');
    const rowsEl = $('#b-rows'), timeEl = $('#b-time'), dayEl = $('#b-day');
    let live = true;

    const render = () => {
      const m = Number(tEl.value), d = Number(dEl.value);
      timeEl.textContent = clock(m);
      dayEl.textContent = DAYS[d] + (live ? ', now in Pasadena' : ', Pasadena time');
      const list = SYSTEMS.filter((s) => (s.kind === 'ivb' ? ivbEl.checked : trEl.checked));
      const html = [];
      for (const s of list) {
        const n = next(s, m, d);
        if (soonEl.checked && (!n || n.diff > 60)) continue;
        let state, due = false;
        if (!n) state = 'Not scheduled';
        else if (n.diff === 0) { state = 'Due now'; due = true; }
        else if (n.diff <= 60) { state = `Next in ${span(n.diff)}`; due = n.diff <= 5; }
        else if (n.k === 0) state = `Next at ${clock(n.t)}`;
        else if (n.k === 1) state = `Tomorrow, ${clock(n.t)}`;
        else state = `${DAYS[n.day]}, ${clock(n.t)}`;
        const ticks = s.at(d).map((t) => `<span class="b-tick" style="left:${(t / 1440) * 100}%"></span>`).join('');
        html.push(`<li><div class="b-top"><span class="b-name">${s.name}<span class="b-group">${s.group}${s.note ? ' · ' + s.note : ''}</span></span><span class="b-state${due ? ' due' : ''}">${state}</span></div><div class="b-strip" aria-hidden="true">${ticks}<span class="b-now" style="left:${(m / 1440) * 100}%"></span></div></li>`);
      }
      rowsEl.innerHTML = html.length ? html.join('') : '<li class="b-empty">Nothing due in the next hour.</li>';
    };
    const toNow = () => {
      const n = pasadenaNow();
      tEl.value = n.m - (n.m % 5);
      dEl.value = n.d;
      live = true;
      render();
    };
    form.addEventListener('input', (e) => { if (e.target === tEl || e.target === dEl) live = false; render(); });
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#c-now').addEventListener('click', toNow);
    toNow();
    setInterval(() => { if (live) toNow(); }, 30000);
  }

  /* Section entrances: heading, then text, then picture, staggered, once. */
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion');
    $$('section').forEach((sec) => $$('.reveal', sec).forEach((el, i) => el.style.setProperty('--d', Math.min(i, 8) * 75 + 'ms')));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('in'));
  }
})();
