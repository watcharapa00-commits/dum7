/* calendar.js — ปฏิทินวันเกิด + นัดหมาย (แสดงเป็นบันทึกข้อความสไตล์ราชการ)
 *
 * วันเกิดดึงจาก birthDate ของแต่ละแฟ้มให้อัตโนมัติ ส่วนนัดหมายเพื่อนๆ เพิ่มเองได้
 * นัดหมายคือรายการชนิด "event": { title, date (YYYY-MM-DD), time?, place?, with[], note?, by }
 */
(() => {
  'use strict';
  const D7 = window.D7;
  const { h } = D7;

  let cur = null; // เดือนที่กำลังดู + วันที่เลือก
  const reset = () => { const n = new Date(); cur = { y: n.getFullYear(), m: n.getMonth(), sel: D7.ymd(n) }; };

  const birthdaysOn = (ymd) => {
    const d = D7.parseYMD(ymd);
    return D7.state.data.friends.filter((f) => { const b = D7.birth(f); return b.m === d.m && b.d === d.d && d.y >= b.y; });
  };
  const eventsOn = (ymd) => D7.state.fold.events.filter((e) => e.date === ymd).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  /* ───────── ไฟล์นัดหมายสำหรับเพิ่มลงปฏิทินมือถือ (.ics) ───────── */
  const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  function downloadIcs(e) {
    const f = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const ft = (d) => `${f(d)}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    const day = D7.toDate(e.date);
    let when;
    if (e.time) {
      const [hh, mm] = e.time.split(':').map(Number);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
      when = `DTSTART:${ft(start)}\r\nDTEND:${ft(new Date(start.getTime() + 36e5))}`;
    } else {
      when = `DTSTART;VALUE=DATE:${f(day)}\r\nDTEND;VALUE=DATE:${f(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1))}`;
    }
    const names = (e.with || []).map((id) => D7.byName(id)).join(', ');
    const body = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DUM7//TH', 'BEGIN:VEVENT',
      `UID:${e.id}@dum7`, `DTSTAMP:${ft(new Date())}`, when,
      `SUMMARY:${icsText(e.title)}`, e.place ? `LOCATION:${icsText(e.place)}` : '',
      `DESCRIPTION:${icsText([names && 'ผู้เกี่ยวข้อง: ' + names, e.note].filter(Boolean).join('\n'))}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })), download: 'dum7-nad.ics' });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ───────── รายละเอียดนัดหมาย = บันทึกข้อความ ───────── */
  D7.showEvent = (e) => {
    const names = (e.with || []).map((id) => D7.byName(id));
    const m = D7.modal({
      code: 'บันทึกข้อความนัดหมาย', title: e.title,
      content: h('div', {},
        D7.memo({
          no: 'ดว.7/นัด/' + e.id.slice(0, 4).toUpperCase(),
          date: D7.thDate(e.date, false),
          subject: e.title,
          to: names.length ? names.join(' ') : 'สมาชิกทุกท่าน',
          lines: [
            `ขอเชิญร่วมกิจกรรมตามหัวเรื่อง ในวัน${D7.thDateLong(e.date).slice(3)}${e.time ? ` เวลา ${e.time} น.` : ' (ยังไม่กำหนดเวลา)'}`,
            e.place ? `ณ ${e.place}` : 'สถานที่: ยังไม่ประกาศ',
            e.note,
            'จึงเรียนมาเพื่อโปรดทราบ และขอให้มาตรงเวลา (ถ้าเป็นไปได้)',
          ].filter(Boolean),
          sign: `(ลงชื่อ) ${D7.byName(e.by)}  ผู้บันทึก`,
        }),
        h('div', { class: 'memo__actions' },
          h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => downloadIcs(e) }, 'เพิ่มลงปฏิทินมือถือ (.ics)'),
          D7.isMine(e.id) && h('button', {
            type: 'button', class: 'btn btn--quiet',
            onclick: async () => {
              if (!confirm('ยกเลิกนัดหมายนี้?')) return;
              try { await D7.delOp(e.id); m.close(); D7.toast('ยกเลิกนัดหมายแล้ว'); } catch (_) { D7.toast('ยกเลิกไม่สำเร็จ ลองอีกครั้ง'); }
            },
          }, 'ยกเลิกนัดหมาย'))),
    });
  };

  D7.eventForm = (defaultDate) => {
    D7.openForm({
      code: 'แบบคำร้อง ดว.7-05', title: 'บันทึกข้อความขอนัดหมาย', intro: 'ทุกคนในกลุ่มจะเห็นนัดนี้ในปฏิทิน',
      fields: [
        { name: 'title', type: 'text', label: 'เรื่อง', required: true, max: 80, placeholder: 'เช่น นัดกินหมูกระทะ' },
        { name: 'date', type: 'date', label: 'วันที่', required: true, value: defaultDate },
        { name: 'time', type: 'time', label: 'เวลา' },
        { name: 'place', type: 'text', label: 'สถานที่', max: 100, placeholder: 'เช่น หน้าเซเว่นปากซอย' },
        { name: 'with', type: 'chips', label: 'เรียน (ผู้เกี่ยวข้อง)', help: 'ไม่เลือก = เรียนสมาชิกทุกท่าน', options: D7.state.data.friends.map((f) => ({ value: f.id, label: f.nickname })) },
        { name: 'note', type: 'textarea', label: 'หมายเหตุ', rows: 3, max: 300, placeholder: 'เช่น ใครไม่มาต้องเลี้ยงรอบหน้า' },
        D7.byField(),
      ],
      submitText: 'ยื่นบันทึกข้อความ',
      onSubmit: async (v) => {
        const op = await D7.addOp({ type: 'event', title: v.title, date: v.date, time: v.time, place: v.place, with: v.with, note: v.note, by: v.by });
        const d = D7.parseYMD(v.date);
        cur.y = d.y; cur.m = d.m - 1; cur.sel = v.date;
        D7.rerender();
        D7.toast(`รับเรื่องแล้ว เลขที่ ดว.7/นัด/${op.id.slice(0, 4).toUpperCase()}`);
      },
    });
  };

  /* ───────── หน้าปฏิทิน ───────── */
  function monthGrid() {
    const { y, m } = cur;
    const startDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const rows = Math.ceil((startDow + dim) / 7);
    const todayStr = D7.ymd(new Date());
    const cells = [];
    for (let i = 0; i < rows * 7; i++) {
      const day = i - startDow + 1;
      if (day < 1 || day > dim) { cells.push(h('div', { class: 'cal__cell cal__cell--blank', 'aria-hidden': 'true' })); continue; }
      const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const items = [
        ...birthdaysOn(ymd).map((f) => ({ cls: 'bd', text: f.nickname })),
        ...eventsOn(ymd).map((e) => ({ cls: 'ev', text: e.title })),
      ];
      cells.push(h('button', {
        type: 'button', class: 'cal__cell' + (ymd === todayStr ? ' is-today' : '') + (ymd === cur.sel ? ' is-sel' : ''),
        'aria-label': `${D7.thDateLong(ymd)}${items.length ? ' มี ' + items.length + ' รายการ' : ''}`, 'aria-pressed': String(ymd === cur.sel),
        onclick: () => { cur.sel = ymd; D7.rerender({ keepScroll: true }); },
      },
      h('span', { class: 'cal__num' }, day),
      items.slice(0, 2).map((it) => h('span', { class: 'cal__chip cal__chip--' + it.cls }, it.text)),
      items.length > 2 && h('span', { class: 'cal__more' }, `+${items.length - 2}`)));
    }
    return h('div', { class: 'cal__grid', role: 'group', 'aria-label': `ปฏิทิน ${D7.TH_MONTHS[m]} ${y + 543}` }, cells);
  }

  function dayDetail() {
    const sel = cur.sel;
    const bds = birthdaysOn(sel), evs = eventsOn(sel);
    const rows = [
      ...bds.map((f) => h('li', {}, h('button', { type: 'button', class: 'agenda agenda--bd', onclick: () => { location.hash = '#/f/' + f.id; } },
        h('img', { src: f.avatar, alt: '' }),
        h('span', {}, h('b', {}, `วันเกิดของ ${f.nickname}`), h('small', {}, `ครบ ${D7.parseYMD(sel).y - D7.birth(f).y} ปี · เปิดแฟ้ม ${f.ref}`))))),
      ...evs.map((e) => h('li', {}, h('button', { type: 'button', class: 'agenda agenda--ev', onclick: () => D7.showEvent(e) },
        h('span', { class: 'agenda__time' }, e.time || 'ทั้งวัน'),
        h('span', {}, h('b', {}, e.title), h('small', {}, [e.place, e.with && e.with.length ? 'เรียน ' + e.with.map((id) => D7.byName(id)).join(' ') : ''].filter(Boolean).join(' · ') || 'เปิดดูบันทึกข้อความ'))))),
    ];
    return D7.panel('วันที่เลือก', D7.thDateLong(sel), rows.length
      ? h('ul', { class: 'agenda-list' }, rows)
      : h('p', { class: 'empty' }, 'วันนี้ยังไม่มีรายการ ว่างพอดีสำหรับนัดกันไหม'));
  }

  function upcoming() {
    const S = D7.state, today = D7.startOfDay(), items = [];
    for (const f of S.data.friends) {
      const n = D7.nextBirthday(f);
      items.push({ days: n.days, date: D7.ymd(n.date), kind: 'bd', f, n });
    }
    for (const e of S.fold.events) {
      const days = D7.daysBetween(today, D7.toDate(e.date));
      if (days >= 0) items.push({ days, date: e.date, kind: 'ev', e });
    }
    items.sort((a, b) => a.days - b.days || (a.e?.time || '').localeCompare(b.e?.time || ''));
    return h('ul', { class: 'agenda-list' }, items.slice(0, 10).map((it) => h('li', {},
      it.kind === 'bd'
        ? h('button', { type: 'button', class: 'agenda agenda--bd', onclick: () => { location.hash = '#/f/' + it.f.id; } },
          h('img', { src: it.f.avatar, alt: '' }),
          h('span', {}, h('b', {}, `วันเกิด ${it.f.nickname} · ${D7.thDate(it.date)}`), h('small', {}, `ครบ ${it.n.turning} ปี · ${D7.relDays(it.days)}`)))
        : h('button', { type: 'button', class: 'agenda agenda--ev', onclick: () => D7.showEvent(it.e) },
          h('span', { class: 'agenda__time' }, it.e.time || 'ทั้งวัน'),
          h('span', {}, h('b', {}, `${it.e.title} · ${D7.thDate(it.date)}`), h('small', {}, [it.e.place, D7.relDays(it.days)].filter(Boolean).join(' · ')))))));
  }

  D7.views.calendar = () => {
    if (!cur) reset();
    const shift = (n) => () => {
      const d = new Date(cur.y, cur.m + n, 1);
      cur.y = d.getFullYear(); cur.m = d.getMonth();
      D7.rerender({ keepScroll: true });
    };
    return [
      D7.state.store.mode === 'local' && h('p', { class: 'banner' }, 'โหมดทดลอง: นัดที่เพิ่มจะเห็นเฉพาะในเครื่องนี้ จนกว่าผู้ดูแลระบบจะเชื่อมต่อฐานข้อมูลกลาง'),
      h('h2', { class: 'pagehead' }, 'ปฏิทินกิจกรรมสำนักงาน'),
      h('section', { class: 'cal' },
        h('div', { class: 'cal__bar' },
          h('button', { type: 'button', class: 'cal__nav', 'aria-label': 'เดือนก่อนหน้า', onclick: shift(-1) }, '‹'),
          h('div', { class: 'cal__title' }, `${D7.TH_MONTHS[cur.m]} ${cur.y + 543}`),
          h('button', { type: 'button', class: 'cal__nav', 'aria-label': 'เดือนถัดไป', onclick: shift(1) }, '›')),
        h('div', { class: 'cal__dow', 'aria-hidden': 'true' }, D7.TH_DAYS.map((d) => h('span', {}, d))),
        monthGrid(),
        h('div', { class: 'cal__legend' },
          h('span', { class: 'cal__chip cal__chip--bd' }, 'วันเกิด'), h('span', { class: 'cal__chip cal__chip--ev' }, 'นัดหมาย'),
          h('button', { type: 'button', class: 'linkbtn', onclick: () => { reset(); D7.rerender({ keepScroll: true }); } }, 'กลับมาวันนี้'))),
      h('button', { type: 'button', class: 'btn', onclick: () => D7.eventForm(cur.sel) }, 'ยื่นบันทึกข้อความนัดหมาย'),
      dayDetail(),
      D7.panel('กำหนดการ', 'รายการที่จะถึง', upcoming()),
    ];
  };
})();
