import { context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const build = await context({
  entryPoints: ['src/main.jsx'], bundle: true, outfile: 'public/bundle.js',
  sourcemap: true, define: { 'process.env.NODE_ENV': '"development"' },
});
await build.watch();
const { port } = await build.serve({ host: '0.0.0.0', port: 4173, servedir: 'public' });
console.log(`Field Notes reproduction: http://localhost:${port}`);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  await build.dispose();
  process.exit(0);
});
