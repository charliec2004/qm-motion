import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, cp, rm, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { mergeImmediateFiles, patchBundle, applyWebUi, baseAsset } from './apply-web-ui.mjs';

const core = process.env.QM_CORE_SOURCE;
const web = process.env.QM_WEB_ROOT;
assert.ok(core && web, 'set QM_CORE_SOURCE to a patched isolated core source and QM_WEB_ROOT to the extracted pinned web image');
let collection;
const collects = [];
const discarded = [];
mock.module(pathToFileURL(join(core, 'src/core/attachments.ts')).href, {
  namedExports: {
    MAX_OUTBOUND_FILES: 20,
    collectNamedOutbound: async (...args) => { collects.push(args); return collection; },
    discardOutbound: async (...args) => { discarded.push(args); },
  },
});
mock.module(pathToFileURL(join(core, 'src/sandbox/sandbox.ts')).href, {
  namedExports: { hasParentPathSegment: (p) => p.split(/[\\/]/).includes('..') },
});
const { createAttachStaging } = await import(pathToFileURL(join(core, 'src/core/orchestrator/attach-tool.ts')).href);
const attachment = (id = 'sheet') => ({ name: id + '.png', artifactId: id, blobId: id + '-blob', mimetype: 'image/png', sizeBytes: 42 });
const collected = (...files) => ({ attachments: files, missing: [], empty: [], oversized: [], createdArtifactIds: new Set(files.map(f => f.artifactId)) });
const context = (immediate = true) => ({ immediate, sandbox: {}, provision: async () => ({}), blobTransfer: {}, fileRegistration: { seed: 'run', ownerScopeId: 'personal:owner', createdInScope: 'conversation:current', onRegistered: () => {} } });

await test('ordinary attach remains queued and immediate files do not replace staged files', async () => {
  const ctx = context(); const stage = createAttachStaging(ctx);
  collection = collected(attachment('final'));
  assert.equal((await stage.attach(['final.png'])).delivery, undefined);
  collection = collected(attachment('interim'));
  const result = await stage.attach(['final.png'], 'immediate');
  assert.equal(result.delivery, 'immediate'); assert.equal(result.staged, 1);
  assert.deepEqual(stage.staged(), [attachment('final')]);
  assert.equal(collects.at(-1)[4].onRegistered, ctx.fileRegistration.onRegistered);
  assert.deepEqual(collects.at(-1)[5], ['final.png']);
  assert.equal(discarded.length, 0);
});
await test('immediate-only call leaves no files queued for closing reply', async () => {
  collection = collected(attachment()); const stage = createAttachStaging(context());
  const result = await stage.attach([' sheet.png ', 'sheet.png', ''], 'immediate');
  assert.equal(result.ok, true); assert.deepEqual(collects.at(-1)[2], ['sheet.png']);
  assert.equal(result.staged, 0); assert.deepEqual(stage.staged(), []);
});
await test('unsupported surface and unknown delivery fail before provisioning', async () => {
  const before = collects.length;
  assert.equal((await createAttachStaging(context(false)).attach(['sheet.png'], 'immediate')).ok, false);
  assert.equal((await createAttachStaging(context()).attach(['sheet.png'], 'wrong')).ok, false);
  assert.equal(collects.length, before);
});
await test('empty, traversal and count boundaries reject without collection', async () => {
  const stage = createAttachStaging(context()); const before = collects.length;
  for (const paths of [[], ['../secret'], ['x\\..\\secret'], Array.from({ length: 21 }, (_, i) => `${i}.png`)])
    assert.equal((await stage.attach(paths, 'immediate')).ok, false);
  assert.equal(collects.length, before);
});
await test('missing/empty/oversized batch never reports success or changes staged files', async () => {
  const stage = createAttachStaging(context()); collection = collected(attachment('final'));
  await stage.attach(['final.png']);
  for (const key of ['missing', 'empty', 'oversized']) {
    collection = { ...collected(), [key]: ['bad.png'] };
    assert.equal((await stage.attach(['bad.png'], 'immediate')).ok, false);
    assert.deepEqual(stage.staged(), [attachment('final')]);
  }
});
await test('registration failure cannot claim immediate delivery and discards transferred files', async () => {
  collection = collected({ ...attachment(), artifactId: undefined });
  const stage = createAttachStaging(context()); const before = discarded.length;
  const result = await stage.attach(['sheet.png'], 'immediate');
  assert.equal(result.ok, false); assert.match(result.message, /register/);
  assert.equal(discarded.length, before + 1); assert.deepEqual(stage.staged(), []);
});
await test('attach tool forwards opt-in and records the marker only after confirmation', async () => {
  const source = stripTypeScriptTypes(await readFile(join(core, 'src/harness/agent-tools.ts'), 'utf8'));
  const block = source.slice(source.indexOf('const attach = defineTool('), source.indexOf('const finishSilently = defineTool('));
  let forwarded; let recorded;
  const Type = new Proxy({}, { get: () => () => ({}) });
  const tool = runInNewContext(block + ';attach', {
    Type, defineTool: x => x, ref: { current: { attach: async (...args) => { forwarded = args; return { ok: true, files: [attachment()], staged: 0, delivery: 'immediate' }; } } },
    text: x => x, recordCall: async () => {}, recordResult: async (_id, payload, output) => { recorded = payload; return output; },
  });
  const output = await tool.execute('call', { files: [' sheet.png '], delivery: 'immediate' });
  assert.deepEqual(Array.from(forwarded[0]), ['sheet.png']); assert.equal(forwarded[1], 'immediate');
  assert.equal(recorded.delivery, 'immediate'); assert.match(output, /attached immediately/);
});

