/* main.js — ฝนตัวอักษร, ด่านตรวจรหัส, โครงเว็บหลังเข้าได้ และตัวสลับหน้า (router) */
(() => {
  'use strict';
  const D7 = window.D7;
  const { $, h, sleep } = D7;

  /* ───────── ฝนตัวอักษรหลังจอ ───────── */
  function startRain() {
    const c = $('#rain');
    if (!c || D7.REDUCED) return;
    const ctx = c.getContext('2d');
    const CH = 'กขคงจฉชซดตถทนบปผพมยรลวสหอฮ0123456789<>/\\|7';
    const fs = 17;
    let cols, drops;
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(innerWidth / fs);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
    }
    size();
    addEventListener('resize', size);
    let last = 0;
    (function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden || t - last < 70) return;
      last = t;
      ctx.fillStyle = 'rgba(7,9,8,.15)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.font = fs + 'px Sarabun, monospace';
      for (let i = 0; i < cols; i++) {
        if (drops[i] < 0) { drops[i] += 1; continue; }
        ctx.fillStyle = Math.random() < 0.035 ? '#ff5147' : '#3f9b80';
        ctx.fillText(CH[(Math.random() * CH.length) | 0], i * fs, drops[i] * fs);
        if (drops[i] * fs > innerHeight && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    })(0);
  }

  /* ───────── ด่านตรวจรหัส ───────── */
  const BOOT = [
    '> เชื่อมต่อเครือข่ายใต้ดิน ........ [OK]',
    '> ตรวจสอบใบอนุญาตผู้เข้าใช้ ...... [รอดำเนินการ]',
    '> เตือน: ผู้บุกรุกจะถูกบันทึกชื่อ',
    '  และถูกแซวไปตลอดชีวิต',
    '> รอรหัสผ่าน',
  ];
  async function typeBoot(instant) {
    const pre = $('#boot');
    const cur = h('span', { class: 'cur' });
    const text = document.createTextNode('');
    pre.append(text, cur);
    const full = BOOT.join('\n');
    if (instant || D7.REDUCED) { text.data = full; return; }
    for (const ch of full) { text.data += ch; await sleep(ch === '\n' ? 160 : 14); }
  }

  const DENIED = [
    ['<strong>ACCESS DENIED</strong> รหัสไม่ถูกต้อง ระบบขอยืนยันตัวตนอีกชั้น: พ่ออุ้มชื่ออะไร?', true],
    ['ผิดอีกแล้ว นึกให้ดีๆ พ่ออุ้มชื่ออะไร?'],
    ['ระบบแจ้งเจ้าหนี้ประจำกลุ่มแล้ว เตรียมโดนทวงหนี้ได้เลย'],
    ['ถ้ายังนึกไม่ออก ให้ถามเพื่อนในกลุ่ม อย่ามายืมเงินตองก่อน'],
  ];

  function setupGate() {
    const gate = $('#gate'), form = $('#gate-form'), input = $('#pw'), submit = $('#submit'), msg = $('#gate-msg');
    let busy = false, wrong = 0;

    $('#peek').addEventListener('click', (e) => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      e.currentTarget.textContent = show ? 'ซ่อน' : 'แสดง';
      e.currentTarget.setAttribute('aria-pressed', String(show));
      input.focus();
    });
    const title = $('.gate__title');
    title.addEventListener('click', () => D7.glitch(title));
    if (!D7.REDUCED) setInterval(() => D7.glitch(title, 500), 7000);

    const say = (html) => { msg.innerHTML = html; }; // ข้อความในด่านเป็นของเราเอง ไม่ใช่ข้อมูลจากภายนอก

    function stamp(kind, big, small, ms) {
      const layer = $('#stamp-layer');
      const el = h('div', { class: 'stamp ' + (kind === 'ok' ? 'stamp--ok' : '') }, big, h('small', {}, small));
      layer.replaceChildren(el);
      setTimeout(() => el.classList.add('stamp--out'), ms - 350);
      setTimeout(() => el.remove(), ms);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const pw = input.value;
      if (!pw.trim()) { say('พิมพ์รหัสก่อนยื่นคำร้อง'); input.focus(); return; }
      busy = true; submit.disabled = true; submit.textContent = 'กำลังตรวจสอบสิทธิ์...'; say('');
      let res = null;
      try {
        [res] = await Promise.all([D7.unlock(pw), sleep(650)]);
      } catch (err) {
        busy = false; submit.disabled = false; submit.textContent = 'ยื่นคำร้องขอเข้าระบบ';
        say(err.message === 'NO_CRYPTO'
          ? 'เบราว์เซอร์นี้ถอดรหัสไม่ได้ ให้เปิดผ่านลิงก์ https:// ของเว็บ (ไม่ใช่เปิดไฟล์ในเครื่อง)'
          : 'ไม่พบไฟล์ข้อมูลลับ (assets/vault.js) ให้ผู้ดูแลระบบรัน build ใหม่');
        return;
      }
      if (res) {
        D7.ls.set(D7.SAVE_KEY, pw);
        stamp('ok', 'ผ่านการตรวจสอบ', 'ACCESS GRANTED', 1250);
        await sleep(1150);
        D7.enter(res, false);
        return;
      }
      wrong++;
      const [text, firstTime] = DENIED[Math.min(wrong, DENIED.length) - 1];
      say(text);
      if (firstTime) { $('#pw-label').textContent = 'คำตอบยืนยันตัวตน'; input.placeholder = 'พิมพ์คำตอบที่นี่'; }
      gate.classList.remove('is-wrong');
      void gate.offsetWidth; // รีสตาร์ทแอนิเมชันสั่น
      gate.classList.add('is-wrong');
      stamp('no', 'ปฏิเสธ', 'ACCESS DENIED', 1100);
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      busy = false; submit.disabled = false; submit.textContent = 'ยื่นคำร้องอีกครั้ง';
      input.select();
    });
    return { input };
  }

  /* ───────── โครงเว็บหลังเข้าได้ ───────── */
  function logout() {
    try { localStorage.removeItem(D7.SAVE_KEY); } catch (_) { /* ไม่เป็นไร */ }
    location.hash = '';
    location.reload();
  }

  D7.enter = ({ data, key }, quick) => {
    const S = (D7.state = { data, key, store: D7.createStore(data.group.backend, key), ops: [], fold: D7.fold([]), failed: false });
    D7.recompute = () => { S.fold = D7.fold(S.ops); };

    document.body.classList.remove('is-locked');
    $('#gate').hidden = true;
    const app = $('#app');
    app.hidden = false;
    if (!quick) app.classList.add('is-entering');

    // แถบประกาศ: บรรทัดวันเกิดถัดไปคำนวณสดทุกครั้ง + ประกาศคงที่จาก group.json
    const soon = data.friends.map((f) => ({ f, n: D7.nextBirthday(f) })).sort((a, b) => a.n.days - b.n.days)[0];
    const ticker = [`ประกาศ: วันเกิดสมาชิกถัดไปคือ ${soon.f.nickname} (${D7.thDate(D7.ymd(soon.n.date))}) ${D7.relDays(soon.n.days)}`, ...(data.group.ticker || [])];
    const items = ticker.map((t) => h('span', {}, t));
    const view = h('main', { class: 'page', id: 'view' });
    const tabs = [['#/', 'ทะเบียนเพื่อน'], ['#/cal', 'ปฏิทิน']].map(([href, label]) => h('a', { href, class: 'tabbar__a' }, label));

    app.replaceChildren(
      h('div', { class: 'ticker', 'aria-label': 'ประกาศ' },
        h('span', { class: 'ticker__tag' }, 'ประกาศ'),
        h('div', { class: 'ticker__track', 'aria-hidden': 'true' }, items, items.map((n) => n.cloneNode(true)))),
      h('nav', { class: 'nav' },
        h('a', { class: 'nav__brand', href: '#/' }, data.group.name),
        h('div', { class: 'nav__links' }, h('button', { type: 'button', onclick: logout }, 'ออกจากระบบ'))),
      view,
      h('footer', { class: 'foot' }, `แฟ้มที่เปิดแล้ว ${data.friends.length} ฉบับ · ข้อมูลทุกอย่างเข้ารหัสก่อนส่ง · ระบบบันทึกการเข้าใช้ทุกครั้ง (ล้อเล่น)`),
      h('nav', { class: 'tabbar', 'aria-label': 'เมนูหลัก' }, tabs));

    function render({ keepScroll } = {}) {
      const y = scrollY;
      const m = location.hash.match(/^#\/f\/([\w-]+)/);
      const f = m && data.friends.find((x) => x.id === m[1]);
      let nodes, tab = '#/';
      if (f) nodes = D7.views.friend(f);
      else if (location.hash === '#/cal') { nodes = D7.views.calendar(); tab = '#/cal'; }
      else nodes = D7.views.home();
      view.replaceChildren(...nodes.flat(2).filter(Boolean));
      tabs.forEach((a) => (a.getAttribute('href') === tab && !f ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
      scrollTo(0, keepScroll ? y : 0);
    }
    D7.rerender = render;

    let lastSig = '';
    async function refresh() {
      try {
        const ops = await S.store.list();
        S.failed = false;
        const sig = ops.map((o) => o.id).sort().join();
        if (sig === lastSig) return;
        lastSig = sig;
        S.ops = ops;
        D7.recompute();
        if (!document.body.classList.contains('has-sheet')) render({ keepScroll: true });
      } catch (_) {
        if (!S.failed) D7.toast('เชื่อมต่อฐานข้อมูลกลางไม่ได้ ข้อมูลที่เห็นอาจไม่ล่าสุด');
        S.failed = true;
      }
    }

    addEventListener('hashchange', () => render());
    render();
    refresh();
    if (S.store.mode === 'remote') {
      setInterval(() => { if (!document.hidden) refresh(); }, 180000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    }
  };

  /* ───────── เริ่มทำงาน ───────── */
  async function main() {
    startRain();
    const { input } = setupGate();
    const saved = D7.ls.get(D7.SAVE_KEY, null);
    if (saved) {
      // เคยเข้าสำเร็จแล้วบนเครื่องนี้ ลองเปิดให้เลยโดยไม่ต้องพิมพ์ซ้ำ
      try {
        const res = await D7.unlock(saved);
        if (res) return D7.enter(res, true);
      } catch (_) { /* ตกไปที่ด่านปกติ */ }
      try { localStorage.removeItem(D7.SAVE_KEY); } catch (_) { /* ไม่เป็นไร */ }
    }
    await typeBoot(false);
    input.focus({ preventScroll: true });
  }
  main();
})();
