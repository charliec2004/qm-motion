// Page sampler streams into the controller so a navigation cannot discard evidence.
export function installSampler({ watch }) {
  const M = window.__motion = { armed: null };
  for (const type of ['pointerdown', 'pointerover', 'keydown']) document.addEventListener(type, e => {
    const a = M.armed;
    if (!a || a.type !== type || (a.element && !a.element.contains(e.target))) return;
    if (type === 'keydown') {
      const parts = a.key.split('+'), key = parts.pop();
      const aliases = { Space: ' ', Esc: 'Escape', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight', Del: 'Delete' };
      if (e.key !== (aliases[key] ?? key) || e.shiftKey !== parts.includes('Shift') ||
          e.ctrlKey !== parts.includes('Control') || e.altKey !== parts.includes('Alt') || e.metaKey !== parts.includes('Meta')) return;
    }
    M.armed = null;
    window.__motionEvidence({ kind: 'event', id: a.id, event: type,
      wallMs: performance.timeOrigin + e.timeStamp, x: e.clientX ?? null, y: e.clientY ?? null,
      key: a.key ?? null });
  }, true);
  const tick = ts => {
    const elements = {};
    for (const w of watch) {
      const el = document.querySelector(w.selector);
      if (!el) { elements[w.name] = null; continue; }
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      elements[w.name] = { x: r.x, y: r.y, width: r.width, height: r.height,
        opacity: Number(cs.opacity), display: cs.display, visibility: cs.visibility, hidden: el.hidden,
        ...(w.attributes ? { attributes: Object.fromEntries(w.attributes.map(a => [a, el.getAttribute(a)])) } : {}),
        ...(w.styles ? { styles: Object.fromEntries(w.styles.map(a => [a, cs.getPropertyValue(a)])) } : {}) };
    }
    window.__motionEvidence({ kind: 'sample', wallMs: performance.timeOrigin + ts, elements });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function locate(page, a) {
  if (a.selector) return page.locator(a.selector);
  if (a.role) return page.getByRole(a.role, { name: a.name, exact: !!a.exact });
  return null;
}

// Direct pointer dispatch intentionally avoids Playwright's animation stability wait.
// Resolve strictly: an ambiguous target must not silently replay against a different control.
export async function perform(page, a, field, { recorded = false, timeout = 5000, deadline = Infinity, onDispatch = () => {} } = {}) {
  const dispatch = () => { if (Date.now() >= deadline) throw new Error('recording deadline reached before dispatch'); onDispatch(); };
  try {
    if (a.action === 'navigate') {
      dispatch();
      await page.goto(a.url, { waitUntil: 'commit', timeout });
      return;
    }
    const loc = locate(page, a);
    if (loc) {
      await loc.waitFor({ state: 'visible', timeout });
      const count = await loc.count();
      if (count !== 1) throw new Error(`target matched ${count} elements; use a unique locator`);
    }
    const type = { click: 'pointerdown', hover: 'pointerover', press: 'keydown' }[a.action];
    if (recorded) {
      if (loc) await loc.evaluate((element, armed) => { window.__motion.armed = { ...armed, element }; }, { id: a.id, type, key: a.key ?? null });
      else await page.evaluate(armed => { window.__motion.armed = armed; }, { id: a.id, type, key: a.key ?? null });
    }
    if (a.action === 'press') {
      if (loc) await loc.focus({ timeout });
      dispatch();
      await page.keyboard.press(a.key);
    } else {
      const { x, y } = await loc.evaluate(el => {
        if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') throw new Error('target is disabled; change the initial state');
        let r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) {
          el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          r = el.getBoundingClientRect();
        }
        if (r.width <= 0 || r.height <= 0) throw new Error('target has no visible bounds');
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        if (!el.contains(document.elementFromPoint(x, y))) throw new Error('target is covered; remove the overlay or change the initial state');
        return { x, y };
      });
      dispatch();
      if (a.action === 'click') await page.mouse.click(x, y);
      else await page.mouse.move(x, y);
    }
  } catch (e) {
    throw new Error(`${field} ${a.action} failed: ${String(e.message).split('\n')[0]}. Check the locator and initial state.`);
  }
}