const source = await readFile(join(web, 'dist-web/assets', baseAsset), 'utf8');
const patched = patchBundle(source);
const start = patched.indexOf('function Zy(');
const end = patched.indexOf('function ', start + 1);
const functionSource = patched.slice(start, end).replace(/async\s*$/, "");
const normalizer = files => files.map(f => ({ ...f }));
function liveApply(partial, activity, terminal = false, attachments = []) {
  let redraws = 0;
  const apply = runInNewContext(`const qmMergeImmediateFiles=${mergeImmediateFiles.toString()};${functionSource};Zy`, {
    sq: (work, run) => { work.activity = run.activity; return true; },
    oq: () => {}, mi: () => 1, Yg: () => {}, Nb: run => run.terminal,
    Vb: normalizer, lq: () => null, tp: () => false, rq: () => {},
    // Remaining branches use stream helpers only for nonempty replies/errors.
    fail: () => {}, Ld: () => {},
  });
  const result = apply({}, partial, { acc: '', lastProgressAt: 0 }, { activity, terminal, result: { status: 'ok', attachments } }, () => redraws++);
  return { result, redraws };
}
const event = (delivery = 'immediate', ok = true) => ({ type: 'tool_result', payload: { tool: 'attach', ok, delivery, files: [attachment()] } });
await test('actual shipped applyRun renders confirmed immediate image before terminal gate', () => {
  const partial = { work: { activity: [], status: 'working' } };
  const result = liveApply(partial, [event()]);
  assert.equal(result.result, 'open'); assert.ok(result.redraws > 0);
  assert.equal(partial.deliveredFiles[0].artifactId, 'sheet');
  liveApply(partial, [event()]); assert.equal(partial.deliveredFiles.length, 1);
});
await test('live renderer does not promote ordinary, failed, unrelated or unregistered files', () => {
  const partial = { work: { activity: [], status: 'working' } };
  liveApply(partial, [event('reply'), event('immediate', false), { ...event(), type: 'tool_call' }, { type: 'tool_result', payload: { ...event().payload, files: [{ name: 'path-only.png' }] } }]);
  assert.equal(partial.deliveredFiles, undefined);
});
await test('closing reply retains interim evidence and adds final files without duplicates', () => {
  const partial = { work: { activity: [], status: 'working' } };
  liveApply(partial, [event()]);
  liveApply(partial, [event()], true, [attachment('final')]);
  assert.deepEqual(Array.from(partial.deliveredFiles, f => f.artifactId), ['sheet', 'final']);
  liveApply(partial, [event()], true, [attachment('final')]);
  assert.equal(partial.deliveredFiles.length, 2);
});
function transcriptReplay(entries) {
  const at = patched.indexOf('function di(');
  const end = patched.indexOf('function ', at + 1);
  const replay = runInNewContext(patched.slice(at, end).replace(/async\s*$/, '') + ';di', {
    Vb: normalizer, YI: new Set(['tool_result', 'tool_call']), db: p => p.ok === true,
    QI: () => true, af: () => ({}), eT: () => null,
  });
  return replay(entries);
}
await test('actual shipped transcript replay retains the interim checkpoint if final file reuses its name', () => {
  const initial = { ...event(), seq: 1, createdAt: 100 };
  const final = { ...event('reply'), seq: 2, createdAt: 200,
    payload: { ...event('reply').payload, files: [{ ...attachment('final'), name: 'sheet.png' }] } };
  const finish = { type: 'assistant', seq: 3, createdAt: 300, payload: { text: 'Done' } };
  const messages = transcriptReplay([initial, final, finish]);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].deliveredFiles[0].artifactId, 'sheet');
  assert.equal(messages[1].deliveredFiles[0].artifactId, 'final');
});
await test('replay keeps ordinary attach queued across an immediate checkpoint, finish and delivery', () => {
  const queued = { type: 'tool_result', seq: 1, createdAt: 100,
    payload: { tool: 'attach', ok: true, files: [attachment('final')] } };
  const immediate = { type: 'tool_result', seq: 2, createdAt: 200,
    payload: { tool: 'attach', ok: true, delivery: 'immediate', files: [attachment('interim')] } };
  const finish = { type: 'assistant', seq: 3, createdAt: 300, payload: { text: 'Done' } };
  const delivery = { type: 'delivery', seq: 4, createdAt: 400,
    payload: { files: [attachment('final')] } };
  const fileIds = messages => Array.from(messages, m => Array.from(m.deliveredFiles ?? [], f => f.artifactId));
  // Reload at either active-run boundary must never expose the queued file.
  assert.deepEqual(fileIds(transcriptReplay([queued])), [[]]);
  assert.deepEqual(fileIds(transcriptReplay([queued, immediate])), [['interim'], []]);
  assert.deepEqual(fileIds(transcriptReplay([queued, immediate, finish])), [['interim'], ['final']]);
  const messages = transcriptReplay([queued, immediate, finish, delivery]);
  assert.deepEqual(fileIds(messages), [['interim'], ['final']]);
  assert.equal(messages[0].timestamp, 200);
  assert.equal(messages[1].timestamp, 300);
  assert.equal(messages[1].content[0].text, 'Done');
});
await test('web patch is pinned and changes the asset URL and gzip coherently', async () => {
  assert.throws(() => patchBundle(source + '\n'), /different version/);
  const root = await mkdtemp('/tmp/qm-interim-web-test-');
  try {
    await mkdir(join(root, 'dist-web/assets'), { recursive: true });
    await cp(join(web, 'dist-web/assets'), join(root, 'dist-web/assets'), { recursive: true });
    await cp(join(web, 'dist-web/index.html'), join(root, 'dist-web/index.html'));
    const asset = await applyWebUi(root);
    assert.ok((await readFile(join(root, 'dist-web/index.html'), 'utf8')).includes(asset));
    assert.ok(!(await readFile(join(root, 'dist-web/index.html'), 'utf8')).includes(baseAsset));
    const actual = await readFile(join(root, 'dist-web/assets', asset), 'utf8');
    assert.ok(actual.includes('qmMergeImmediateFiles'));
    assert.equal(gunzipSync(await readFile(join(root, 'dist-web/assets', asset + '.gz'))).toString(), actual);
    for (const name of await readdir(join(root, 'dist-web/assets'))) {
      if (!/\.(js|css)$/.test(name)) continue;
      const content = await readFile(join(root, 'dist-web/assets', name), 'utf8');
      assert.ok(!content.includes(baseAsset), `stale main import in ${name}`);
      for (const match of content.matchAll(/(?:["'])(?:\.\/)?([^"'\/]+-motion-[a-f0-9]{12}\.(?:js|css))["']/g))
        await readFile(join(root, 'dist-web/assets', match[1]));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
