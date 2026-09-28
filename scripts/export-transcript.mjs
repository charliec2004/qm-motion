import { writeFileSync } from 'node:fs';
import { client } from './qm-session.mjs';

// Export one QM session as a readable, sanitized Markdown transcript for the repo.
// Drops the model's private reasoning, internal call IDs and scope labels; redacts
// email addresses and tokens; truncates long tool output.
// usage: node scripts/export-transcript.mjs <session-id> <out.md> "<title>"
const [id, out, title = 'QM session transcript'] = process.argv.slice(2);
if (!id || !out) { console.error('usage: node scripts/export-transcript.mjs <session-id> <out.md> "<title>"'); process.exit(2); }

const api = await client();
const res = await api.get(`/api/sessions/${encodeURIComponent(id)}`);
if (!res.ok()) throw new Error(`session ${id}: HTTP ${res.status()}`);
const { entries } = await res.json();
await api.dispose();

const clean = s => String(s ?? '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<user>')
  .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<token>')
  .replace(/\b(sk|gbrain_cl|gbrain_cs|ghp|gho|xox[bp])[-_][\w-]{8,}/g, '<token>')
  .replace(/(authorization|bearer|password|secret|api[_-]?key)(["':= ]+)[^\s"',]+/gi, '$1$2<redacted>');
const cut = (s, max) => { s = clean(s).replace(/\s+$/, ''); return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more characters)` : s; };
const fence = s => `\`\`\`text\n${s.replace(/```/g, "'''")}\n\`\`\``;
const time = ms => new Date(Number(ms)).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
const oneLine = s => clean(s).split('\n')[0].slice(0, 110);

const calls = new Map();
const lines = [`# ${title}`, '',
  `Exported from QM session \`${id.slice(0, 8)}\` by \`scripts/export-transcript.mjs\`. Times are Pacific. The model's`,
  'private reasoning, internal IDs and scope labels are omitted; addresses and tokens are redacted; long tool output is',
  'truncated. Each tool call is collapsed: click to expand the command and its result.', ''];
let prompt = 0;
for (const e of entries) {
  const p = e.payload ?? {};
  if (e.type === 'user') {
    prompt += 1;
    lines.push('---', '', `## Prompt ${prompt} (${time(e.createdAt)})`, '', ...clean(p.text).split('\n').map(l => `> ${l}`), '');
  } else if (e.type === 'text') {
    lines.push(`**Agent:** ${clean(p.text)}`, '');
  } else if (e.type === 'assistant') {
    const took = p.workStartedAt && p.workFinishedAt ? ` after ${Math.round((p.workFinishedAt - p.workStartedAt) / 1000)} s of work` : '';
    lines.push(`### Agent reply (${time(e.createdAt)}${took})`, '', clean(p.text), '');
  } else if (e.type === 'tool_call') {
    calls.set(p.callId, p);
  } else if (e.type === 'tool_result') {
    const c = calls.get(p.callId) ?? p;
    let head, body;
    if (c.tool === 'execute') {
      head = `execute: ${oneLine(c.command)}`;
      body = `$ ${cut(c.command, 1500)}\n\n${cut(p.stdout, 2500)}${p.stderr ? `\n[stderr]\n${cut(p.stderr, 800)}` : ''}\n[exit ${p.code}${p.timedOut ? ', timed out' : ''}]`;
    } else if (c.tool === 'motion_view') {
      head = `motion_view: ${c.path} (the model sees this image)`;
      body = cut(p.result, 600);
    } else if (c.tool === 'attach') {
      head = `attach: ${(c.files ?? []).map(f => f.split('/').pop()).join(', ')}`;
      body = cut(p.result, 600);
    } else if (c.tool === 'background') {
      head = `background ${c.action}: ${oneLine(c.command ?? p.processId ?? '')}`;
      body = cut(p.output ?? p.result, 1200);
    } else {
      head = `${c.tool}: ${oneLine(c.path ?? c.name ?? c.dir ?? '')}`;
      body = cut(p.result, 800);
    }
    lines.push(`<details><summary>🔧 ${head.replace(/</g, '&lt;')}</summary>`, '', fence(body), '', '</details>', '');
  }
}
writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`wrote ${out}: ${prompt} prompts, ${calls.size} tool calls`);
