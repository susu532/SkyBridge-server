import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts', 'src/server/GameServerWorker.ts', 'src/server/DatabaseWorker.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outdir: 'dist',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
  external: ['express', 'socket.io', 'vite', 'better-sqlite3']
}).catch(() => process.exit(1));
