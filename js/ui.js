/** أدوات واجهة مشتركة */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const esc = (str) => String(str ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let toastTimer = null;
export function toast(message, ms = 2200) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const node = h('div', { class: 'toast' }, h('div', { class: 'toast__body', text: message }));
  document.body.append(node);
  toastTimer = setTimeout(() => node.remove(), ms);
}

/** نافذة سفلية */
export function sheet(title, contentNode, { onClose } = {}) {
  const close = () => { backdrop.remove(); onClose?.(); };
  const panel = h('div', { class: 'sheet' },
    h('div', { class: 'sheet__handle' }),
    title ? h('div', { class: 'sheet__title', text: title }) : null,
    contentNode
  );
  const backdrop = h('div', {
    class: 'sheet-backdrop',
    onclick: (e) => { if (e.target === backdrop) close(); }
  }, panel);
  document.body.append(backdrop);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  return { close, panel };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('تم النسخ');
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('تم النسخ'); } catch { toast('تعذّر النسخ'); }
    ta.remove();
    return true;
  }
}

export async function shareText(text, title = 'مع الله') {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return true; } catch { /* ألغى المستخدم */ }
  }
  return copyText(text);
}

export function vibrate(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* غير مدعوم */ }
}

const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const ar = (n) => String(n).replace(/\d/g, (d) => AR[+d]);

/** صيغة الجمع العربية للأيام والصفحات */
export function plural(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n % 100 >= 3 && n % 100 <= 10) return few;
  return many;
}

export const daysWord = (n) => `${ar(n)} ${plural(n, 'يوم', 'يومان', 'أيام', 'يومًا')}`;
export const pagesWord = (n) => `${ar(n)} ${plural(n, 'صفحة', 'صفحتان', 'صفحات', 'صفحة')}`;
