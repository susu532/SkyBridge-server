import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: ['express', 'socket.io', 'vite', 'better-sqlite3']
}).catch(() => process.exit(1));
