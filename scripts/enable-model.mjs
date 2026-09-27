import { readFileSync } from 'node:fs';
import { client } from './qm-session.mjs';
const api = await client();
try {
  const registry = await (await api.get('/admin/api/model-registry')).json();
  const spec = JSON.parse(readFileSync('deployment/model-gpt-6-sol.json', 'utf8'));
  const existing = registry.models.find(row => row.spec.id === spec.id);
  if (existing && !existing.disabled && !existing.unavailableReason && existing.verifiedAt) {
    console.log('GPT-6 Sol is already verified in QM.');
  } else {
    const response = await api.put('/admin/api/model-registry/' + spec.id, { data: { ...spec, verify: true }, timeout: 30000 });
    if (!response.ok()) throw new Error(`Model registration HTTP ${response.status()}: ${await response.text()}`);
    console.log('GPT-6 Sol verified through the supported QM administrator model registry.');
  }
  const runtime = await (await api.get('/api/runtime-config')).json();
  if (!runtime.scopeOverride) {
    const response = await api.put('/api/runtime-config', { data: {
      harnessId: 'pi', modelId: 'gpt-6-sol', effortLevel: 'low', fastMode: false,
    } });
    if (!response.ok()) throw new Error(`Runtime selection HTTP ${response.status()}`);
    console.log('Demo scope defaults to pi / GPT-6 Sol / low effort; existing scope choices are preserved on later starts.');
  }
} catch (error) {
  console.error(String(error.message).split('Call log:')[0]);
  process.exitCode = 1;
} finally { await api.dispose(); }
