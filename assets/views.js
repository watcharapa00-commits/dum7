/* views.js — หน้าแรก, แฟ้มเพื่อน และระบบยื่นเรื่อง (ฉายา ป้าย วีรกรรม รูป)
 *
 * เพิ่มหมวดใหม่ในแฟ้มเพื่อน: เขียนตัววาดใน SECTIONS แล้วเรียกด้วย { "type": "ชื่อ" }
 * ใน tools/friends/<ชื่อ>/profile.json
 */
(() => {
  'use strict';
  const D7 = window.D7;
  const { h, $ } = D7;
  const go = (hash) => () => { location.hash = hash; };

  /* ───────── เพิ่ม / ถอนรายการ ───────── */
  // op = { type, friend?, ... } ระบบเติม id กับเวลาให้เอง; ถ้ามีรูปให้ส่ง dataUrl เป็นตัวที่สอง
  D7.addOp = async (op, dataUrl) => {
    const S = D7.state;
    const full = { id: D7.randId(), t: Date.now(), ...op };
    if (dataUrl) {
      full.img = D7.randId();
      await S.store.putImage(full.img, dataUrl);
    }
    await S.store.add(full);
    D7.markMine(full.id);
    if ('by' in op) D7.setMe(op.by);
    S.ops.push(full);
    if (full.img) D7.imageCache[full.img] = dataUrl;
    D7.recompute();
    D7.rerender();
    return full;
  };
  D7.delOp = async (id) => {
    const S = D7.state;
    const op = { id: D7.randId(), t: Date.now(), type: 'del', target: id };
    await S.store.add(op);
    S.ops.push(op);
    D7.recompute();
    D7.rerender();
  };
  D7.imageCache = {};
  const receipt = (op) => `เลขรับเรื่อง ${op.id.slice(0, 4).toUpperCase()}`;

  /* ───────── กล่องเนื้อหาแบบฟอร์มราชการ ───────── */
  // no: ตัวเลขลำดับส่วน หรือข้อความป้ายสั้นๆ
  function panel(no, title, body, stampText) {
    return h('section', { class: 'panel' },
      h('header', { class: 'panel__head' }, h('span', { class: 'panel__no' }, typeof no === 'number' ? 'ส่วนที่ ' + no : no), h('h3', { class: 'panel__title' }, title)),
      stampText && h('div', { class: 'stamp stamp-fixed' }, stampText),
      h('div', { class: 'panel__body' }, body));
  }
  D7.panel = panel;

  const nameOf = (id) => (D7.state.data.friends.find((f) => f.id === id) || {}).nickname || '?';
  const agoText = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'เมื่อสักครู่';
    if (m < 60) return `${m} นาทีที่แล้ว`;
    if (m < 1440) return `${Math.round(m / 60)} ชั่วโมงที่แล้ว`;
    return `${Math.round(m / 1440)} วันที่แล้ว`;
  };
  const delBtn = (op, label = 'ถอนเรื่อง') => (D7.isMine(op.id)
    ? h('button', {
      type: 'button', class: 'linkbtn',
      onclick: async () => {
        if (!confirm('ถอนเรื่องนี้ออกจากแฟ้ม?')) return;
        try { await D7.delOp(op.id); D7.toast('ถอนเรื่องเรียบร้อย'); } catch (e) { D7.toast('ถอนเรื่องไม่สำเร็จ ลองอีกครั้ง'); }
      },
    }, label) : null);
  const byLine = (op) => `ยื่นโดย ${D7.byName(op.by)} · ${agoText(op.t)}`;
  const hashOf = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };

  /* ───────── หมวดที่ปรากฏในแฟ้ม (กำหนดใน profile.json) ───────── */
  const SECTIONS = {
    nicknames: (s) => h('ul', { class: 'nicks' }, s.items.map((t, i) => h('li', {}, h('small', {}, 'ฉายาที่ ' + (i + 1)), t))),

    kv: (s, f) => h('dl', { class: 'kv' }, s.rows.map((r) => h('div', {}, h('dt', {}, r.label), h('dd', {}, D7.fieldValue(f, r))))),

    counters: (s) => h('div', {},
      h('ul', { class: 'counters' }, s.items.map((it) => h('li', {}, h('b', {}, it.value.toLocaleString('th-TH')), h('span', {}, it.unit), h('em', {}, it.label)))),
      s.note && h('p', { class: 'note' }, '* ' + s.note)),

    stats: (s) => {
      const list = h('ul', { class: 'stats' }, s.items.map((it) =>
        h('li', { 'data-tone': it.tone || 'mint', style: `--v:${it.value}` },
          h('div', { class: 'stat__top' }, h('span', {}, it.label), h('b', {}, it.value + '%')),
          h('div', { class: 'stat__bar', role: 'img', 'aria-label': `${it.label} ${it.value} เปอร์เซ็นต์` }, h('i')))));
      const io = 'IntersectionObserver' in window && !D7.REDUCED
        ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.4 })
        : null;
      list.querySelectorAll('li').forEach((li) => (io ? io.observe(li) : li.classList.add('in')));
      return h('div', {}, list, s.note && h('p', { class: 'note' }, '* ' + s.note));
    },

    bullets: (s) => h('ul', { class: 'bullets' }, s.items.map((t) => h('li', {}, t))),
  };

  /* ───────── บัตรประจำตัว ───────── */
  function idCard(f) {
    const bubble = h('span', { class: 'bubble', 'aria-hidden': 'true' });
    let bubbleTimer, last = -1;
    const photo = h('button', {
      class: 'photo', type: 'button', 'aria-label': 'แตะเพื่อฟังเสียงตัวการ์ตูน',
      onclick: () => {
        const lines = f.avatarLines || ['...'];
        let i; do { i = (Math.random() * lines.length) | 0; } while (lines.length > 1 && i === last);
        last = i;
        bubble.textContent = lines[i];
        bubble.classList.add('is-on');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => bubble.classList.remove('is-on'), 2600);
      },
    }, bubble, h('img', { src: f.avatar, alt: 'ภาพการ์ตูนของ' + f.nickname }));

    const name = h('h2', { class: 'name glitch', 'data-text': f.nickname, onclick: () => D7.glitch(name) }, f.nickname);
    const b = D7.birth(f);
    const padMrz = (s, n) => (s + '<'.repeat(n)).slice(0, n);
    const yymmdd = String(b.y).slice(2) + String(b.m).padStart(2, '0') + String(b.d).padStart(2, '0');

    return h('article', { class: 'idcard' },
      h('div', { class: 'stamp stamp-fixed' }, 'ลับที่สุด'),
      h('div', { class: 'idcard__head' }, h('b', {}, 'บัตรประจำตัวสมาชิกกลุ่ม'), h('span', { class: 'idcard__ref' }, f.ref)),
      h('div', { class: 'idcard__body' },
        h('div', {}, photo, h('span', { class: 'photo__cap' }, 'ภาพถ่าย (การ์ตูน)')),
        h('div', {}, name, h('p', { class: 'role' }, f.role))),
      h('dl', { class: 'idcard__fields' }, (f.card || []).map((r) => h('div', {}, h('dt', {}, r.label), h('dd', {}, D7.fieldValue(f, r))))),
      h('div', { class: 'mrz', 'aria-hidden': 'true' }, padMrz('ID<DUM7<<' + f.id.toUpperCase(), 36), h('br'), padMrz('D7' + yymmdd + '<' + String(f.order || 0).padStart(3, '0'), 36)));
  }

  /* ───────── แบบคำร้อง 4 ชนิดของแฟ้มเพื่อน ───────── */
  function formNick(f) {
    D7.openForm({
      code: 'แบบคำร้อง ดว.7-01', title: 'คำร้องขอจดทะเบียนฉายา', intro: `ผู้ถูกเสนอชื่อ: ${f.nickname}`,
      fields: [{ name: 'text', type: 'text', label: 'ฉายาที่เสนอ', required: true, max: 40, placeholder: 'เช่น จิ้งจอกทิเบตแถวยโสธร' }, D7.byField()],
      submitText: 'ยื่นคำร้อง',
      onSubmit: async (v) => { const op = await D7.addOp({ type: 'nick', friend: f.id, text: v.text, by: v.by }); D7.toast(`รับเรื่องแล้ว ฉายาขึ้นทะเบียนเรียบร้อย (${receipt(op)})`); },
    });
  }
  function formTag(f) {
    D7.openForm({
      code: 'แบบคำร้อง ดว.7-02', title: 'ใบสั่งแปะป้ายตราประทับ', intro: `ป้ายจะถูกประทับลงแฟ้มของ ${f.nickname}`,
      fields: [{ name: 'text', type: 'choice', label: 'ข้อความบนป้าย', required: true, max: 16, options: ['ด่วนที่สุด', 'ตัวตึง', 'เลทมาก', 'รอโอนคืน', 'ห้ามยืมเงิน', 'คิวทอง', 'ไว้ใจได้', 'หายตัวบ่อย'] }, D7.byField()],
      submitText: 'ประทับตรา',
      onSubmit: async (v) => { const op = await D7.addOp({ type: 'tag', friend: f.id, text: v.text, by: v.by }); D7.toast(`ประทับตราเรียบร้อย (${receipt(op)})`); },
    });
  }
  function formDeed(f) {
    D7.openForm({
      code: 'แบบคำร้อง ดว.7-03', title: 'แบบบันทึกวีรกรรม', intro: `เล่าวีรกรรมของ ${f.nickname} ให้เป็นหลักฐานลงแฟ้ม`,
      fields: [
        { name: 'title', type: 'text', label: 'หัวข้อวีรกรรม', required: true, max: 80, placeholder: 'เช่น เหตุการณ์ผ้าเช็ดตีนปริศนา' },
        { name: 'text', type: 'textarea', label: 'รายละเอียด', max: 700, placeholder: 'เล่าแบบเต็มๆ ได้เลย' },
        { name: 'when', type: 'text', label: 'เกิดขึ้นเมื่อ', max: 40, placeholder: 'เช่น ม.4 เทอม 2 หรือ คืนวันลอยกระทง' },
        D7.byField(),
      ],
      submitText: 'ยื่นบันทึก',
      onSubmit: async (v) => { const op = await D7.addOp({ type: 'deed', friend: f.id, title: v.title, text: v.text, when: v.when, by: v.by }); D7.toast(`บันทึกวีรกรรมแล้ว (${receipt(op)})`); },
    });
  }
  function formPhoto(f) {
    D7.openForm({
      code: 'แบบคำร้อง ดว.7-04', title: 'แบบแนบหลักฐานภาพถ่าย', intro: `ภาพจะถูกย่อและเข้ารหัสก่อนส่งขึ้นระบบ แฟ้มของ ${f.nickname}`,
      fields: [
        { name: 'img', type: 'image', label: 'รูปหลักฐาน', required: true },
        { name: 'caption', type: 'text', label: 'คำบรรยายภาพ', max: 120, placeholder: 'เช่น ภาพต้นฉบับก่อนถูกลบ' },
        D7.byField(),
      ],
      submitText: 'แนบหลักฐาน',
      onSubmit: async (v) => { const op = await D7.addOp({ type: 'photo', friend: f.id, caption: v.caption, by: v.by }, v.img); D7.toast(`แนบหลักฐานแล้ว (${receipt(op)})`); },
    });
  }

  /* ───────── ส่วนที่เพื่อนๆ ช่วยกันเพิ่ม ───────── */
  function counterWindow(f) {
    const btn = (title, sub, fn) => h('button', { type: 'button', class: 'svc', onclick: fn }, h('b', {}, title), h('span', {}, sub));
    return h('div', { class: 'svc-grid' },
      btn('เสนอฉายา', 'ดว.7-01', () => formNick(f)),
      btn('แปะป้ายตราประทับ', 'ดว.7-02', () => formTag(f)),
      btn('บันทึกวีรกรรม', 'ดว.7-03', () => formDeed(f)),
      btn('แนบรูปหลักฐาน', 'ดว.7-04', () => formPhoto(f)));
  }

  function nicksAndTags(f) {
    const nicks = D7.state.fold.of('nick', f.id);
    const tags = D7.state.fold.of('tag', f.id);
    if (!nicks.length && !tags.length) return h('p', { class: 'empty' }, 'ยังไม่มีผู้ยื่นเรื่อง เป็นคนแรกได้เลยที่ช่องยื่นเรื่องด้านบน');
    return h('div', {},
      nicks.length ? h('ul', { class: 'nicks nicks--crowd' }, nicks.map((o, i) => h('li', {},
        h('small', {}, `เสนอโดย ${D7.byName(o.by)}`), o.text, delBtn(o, 'ถอน')))) : null,
      tags.length ? h('div', { class: 'tags' }, tags.map((o) => {
        const hs = hashOf(o.id);
        return h('span', { class: 'tag tag--' + (hs % 4), style: `--r:${((hs % 13) - 6)}deg`, title: `ประทับโดย ${D7.byName(o.by)}` }, o.text, delBtn(o, '×'));
      })) : null);
  }

  function deedList(f) {
    const deeds = D7.state.fold.of('deed', f.id).slice().reverse();
    if (!deeds.length) return h('p', { class: 'empty' }, 'ยังไม่มีวีรกรรมในแฟ้มนี้ มีเรื่องเด็ดก็ยื่นบันทึกได้เลย');
    return h('ol', { class: 'timeline' }, deeds.map((o) => h('li', {},
      o.when && h('time', {}, o.when), h('h4', {}, o.title), o.text && h('p', { class: 'deed' }, o.text),
      h('p', { class: 'byline' }, byLine(o), ' ', delBtn(o)))));
  }

  // โหลดรูปทีละรูปเมื่อเลื่อนมาถึง ไม่ต้องดึงรูปทั้งหมดตั้งแต่เปิดแฟ้ม
  const imgObserver = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    imgObserver.unobserve(e.target);
    D7.loadImage(e.target);
  }), { rootMargin: '200px' }) : null;
  D7.loadImage = async (img) => {
    const id = img.dataset.img;
    let url = D7.imageCache[id];
    if (!url) { url = await D7.state.store.getImage(id); if (url) D7.imageCache[id] = url; }
    if (url) { img.src = url; img.classList.add('is-loaded'); } else img.alt = 'โหลดรูปไม่สำเร็จ';
  };

  function photoGrid(f) {
    const photos = D7.state.fold.of('photo', f.id).slice().reverse();
    if (!photos.length) return h('p', { class: 'empty' }, 'ยังไม่มีภาพหลักฐาน แนบรูปได้ที่ช่องยื่นเรื่องด้านบน');
    return h('ul', { class: 'photos' }, photos.map((o, i) => {
      const img = h('img', { 'data-img': o.img, alt: o.caption || `ภาพหลักฐานที่ ${i + 1}`, loading: 'lazy' });
      imgObserver ? imgObserver.observe(img) : D7.loadImage(img);
      return h('li', {}, h('button', { type: 'button', class: 'photos__btn', 'aria-label': 'ดูรูปขนาดใหญ่', onclick: () => lightbox(o, img) }, img),
        o.caption && h('small', {}, o.caption));
    }));
  }

  function lightbox(op, img) {
    const big = h('img', { class: 'lightbox__img', alt: op.caption || 'ภาพหลักฐาน', src: img.src || '' });
    if (!img.src) { big.dataset.img = op.img; D7.loadImage(big); }
    D7.modal({
      code: 'ภาพหลักฐาน', title: 'ภาพหลักฐาน',
      content: h('div', { class: 'lightbox' }, big, op.caption && h('p', {}, op.caption), h('p', { class: 'byline' }, byLine(op), ' ', delBtn(op))),
    });
  }

  function friendView(f) {
    const statics = (f.sections || []).map((s, i) => {
      const draw = SECTIONS[s.type];
      return draw ? panel(i + 1, s.title, draw(s, f), s.stamp) : null;
    }).filter(Boolean);
    const n = statics.length;
    return [
      h('p', { class: 'crumb' }, h('button', { type: 'button', onclick: go('#/') }, 'ทะเบียนทั้งหมด'), ' / แฟ้ม ' + f.ref),
      idCard(f),
      panel('บริการ', 'ช่องยื่นเรื่องของแฟ้มนี้', counterWindow(f)),
      statics,
      panel(n + 1, 'ฉายาและป้ายที่ประชาชนเสนอ', nicksAndTags(f)),
      panel(n + 2, 'บันทึกวีรกรรม', deedList(f)),
      panel(n + 3, 'ภาพหลักฐาน', photoGrid(f)),
    ];
  }

  /* ───────── หน้าแรก ───────── */
  const FEED_VERB = {
    nick: (o) => `${D7.byName(o.by)} เสนอฉายา "${o.text}" ให้ ${nameOf(o.friend)}`,
    tag: (o) => `${D7.byName(o.by)} ประทับตรา "${o.text}" ลงแฟ้ม ${nameOf(o.friend)}`,
    deed: (o) => `${D7.byName(o.by)} บันทึกวีรกรรมของ ${nameOf(o.friend)}: ${o.title}`,
    photo: (o) => `${D7.byName(o.by)} แนบรูปหลักฐานในแฟ้ม ${nameOf(o.friend)}`,
    event: (o) => `${D7.byName(o.by)} นัดหมาย: ${o.title} (${D7.thDate(o.date)})`,
  };

  // ใบบันทึกข้อความสไตล์ราชการ ใช้ทั้งหน้าแรกและรายละเอียดนัดหมาย
  D7.memo = ({ no, date, subject, to, lines, sign }) => h('article', { class: 'memo' },
    h('h3', { class: 'memo__title' }, 'บันทึกข้อความ'),
    h('dl', { class: 'memo__rows' },
      h('div', {}, h('dt', {}, 'ส่วนราชการ'), h('dd', {}, 'กรมความสัมพันธ์สนิท สำนักงาน DUM7')),
      h('div', {}, h('dt', {}, 'ที่'), h('dd', {}, no)),
      h('div', {}, h('dt', {}, 'วันที่'), h('dd', {}, date)),
      h('div', {}, h('dt', {}, 'เรื่อง'), h('dd', {}, subject))),
    h('p', { class: 'memo__to' }, h('b', {}, 'เรียน '), to),
    h('div', { class: 'memo__body' }, lines.map((l) => h('p', {}, l))),
    sign && h('p', { class: 'memo__sign' }, sign));

  function homeView() {
    const S = D7.state;
    const friends = S.data.friends;
    const nb = friends.map((f) => ({ f, n: D7.nextBirthday(f) })).sort((a, b) => a.n.days - b.n.days);
    const soonDays = nb[0].n.days;
    const same = nb.filter((x) => x.n.days === soonDays);
    const nextEvent = S.fold.events.filter((e) => e.date >= D7.ymd(new Date())).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];

    const feed = S.fold.live.filter((o) => FEED_VERB[o.type]).slice(-8).reverse();
    return [
      S.store.mode === 'local' && h('p', { class: 'banner' }, 'โหมดทดลอง: สิ่งที่เพิ่มจะเห็นเฉพาะในเครื่องนี้ ผู้ดูแลระบบต้องเชื่อมต่อฐานข้อมูลกลางก่อน เพื่อนถึงจะเห็นตรงกัน'),
      D7.memo({
        no: 'ดว.7/วันเกิด/' + String(D7.nextBirthday(same[0].f).date.getFullYear() + 543).slice(2),
        date: D7.thDate(D7.ymd(new Date()), false),
        subject: 'แจ้งวันเกิดสมาชิกถัดไป',
        to: 'สมาชิกทุกท่าน',
        lines: [
          `ด้วย ${same.map((x) => x.f.nickname).join(' และ ')} จะมีอายุครบ ${same[0].n.turning} ปี ในวันที่ ${D7.thDate(D7.ymd(same[0].n.date), false)} (${D7.relDays(soonDays)})`,
          nextEvent ? `และมีนัดหมายที่จะถึง: ${nextEvent.title} วันที่ ${D7.thDate(nextEvent.date)}` : 'ยังไม่มีนัดหมายอื่นในปฏิทิน',
          'จึงเรียนมาเพื่อโปรดเตรียมงบประมาณ ของขวัญ และคำอวยพรที่ไม่ซ้ำกับปีที่แล้ว',
        ],
        sign: h('button', { type: 'button', class: 'linkbtn', onclick: go('#/cal') }, 'เปิดปฏิทินกิจกรรม'),
      }),
      h('h2', { class: 'pagehead' }, 'ทะเบียนเพื่อนทั้งหมด'),
      h('p', { class: 'pagenote' }, 'เรียงตามวันเกิดในปี (ม.ค. ถึง ธ.ค.) ไม่ได้จัดอันดับความสนิทใดๆ'),
      h('ul', { class: 'list' },
        friends.map((f) => {
          const n = D7.nextBirthday(f);
          return h('li', {}, h('button', { class: 'entry', type: 'button', onclick: go('#/f/' + f.id) },
            h('img', { src: f.avatar, alt: '' }),
            h('div', {}, h('b', {}, f.nickname), h('span', {}, f.ref + ' · ' + f.role), h('em', {}, `เกิด ${D7.thDate(f.birthDate)} · ${D7.relDays(n.days)}`))));
        }),
        Array.from({ length: S.data.group.lockedSlots || 0 }, (_, i) => h('li', {},
          h('button', { class: 'entry entry--locked', type: 'button', onclick: () => D7.toast('ช่องว่างสำรอง ติดต่อผู้ดูแลระบบเพื่อเพิ่มแฟ้มสมาชิกใหม่') },
            h('div', { class: 'redact', 'aria-hidden': 'true' }, '?'),
            h('div', {}, h('b', {}, '██████'), h('span', {}, 'ดว.7/' + String(friends.length + i + 1).padStart(3, '0') + ' · ว่าง'))))),
      ),
      h('h2', { class: 'pagehead' }, 'ความเคลื่อนไหวล่าสุด'),
      feed.length
        ? h('ul', { class: 'feed' }, feed.map((o) => h('li', {},
          h('button', { type: 'button', onclick: go(o.type === 'event' ? '#/cal' : '#/f/' + o.friend) }, h('span', {}, FEED_VERB[o.type](o)), h('small', {}, agoText(o.t))))))
        : h('p', { class: 'empty' }, 'ยังเงียบอยู่ เข้าไปที่แฟ้มเพื่อนแล้วเสนอฉายา แปะป้าย หรือบันทึกวีรกรรมได้เลย'),
    ];
  }

  D7.views = { home: homeView, friend: friendView };
})();
