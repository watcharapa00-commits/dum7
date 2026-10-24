/* core.js — เครื่องมือกลางที่ไฟล์อื่นเรียกใช้ (ทุกอย่างอยู่ใต้ window.D7)
 *
 * ลำดับไฟล์ใน index.html: core → store → forms → views → calendar → main
 * ข้อมูลเพื่อนอยู่ใน tools/ (เข้ารหัสแล้วเป็น vault.js) ไม่ได้อยู่ในไฟล์พวกนี้
 */
(() => {
  'use strict';
  const D7 = (window.D7 = window.D7 || {});

  D7.$ = (s, r = document) => r.querySelector(s);
  D7.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  D7.REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  D7.SAVE_KEY = 'dum7.k';

  // สร้าง element โดยไม่ใช้ innerHTML กันข้อความของเพื่อนๆ กลายเป็นโค้ด
  D7.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(2)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  let toastTimer;
  D7.toast = (text, ms = 2600) => {
    const t = D7.$('#toast');
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), ms);
  };

  D7.glitch = (el, ms = 800) => {
    if (D7.REDUCED) return;
    el.classList.add('is-glitching');
    setTimeout(() => el.classList.remove('is-glitching'), ms);
  };

  D7.randId = () => {
    const a = new Uint8Array(9);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  /* ───────── วันที่ (ไทย/พ.ศ.) ───────── */
  D7.TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  D7.TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  D7.TH_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  D7.TH_DAYS_LONG = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  const pad = (n) => String(n).padStart(2, '0');
  D7.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  D7.parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  D7.toDate = (s) => { const { y, m, d } = D7.parseYMD(s); return new Date(y, m - 1, d); };
  D7.startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  D7.daysBetween = (a, b) => Math.round((D7.startOfDay(b) - D7.startOfDay(a)) / 864e5);
  D7.thDate = (s, short = true) => {
    const { y, m, d } = D7.parseYMD(s);
    return `${d} ${(short ? D7.TH_MONTHS_SHORT : D7.TH_MONTHS)[m - 1]} ${y + 543}`;
  };
  D7.thDateLong = (s) => `${D7.TH_DAYS_LONG[D7.toDate(s).getDay()]}ที่ ${D7.thDate(s, false)}`;
  D7.relDays = (days) => (days === 0 ? 'วันนี้' : days === 1 ? 'พรุ่งนี้' : days > 0 ? `อีก ${days} วัน` : `ผ่านมา ${-days} วัน`);

  /* ───────── ข้อมูลวันเกิด ───────── */
  D7.birth = (f) => D7.parseYMD(f.birthDate);
  D7.nextBirthday = (f, from = new Date()) => {
    const b = D7.birth(f), today = D7.startOfDay(from);
    let date = new Date(today.getFullYear(), b.m - 1, b.d);
    if (date < today) date = new Date(today.getFullYear() + 1, b.m - 1, b.d);
    return { date, days: D7.daysBetween(today, date), turning: date.getFullYear() - b.y };
  };

  // ราศีตะวันตก: ช่อง i คือราศีที่คลุมต้นเดือน i+1 ถ้าวันที่ < CUT[i] ไม่งั้นเป็นราศีถัดไป
  const SIGNS = [['มกร', 'Capricorn', '♑'], ['กุมภ์', 'Aquarius', '♒'], ['มีน', 'Pisces', '♓'], ['เมษ', 'Aries', '♈'], ['พฤษภ', 'Taurus', '♉'], ['มิถุน', 'Gemini', '♊'], ['กรกฎ', 'Cancer', '♋'], ['สิงห์', 'Leo', '♌'], ['กันย์', 'Virgo', '♍'], ['ตุลย์', 'Libra', '♎'], ['พิจิก', 'Scorpio', '♏'], ['ธนู', 'Sagittarius', '♐'], ['มกร', 'Capricorn', '♑']];
  const CUT = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];

  // ค่าที่คำนวณให้เองจากวันเกิด ใช้ใน profile.json ด้วย { "auto": "age" } เป็นต้น
  D7.AUTO = {
    birthTh: (f) => D7.thDate(f.birthDate, false),
    age(f) {
      const b = D7.birth(f), n = new Date();
      let a = n.getFullYear() - b.y;
      if (n.getMonth() + 1 < b.m || (n.getMonth() + 1 === b.m && n.getDate() < b.d)) a--;
      return `${a} ปี`;
    },
    zodiac(f) {
      const b = D7.birth(f);
      const s = SIGNS[b.d < CUT[b.m - 1] ? b.m - 1 : b.m];
      return `ราศี${s[0]} ${s[2]}︎ ${s[1]}`;
    },
    countdown(f) {
      const n = D7.nextBirthday(f);
      return n.days === 0 ? 'วันนี้วันเกิด! โอนมา' : `อีก ${n.days} วัน`;
    },
  };
  D7.fieldValue = (f, row) => (row.auto ? D7.AUTO[row.auto](f) : row.value);

  /* ───────── ถอดรหัส / เข้ารหัส ───────── */
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  D7.b64 = b64; D7.unb64 = unb64;
  const normalize = (s) => s.normalize('NFC').trim().toLowerCase(); // ต้องตรงกับ tools/build.mjs

  // คืน { data, key } ถ้ารหัสถูก ไม่งั้นคืน null (key คือกุญแจกลางไว้เข้ารหัสสิ่งที่เพื่อนๆ เพิ่ม)
  D7.unlock = async (password) => {
    const vault = window.DUM7_VAULT;
    if (!vault) throw new Error('NO_VAULT');
    if (!window.crypto || !crypto.subtle) throw new Error('NO_CRYPTO');
    const pw = normalize(password);
    if (!pw) return null;
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    for (const slot of vault.slots) {
      try {
        const kek = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: unb64(slot.salt), iterations: vault.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(slot.iv) }, kek, unb64(slot.key));
        const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.data));
        return { data: JSON.parse(dec.decode(plain)), key };
      } catch (_) { /* รหัสไม่ตรงช่องนี้ ลองช่องถัดไป */ }
    }
    return null;
  };

  // aad = ป้ายกำกับกันเอาข้อมูลคนละชนิดมาสลับกัน
  D7.seal = async (key, obj, aad) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(obj)));
    return { ct: b64(ct), iv: b64(iv) };
  };
  D7.open = async (key, { ct, iv }, aad) => {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(aad) }, key, unb64(ct));
    return JSON.parse(dec.decode(plain));
  };

  /* ───────── ข้อมูลที่จำไว้ในเครื่อง ───────── */
  const lsGet = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (_) { return fallback; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ไม่เป็นไร */ } };
  D7.ls = { get: lsGet, set: lsSet };
  D7.getMe = () => lsGet('dum7.me', '');
  D7.setMe = (id) => lsSet('dum7.me', id);
  D7.markMine = (id) => lsSet('dum7.mine', [...lsGet('dum7.mine', []), id].slice(-500));
  D7.isMine = (id) => lsGet('dum7.mine', []).includes(id);
})();
