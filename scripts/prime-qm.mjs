import { mkdirSync, writeFileSync } from 'node:fs';
import { client } from './qm-session.mjs';

// Before a clean rehearsal: QM's per-user memory is injected into every turn, so
// earlier runs' notes would reach the agent. Back it up, keep only the onboarding
// marker (so QM does not restart onboarding), and archive every open session.
// usage: node scripts/prime-qm.mjs <backup-dir> | --check
const out = process.argv[2];
if (!out) { console.error('usage: node scripts/prime-qm.mjs <backup-dir> | --check'); process.exit(2); }
const KEEP = '## Onboarding\n- Onboarding: completed v2 on 2026-09-27.\n';
// Published apps cannot be archived through the web API; renaming frees the name the agent might reuse.
const ARCHIVED = 'rehearsal-archive-';

const api = await client();
if (out === '--check') {
  const memory = await (await api.get('/api/memory')).json();
  const listed = await (await api.get('/api/sessions')).json();
  const open = (listed.sessions ?? listed).filter(s => !s.archived);
  console.log(memory.content === KEEP ? 'QM memory: onboarding marker only.' : `QM memory holds earlier notes:\n${memory.content}`);
  console.log(`QM sessions open: ${open.length}${open.length ? ` (${open.map(s => s.title).join('; ')})` : ''}`);
  const apps = ((await (await api.get('/api/deployments')).json()).deployments ?? []).filter(d => !String(d.name).startsWith(ARCHIVED));
  console.log(`QM published apps from earlier runs: ${apps.length}${apps.length ? ` (${apps.map(d => d.name).join(', ')})` : ''}`);
  await api.dispose();
  process.exit(memory.content === KEEP && !open.length && !apps.length ? 0 : 1);
}
mkdirSync(out, { recursive: true });
try {
  const memory = await (await api.get('/api/memory')).json();
  writeFileSync(`${out}/qm-memory.json`, JSON.stringify(memory, null, 2));
  if (memory.content !== KEEP) {
    const put = await api.put('/api/memory', { data: { content: KEEP, revision: String(memory.revision ?? '') } });
    if (!put.ok()) throw new Error(`memory reset failed: HTTP ${put.status()} ${await put.text()}`);
  }
  const after = await (await api.get('/api/memory')).json();
  if (after.content !== KEEP) throw new Error('memory reset did not take effect');
  console.log(`QM memory: reset to the onboarding marker (was revision ${memory.revision}; backup ${out}/qm-memory.json)`);

  const listed = await (await api.get('/api/sessions')).json();
  const sessions = (listed.sessions ?? listed).filter(s => !s.archived);
  writeFileSync(`${out}/qm-sessions.json`, JSON.stringify(sessions, null, 2));
  for (const s of sessions) {
    const r = await api.post(`/api/sessions/${encodeURIComponent(s.id)}`, { data: { archived: true } });
    if (!r.ok()) throw new Error(`archiving session ${s.id} failed: HTTP ${r.status()}`);
  }
  console.log(`QM sessions: archived ${sessions.length} (list in ${out}/qm-sessions.json)`);
  const apps = ((await (await api.get('/api/deployments')).json()).deployments ?? []).filter(d => !String(d.name).startsWith(ARCHIVED));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).toLowerCase();
  writeFileSync(`${out}/qm-apps.json`, JSON.stringify(apps.map(({ gitUrl, ...d }) => d), null, 2));
  for (const [i, d] of apps.entries()) {
    const r = await api.post(`/api/deployments/${encodeURIComponent(d.id)}/name`, { data: { name: `${ARCHIVED}${stamp}-${i + 1}` } });
    if (!r.ok()) throw new Error(`renaming published app ${d.name} failed: HTTP ${r.status()} ${await r.text()}`);
  }
  console.log(`QM published apps: renamed ${apps.length} to ${ARCHIVED}… (list in ${out}/qm-apps.json)`);
} finally {
  await api.dispose();
}
