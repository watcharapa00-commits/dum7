/* store.js — ที่เก็บสิ่งที่เพื่อนๆ ช่วยกันเพิ่ม (ฉายา ป้าย วีรกรรม รูป นัดหมาย)
 *
 * ทุกรายการ "เข้ารหัสในเครื่องของเพื่อนก่อนส่งออกไป" ด้วยกุญแจกลางที่ได้จากรหัสผ่าน
 * ฐานข้อมูลกลางจึงเห็นแต่ข้อความอ่านไม่ออก ใครไม่มีรหัสผ่านก็อ่านหรือปลอมรายการไม่ได้
 *
 * มี 2 โหมด:
 *   local  = ยังไม่ได้ตั้งฐานข้อมูลกลาง เก็บในเครื่องนี้เครื่องเดียว (ไว้ลองเล่น)
 *   remote = Firebase Firestore (ฟรี) ผ่าน REST เพื่อนทุกคนเห็นตรงกัน
 *
 * ทุก store มีหน้าตาเดียวกัน: list() add(op) putImage(id, dataUrl) getImage(id)
 * จะเปลี่ยนไปใช้ที่เก็บอื่น (เช่น Supabase) ให้เขียน store ใหม่ที่มี 4 ฟังก์ชันนี้
 */
(() => {
  'use strict';
  const D7 = window.D7;

  const COL_OPS = 'dum7_ops';
  const COL_IMG = 'dum7_img';

  function localStore() {
    const K = 'dum7.local.ops';
    return {
      mode: 'local',
      async list() { return D7.ls.get(K, []); },
      async add(op) { D7.ls.set(K, [...D7.ls.get(K, []), op]); },
      async putImage(id, dataUrl) {
        try { localStorage.setItem('dum7.local.img.' + id, dataUrl); } catch (_) { throw new Error('พื้นที่ในเครื่องเต็ม ลองรูปที่เล็กลง'); }
      },
      async getImage(id) { try { return localStorage.getItem('dum7.local.img.' + id); } catch (_) { return null; } },
    };
  }

  function firestoreStore(cfg, key) {
    const base = (cfg.baseUrl || 'https://firestore.googleapis.com') + `/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents`;
    const q = `key=${encodeURIComponent(cfg.apiKey)}`;
    const check = async (res) => {
      if (!res.ok) throw new Error(`ฐานข้อมูลกลางตอบกลับ ${res.status}`);
      return res.json();
    };
    const fields = (sealed) => ({ fields: { ct: { stringValue: sealed.ct }, iv: { stringValue: sealed.iv } } });
    const read = (doc) => ({ ct: doc.fields.ct.stringValue, iv: doc.fields.iv.stringValue });

    return {
      mode: 'remote',
      async list() {
        const out = [];
        let token = '';
        do {
          const j = await check(await fetch(`${base}/${COL_OPS}?pageSize=300&${q}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`));
          for (const doc of j.documents || []) {
            try { out.push(await D7.open(key, read(doc), 'op')); } catch (_) { /* ไม่ใช่ของเรา (ถอดรหัสไม่ได้) ข้ามไป */ }
          }
          token = j.nextPageToken || '';
        } while (token);
        return out;
      },
      async add(op) {
        await check(await fetch(`${base}/${COL_OPS}?${q}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields(await D7.seal(key, op, 'op'))),
        }));
      },
      async putImage(id, dataUrl) {
        await check(await fetch(`${base}/${COL_IMG}?documentId=${encodeURIComponent(id)}&${q}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields(await D7.seal(key, { d: dataUrl }, 'img:' + id))),
        }));
      },
      async getImage(id) {
        try {
          const j = await check(await fetch(`${base}/${COL_IMG}/${encodeURIComponent(id)}?${q}`));
          return (await D7.open(key, read(j), 'img:' + id)).d;
        } catch (_) { return null; }
      },
    };
  }

  D7.createStore = (cfg, key) => (cfg && cfg.type === 'firestore' && cfg.projectId && cfg.apiKey ? firestoreStore(cfg, key) : localStore());

  /* ───────── รวมรายการทั้งหมดให้เป็นภาพปัจจุบัน ─────────
   * ชนิดรายการ (type): nick ฉายา · tag ป้าย · deed วีรกรรม · photo รูป · event นัดหมาย · del ถอนเรื่อง */
  D7.fold = (ops) => {
    const dead = new Set(ops.filter((o) => o.type === 'del').map((o) => o.target));
    const live = ops.filter((o) => o.type !== 'del' && !dead.has(o.id)).sort((a, b) => a.t - b.t);
    return {
      live,
      of: (type, friend) => live.filter((o) => o.type === type && (friend == null || o.friend === friend)),
      events: live.filter((o) => o.type === 'event'),
    };
  };
})();
