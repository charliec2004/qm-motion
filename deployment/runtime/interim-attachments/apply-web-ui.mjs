// Exact shipped QM CLI 0.1.12 web UI image; see README.md for base and source seam.
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, rm, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const baseAsset = 'main-bxZ5CHIJ.js';
export const baseSha256 = '787a31d98c9213ccf0aa25b0d1541aab0f588e9170b589369c6f9b1e03e81279';

// Uses the existing attachment normalizer and renderer, preserving current-run
// ownership. Only confirmed, opt-in attach results may promote files live.
export function mergeImmediateFiles(partial, activity, normalize) {
  const confirmed = (Array.isArray(activity) ? activity : []).flatMap((entry) => {
    const p = entry?.payload;
    return entry?.type === 'tool_result' && p?.tool === 'attach' &&
      p.ok === true && p.delivery === 'immediate' && Array.isArray(p.files)
      ? normalize(p.files.filter((f) => typeof f?.artifactId === 'string' && f.artifactId)) : [];
  });
  if (!confirmed.length) return false;
  const files = [...(partial.deliveredFiles ?? [])];
  const seen = new Set(files.map((f) => f.artifactId));
  for (const f of confirmed) {
    if (seen.has(f.artifactId)) continue;
    files.push(f);
    seen.add(f.artifactId);
  }
  if (files.length === (partial.deliveredFiles?.length ?? 0)) return false;
  partial.deliveredFiles = files;
  return true;
}

export function patchBundle(source) {
  if (createHash('sha256').update(source).digest('hex') !== baseSha256)
    throw new Error('unexpected QM web UI bundle; refusing to patch a different version');
  const replaceOnce = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('QM web UI patch seam is not unique');
    source = source.replace(before, after);
  };
  // Zy is core-bridge.ts applyRun, shared by SSE and polling. Inject before
  // the terminal gate, after mergeWork. The stream consumer shallow-copies
  // partials, so a work redraw alone cannot publish a new top-level file list.
  // An empty delta refreshes that copy without modifying assistant text.
  replaceOnce('function Zy(e,t,n,i,o){',
    `const qmMergeImmediateFiles=${mergeImmediateFiles.toString()};function Zy(e,t,n,i,o){`);
  replaceOnce('oq(s,i.stale===!0,o);const c=',
    'qmMergeImmediateFiles(t,i.activity,Vb)&&(e.push({type:"text_delta",contentIndex:0,delta:"",partial:t}),o?.());oq(s,i.stale===!0,o);const c=');
  // Keep interim files when final reply attachments arrive, deduping by ID.
  replaceOnce('t.deliveredFiles=l,o?.()',
    't.deliveredFiles=[...(t.deliveredFiles??[]).filter(f=>!l.some(a=>a.artifactId===f.artifactId)),...l],o?.()');
  // Checkpoint only immediate files; save the ordinary staged accumulator so
  // queued files neither leak into this message nor lose name-based restaging.
  replaceOnce('f.type==="tool_result"&&f.payload?.tool==="attach"&&db(f.payload)&&u(f.payload)',
    'f.type==="tool_result"&&f.payload?.tool==="attach"&&db(f.payload)&&(f.payload.delivery==="immediate"?(()=>{const queued=s;s=[];d(f.payload);h("",f.createdAt);s=queued})():u(f.payload))');
  // End-of-input may be a reload during an active turn. Only an actual reply
  // checkpoint or delivery event can publish ordinary staged attachments.
  replaceOnce('return r(),h(""),n}', 'return r(),s=[],h(""),n}');
  // Closing reply replay can already contain the staged files when its
  // authoritative delivery event arrives; merge that event by artifact ID.
  replaceOnce('g.deliveredFiles=[...g.deliveredFiles??[],...f];return',
    'g.deliveredFiles=[...(g.deliveredFiles??[]).filter(v=>!f.some(C=>C.artifactId&&C.artifactId===v.artifactId)),...f];return');
  return source;
}

export async function applyWebUi(root) {
  const assetPath = join(root, 'dist-web/assets', baseAsset);
  const source = await readFile(assetPath, 'utf8');
  const patched = patchBundle(source);
  const version = createHash('sha256').update(patched).digest('hex').slice(0,12);
  const assetDir = join(root, 'dist-web/assets');
  // The entry and provider chunks import one another. Rename the entire JS/CSS
  // graph and rewrite its references together; changing just the entry would
  // leave cached chunks importing a second, stale copy of the entry module.
  const names = (await readdir(assetDir)).filter((name) => /\.(js|css)$/.test(name));
  const renames = new Map(names.map((name) => [name, name.replace(/\.(js|css)$/, `-motion-${version}.$1`)]));
  const matcher = new RegExp(names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const rewrite = (content) => content.replace(matcher, (name) => renames.get(name));
  const htmlPath = join(root, 'dist-web/index.html');
  const html = await readFile(htmlPath, 'utf8');
  if (!html.includes(baseAsset)) throw new Error('QM web UI index does not reference pinned bundle');
  for (const name of names) {
    const content = name === baseAsset ? patched : await readFile(join(assetDir, name), 'utf8');
    const updated = rewrite(content);
    const target = join(assetDir, renames.get(name));
    await rename(join(assetDir, name), target);
    await writeFile(target, updated);
    await writeFile(target + '.gz', gzipSync(updated));
    await rm(join(assetDir, name + '.gz'), { force: true });
  }
  await writeFile(htmlPath, rewrite(html));
  await rm(htmlPath + '.gz', { force: true });
  const newAsset = renames.get(baseAsset);
  return newAsset;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(await applyWebUi(process.argv[2] ?? '/app'));
