import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts', 'src/server/GameServerWorker.ts', 'src/server/DatabaseWorker.ts', 'src/server/GenWorker.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outdir: 'dist',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
  external: ['express', 'socket.io', 'vite', 'better-sqlite3', 'ws', 'cors', 'piscina']
}).catch(() => process.exit(1));
