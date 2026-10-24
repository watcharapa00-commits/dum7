/* forms.js — หน้าต่าง "ยื่นเรื่อง" สไตล์แบบคำร้องราชการ
 *
 * D7.openForm({ code, title, intro, fields, submitText, success, onSubmit })
 * ชนิดช่อง (type): text · textarea · date · time · select · chips · choice · image
 * onSubmit(values) ทำงานเสร็จแล้วหน้าต่างปิดเอง ถ้า throw Error จะโชว์ข้อความผิดพลาดให้แก้ต่อ
 */
(() => {
  'use strict';
  const D7 = window.D7;
  const { h } = D7;

  /* ───────── หน้าต่างลอยแบบเลื่อนขึ้นจากล่าง ───────── */
  D7.modal = ({ code, title, content, onClose }) => {
    const prevFocus = document.activeElement;
    const closeBtn = h('button', { class: 'sheet__x', type: 'button', 'aria-label': 'ปิดหน้าต่าง' }, 'ปิด');
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'sheet__head' }, h('span', { class: 'sheet__code' }, code), closeBtn),
      h('div', { class: 'sheet__body' }, content));
    const wrap = h('div', { class: 'sheet-wrap' }, h('div', { class: 'sheet-backdrop' }), sheet);
    document.body.append(wrap);
    document.body.classList.add('has-sheet');
    requestAnimationFrame(() => wrap.classList.add('is-open'));

    function close() {
      document.removeEventListener('keydown', onKey);
      wrap.classList.remove('is-open');
      document.body.classList.remove('has-sheet');
      setTimeout(() => wrap.remove(), 220);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      if (onClose) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    closeBtn.addEventListener('click', close);
    wrap.firstChild.addEventListener('click', close);
    return { close, el: sheet };
  };

  /* ───────── อ่านรูปแล้วย่อให้พอดีกับฐานข้อมูล ───────── */
  D7.readImage = (file, maxSide = 1000) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.74;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > 520000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดรูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG')); };
    img.src = url;
  });

  /* ───────── ช่องกรอกแต่ละชนิด: คืน { el, get() } ───────── */
  const FIELD = {
    text: (s, id) => {
      const input = h('input', { id, type: 'text', maxlength: s.max || 120, placeholder: s.placeholder || '', autocomplete: 'off', value: s.value || '' });
      return { el: input, get: () => input.value.trim() };
    },
    textarea: (s, id) => {
      const t = h('textarea', { id, rows: s.rows || 4, maxlength: s.max || 800, placeholder: s.placeholder || '' }, s.value || '');
      return { el: t, get: () => t.value.trim() };
    },
    date: (s, id) => {
      const i = h('input', { id, type: 'date', value: s.value || '' });
      return { el: i, get: () => i.value };
    },
    time: (s, id) => {
      const i = h('input', { id, type: 'time', value: s.value || '' });
      return { el: i, get: () => i.value };
    },
    select: (s, id) => {
      const sel = h('select', { id }, s.options.map((o) => h('option', { value: o.value, selected: o.value === s.value }, o.label)));
      return { el: sel, get: () => sel.value };
    },
    // เลือกได้หลายอัน เช่น เลือกเพื่อนที่เกี่ยวข้อง
    chips: (s) => {
      const picked = new Set(s.value || []);
      const wrap = h('div', { class: 'chips' }, s.options.map((o) => {
        const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(picked.has(o.value)) }, o.label);
        b.addEventListener('click', () => {
          picked.has(o.value) ? picked.delete(o.value) : picked.add(o.value);
          b.setAttribute('aria-pressed', String(picked.has(o.value)));
        });
        return b;
      }));
      return { el: wrap, get: () => [...picked] };
    },
    // เลือกจากตัวเลือกสำเร็จรูป หรือพิมพ์เองก็ได้
    choice: (s, id) => {
      let picked = '';
      const custom = h('input', { id, type: 'text', maxlength: s.max || 24, placeholder: s.placeholder || 'หรือพิมพ์เอง', autocomplete: 'off' });
      const btns = s.options.map((o) => {
        const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, o);
        b.addEventListener('click', () => {
          picked = picked === o ? '' : o;
          btns.forEach((x) => x.setAttribute('aria-pressed', String(x.textContent === picked)));
          if (picked) custom.value = '';
        });
        return b;
      });
      custom.addEventListener('input', () => { if (custom.value) { picked = ''; btns.forEach((x) => x.setAttribute('aria-pressed', 'false')); } });
      return { el: h('div', {}, h('div', { class: 'chips' }, btns), custom), get: () => custom.value.trim() || picked };
    },
    image: (s, id) => {
      let dataUrl = '';
      const preview = h('img', { class: 'upload__preview', alt: 'ตัวอย่างรูปที่เลือก', hidden: true });
      const status = h('span', { class: 'upload__status' }, 'ยังไม่ได้เลือกรูป');
      const input = h('input', { id, type: 'file', accept: 'image/*', class: 'upload__input' });
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        if (!f) return;
        status.textContent = 'กำลังย่อรูป...';
        try {
          dataUrl = await D7.readImage(f);
          preview.src = dataUrl;
          preview.hidden = false;
          status.textContent = `พร้อมยื่น (${Math.round(dataUrl.length / 1024)} KB)`;
        } catch (e) { dataUrl = ''; preview.hidden = true; status.textContent = e.message; }
      });
      return { el: h('div', { class: 'upload' }, input, status, preview), get: () => dataUrl };
    },
  };

  D7.openForm = (spec) => {
    const err = h('p', { class: 'form__err', role: 'alert' });
    const controls = {};
    const rows = spec.fields.map((s) => {
      const id = 'ff_' + s.name;
      const ctl = FIELD[s.type](s, id);
      controls[s.name] = { ctl, spec: s };
      return h('div', { class: 'form__row' },
        h('label', { for: id }, s.label, s.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : h('span', { class: 'opt' }, ' (ไม่บังคับ)')),
        ctl.el, s.help && h('small', {}, s.help));
    });
    const submit = h('button', { class: 'btn', type: 'submit' }, spec.submitText || 'ยื่นเรื่อง');
    const form = h('form', { class: 'form', novalidate: true },
      h('h3', { class: 'form__title' }, spec.title),
      spec.intro && h('p', { class: 'form__intro' }, spec.intro),
      rows, err, submit);
    const m = D7.modal({ code: spec.code, title: spec.title, content: form });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const values = {};
      for (const [name, { ctl, spec: s }] of Object.entries(controls)) {
        values[name] = ctl.get();
        const empty = Array.isArray(values[name]) ? !values[name].length : !values[name];
        if (s.required && empty) {
          err.textContent = `กรุณากรอก "${s.label}" ให้ครบก่อนยื่นเรื่อง`;
          (form.querySelector('#ff_' + name) || form.querySelector('.chips button'))?.focus();
          return;
        }
      }
      submit.disabled = true;
      submit.textContent = 'กำลังยื่นเรื่อง...';
      try {
        await spec.onSubmit(values);
        m.close();
        if (spec.success) D7.toast(spec.success);
      } catch (ex) {
        err.textContent = ex.message || 'ยื่นเรื่องไม่สำเร็จ ลองอีกครั้ง';
        submit.disabled = false;
        submit.textContent = spec.submitText || 'ยื่นเรื่อง';
      }
    });
    setTimeout(() => form.querySelector('input:not([type=file]),textarea,select')?.focus({ preventScroll: true }), 260);
    return m;
  };

  /* ผู้ยื่นเรื่อง: เลือกจากรายชื่อเพื่อน (จำไว้ในเครื่อง) หรือไม่ประสงค์ออกนาม */
  D7.byField = () => ({
    name: 'by', type: 'select', label: 'ผู้ยื่นเรื่อง', value: D7.getMe(),
    options: [{ value: '', label: 'ไม่ประสงค์ออกนาม' }, ...D7.state.data.friends.map((f) => ({ value: f.id, label: f.nickname }))],
  });
  D7.byName = (id) => (id ? (D7.state.data.friends.find((f) => f.id === id) || {}).nickname || 'ไม่ทราบนาม' : 'ผู้ไม่ประสงค์ออกนาม');
})();
