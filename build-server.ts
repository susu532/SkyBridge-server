import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.cjs',
  format: 'cjs',
  external: ['express', 'socket.io', 'vite']
}).catch(() => process.exit(1));
