// Explicit recorder injected only by our local-app preview proxy. No field values,
// cookies, or storage values enter the artifact. Download and attach the JSON to QM.
export function recorderSource() {
  return `(${installPreviewRecorder.toString()})();`;
}

export function installPreviewRecorder() {
  if (window.top !== window || document.getElementById('__motion-recorder')) return;
  const key = '__qm_motion_demonstration_v1';
  let state;
  try { state = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { state = null; }
  const root = document.createElement('div'); root.id = '__motion-recorder';
  root.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647';
  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>:host{font:14px system-ui;color:#111}section{background:white;border:1px solid #999;border-radius:8px;padding:12px;width:300px;box-shadow:0 2px 12px #0003}button,textarea,select{font:inherit;margin:4px 0}textarea{width:100%;box-sizing:border-box}p{margin:6px 0;font-size:12px}button{cursor:pointer}</style><section><strong>Demonstrate to QM Motion</strong><p>Start reloads this page. Use a logged-out page without saved app state. Clicks and control keys only; hover, scroll and drag are unsupported; 32 actions / 8 seconds. Input values are never recorded.</p><button id="start">Start recording</button> <button id="stop">Stop</button><p id="status"></p><label>Problem description<textarea id="description" maxlength="2000" placeholder="This jumps when I close it"></textarea></label><label>Align to action <select id="anchor"></select></label><button id="export">Export for QM</button><button id="discard">Discard</button><p id="handoff">Attach the exported JSON in your QM chat. Ask the agent to capture it; it already contains the locators.</p></section>`;
  document.documentElement.append(root);
  // Injection can run in <head>; keep recorder controls after the app in the
  // focus order so Tab sequences begin with the app's controls.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => document.body.append(root), { once: true });
  else document.body.append(root);
  const el = id => shadow.getElementById(id);
  const save = () => { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { el('status').textContent = 'Session storage unavailable; recording cannot survive navigation.'; } };
  const render = () => {
    el('stop').disabled = !state?.recording;
    el('export').disabled = !state || state.recording || !state.actions.length || state.unsupported.length > 0;
    el('start').disabled = !!state?.recording;
    el('status').textContent = state ? `${state.recording ? 'Recording' : 'Stopped'}: ${state.actions.length} actions. ${state.unsupported.join(' ')}` : 'Ready.';
    el('anchor').replaceChildren(...(state?.actions ?? []).map(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = `${a.id}: ${a.action} at +${a.atMs} ms`; return o; }));
  };
  const fail = message => { if (!state?.recording) return; if (!state.unsupported.includes(message)) state.unsupported.push(message); save(); render(); };
  const ignored = e => e.composedPath().includes(root);
  let navigationActivation = null;
  const linkDestination = target => {
    const link = target.closest?.('a[href]');
    if (!link) return null;
    const destination = new URL(link.href, location.href);
    const targetName = link.target || document.querySelector('base[target]')?.target;
    if (destination.origin !== location.origin || link.hasAttribute('download') || (targetName && targetName !== '_self')) {
      fail('External navigation, downloads and new tabs are unsupported. Use links within this local app.');
      return null;
    }
    return destination.href;
  };
  const locator = node => {
    let element = node.closest('button,a,[role="button"],[role="tab"],summary') || node;
    const path = [];
    while (element && element !== document.documentElement) {
      if (element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1) { path.unshift('#' + CSS.escape(element.id)); break; }
      const tag = element.localName;
      const siblings = Array.from(element.parentElement?.children ?? []).filter(x => x.localName === tag);
      path.unshift(`${tag}:nth-of-type(${siblings.indexOf(element) + 1})`);
      element = element.parentElement;
    }
    const selector = path.join(' > ');
    if (!selector || document.querySelectorAll(selector).length !== 1) throw new Error('Could not identify a unique target. Use a control with a stable ID.');
    return selector;
  };
  const append = action => {
    if (!state?.recording) return;
    const now = Date.now();
    if (now - state.startedWallMs > 8000 || state.actions.length >= 32) { stop(); return; }
    state.firstWallMs ??= now;
    state.actions.push({ ...action, id: `action-${state.actions.length + 1}`, atMs: now - state.firstWallMs }); save(); render();
  };
  const stop = () => { if (state) { state.recording = false; save(); render(); } };
  el('start').onclick = () => {
    if (location.search || location.hash) { el('status').textContent = 'Start from a URL without query or fragment values; navigate within the recording instead.'; return; }
    const storedState = document.cookie.length > 0 || localStorage.length > 0 || Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).some(k => k !== key);
    if (storedState) { el('status').textContent = 'Saved app state or cookies are present. Open a clean logged-out browser session, then record; credentials and storage cannot be exported.'; return; }
    state = { version: 1, recording: true, url: location.pathname, viewport: { width: innerWidth, height: innerHeight }, deviceScaleFactor: devicePixelRatio, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference', actions: [], unsupported: [], startedWallMs: Date.now(), firstWallMs: null, starting: true }; save(); location.reload();
  };
  el('stop').onclick = stop;
  el('discard').onclick = () => { state = null; sessionStorage.removeItem(key); render(); };
  el('export').onclick = () => {
    if (!state || state.recording || state.unsupported.length || !state.actions.length) return;
    const description = el('description').value.trim();
    if (!description) { el('status').textContent = 'Describe the problem before exporting.'; return; }
    const url = path => new URL(path, 'http://localhost:5173').href;
    const scenario = { name: 'user-demonstration', url: url(state.url), viewport: state.viewport, deviceScaleFactor: state.deviceScaleFactor, reducedMotion: state.reducedMotion,
      ready: { settleMs: 350 }, setup: [], actions: state.actions.map(a => a.action === 'navigate' ? { ...a, url: url(a.url) } : a),
      alignAction: el('anchor').value, watch: [], recordBeforeMs: 300, recordAfterMs: 800,
      demonstration: { description, initialState: 'Reloaded document; no detected script-readable cookies or app storage. User was instructed to use a logged-out page; HttpOnly cookies and server state cannot be inspected or exported.', unsupported: [], source: 'QM local dev-server preview', replayPort: 5173 } };
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob), a = document.createElement('a'); a.href = href; a.download = 'motion-demonstration.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
    el('status').textContent = 'Exported. Attach motion-demonstration.json to QM and describe what you want fixed.';
  };
  document.addEventListener('pointerdown', e => {
    if (!state?.recording || ignored(e)) return;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { fail('Modified/non-primary clicks are unsupported. Record an ordinary click.'); return; }
    if (!(e.target instanceof Element)) return;
    navigationActivation = null;
    linkDestination(e.target);
    if (e.target.closest('input,textarea,select,[contenteditable="true"],iframe')) { fail('Form input and embedded frames cannot be replayed safely. Demonstrate without entering values.'); return; }
    try { append({ action: 'click', selector: locator(e.target) }); } catch (error) { fail(error.message); }
  }, true);
  // Native clicks include Enter activation of a focused link. Keep the exact
  // destination and action, rather than treating any earlier click as navigation.
  document.addEventListener('click', e => {
    if (!state?.recording || ignored(e)) return;
    navigationActivation = null;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const destination = linkDestination(e.target);
    const action = state.actions.at(-1);
    if (destination && action && (action.action === 'click' || (action.action === 'press' && action.key === 'Enter'))) {
      navigationActivation = { destination, actionId: action.id, event: e };
    }
  }, true);
  document.addEventListener('keydown', e => {
    if (!state?.recording || ignored(e)) return;
    if (['Shift','Control','Alt','Meta'].includes(e.key)) return;
    navigationActivation = null;
    if (!['Escape','Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown',' '].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input,textarea,[contenteditable="true"]')) { fail('Text entry and keyboard shortcuts are unsupported; no typed values were saved.'); return; }
    if (e.key === 'Enter') {
      linkDestination(e.target);
      if (e.shiftKey && e.target.closest?.('a[href]')) fail('Modified link activation is unsupported. Use Enter without modifiers.');
    }
    append({ action: 'press', key: e.key === ' ' ? 'Space' : e.shiftKey ? `Shift+${e.key}` : e.key });
  }, true);
  document.addEventListener('wheel', e => { if (!ignored(e)) fail('Manual scrolling is unsupported. Restart with the controls visible in the initial viewport.'); }, { capture: true, passive: true });
  document.addEventListener('touchstart', e => { if (!ignored(e)) fail('Touch gestures are unsupported. Record with ordinary pointer clicks.'); }, { capture: true, passive: true });
  let pointerStart = null;
  document.addEventListener('pointerdown', e => { if (state?.recording && !ignored(e)) pointerStart = { x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener('pointerup', e => { if (pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 8) fail('Dragging is unsupported. Record ordinary clicks.'); pointerStart = null; }, true);
  for (const type of ['input','change','drop','paste','submit']) document.addEventListener(type, e => { if (!ignored(e)) fail('Form edits, submission and drag/drop are unsupported; record a sequence without them.'); }, true);
  window.addEventListener('resize', () => fail('Viewport changed. Restart at a fixed window size.'));
  window.addEventListener('popstate', () => fail('Browser back/forward is unsupported; use app navigation links.'));
  window.addEventListener('pagehide', () => {
    if (!state?.recording) return;
    state.expectedNavigation = navigationActivation && !navigationActivation.event.defaultPrevented && navigationActivation.actionId === state.actions.at(-1)?.id
      ? { destination: navigationActivation.destination, actionId: navigationActivation.actionId } : null;
    save();
  });
  if (state?.recording) {
    if (state.starting) {
      // Chromium can restore focus to the Start control across its reload.
      // Begin from the same unfocused document as a fresh replay instead.
      const resetFocus = () => { shadow.activeElement?.blur(); document.activeElement?.blur(); };
      if (document.readyState === 'complete') resetFocus();
      else window.addEventListener('load', resetFocus, { once: true });
      state.starting = false; state.startedWallMs = Date.now(); save();
    }
    else if (performance.getEntriesByType('navigation')[0]?.type !== 'navigate' || state.expectedNavigation?.destination !== location.href || state.expectedNavigation?.actionId !== state.actions.at(-1)?.id)
      fail('Page was reloaded or changed without a matching recorded link activation. Restart the demonstration.');
    if (innerWidth !== state.viewport.width || innerHeight !== state.viewport.height) fail('Viewport changed during navigation. Restart at a fixed window size.');
    state.expectedNavigation = false; save();
    setTimeout(stop, Math.max(0, 8000 - (Date.now() - state.startedWallMs)));
  }
  render();
}
