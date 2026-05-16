import express from 'express';
import cors from 'cors';

import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { Worker, MessageChannel } from 'worker_threads';
import { WebSocketServer } from 'ws';

const ALLOWED_ORIGIN = 'https://starplex-io.vercel.app';
const VALID_MODES = new Set(['hub', 'skybridge', 'skycastles', 'voidtrail', 'dungeondelver', 'battleroyale']);

async function startServer() {
  const app = express();

  app.use(cors({
    origin: 'https://starplex-io.vercel.app',
    methods: ['GET', 'POST']
  }));

  const PORT = process.env.PORT || 3000;
  const httpServer = createServer(app);

  const wss = new WebSocketServer({ noServer: true });

  const dbWorkerFile = path.join(process.cwd(), 'dist/src/server/DatabaseWorker.cjs');
  let dbWorker: Worker;
  if (fs.existsSync(dbWorkerFile)) {
     dbWorker = new Worker(dbWorkerFile, { execArgv: [] });
  } else {
     dbWorker = new Worker(path.join(process.cwd(), 'src/server/DatabaseWorker.ts'), { execArgv: process.execArgv });
  }

  // Handle WebSocket manual upgrade
  httpServer.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    if (origin && origin !== ALLOWED_ORIGIN) {
        socket.destroy();
        return;
    }

    if (request.url && request.url.startsWith('/ws/')) {
        let serverName = request.url.replace('/ws/', '').split('?')[0]; // e.g. hub_1
        if (!serverName.includes('_')) serverName += '_1';
        
        const mode = serverName.split('_')[0];

        if (!VALID_MODES.has(mode)) {
            socket.destroy();
            return;
        }
        
        let instances = activeInstances[mode];
        if (!instances) {
            getOrProvisionServer(mode);
            instances = activeInstances[mode];
        }
        
        let instance = instances.find(i => i.id === `/${serverName}`);
        if (!instance) {
            instance = instances[0];
            if (!instance) {
                socket.destroy();
                return;
            }
            serverName = instance.id.replace('/', '');
        }

        if (instance && instance.worker) {
            wss.handleUpgrade(request as any, socket, head, (ws) => {
                const { port1, port2 } = new MessageChannel();
                
                ws.on('message', (data: Buffer, isBinary) => {
                    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                    port1.postMessage({ type: 'message', data: ab, isBinary }, [ab]);
                });
                
                ws.on('close', () => {
                    port1.postMessage({ type: 'close' });
                    port1.close();
                });
                
                port1.on('message', (msg) => {
                    if (msg.type === 'message') {
                        ws.send(msg.data);
                    } else if (msg.type === 'close') {
                        ws.close();
                        port1.close();
                    }
                });
                
                port1.on('close', () => {
                    ws.close();
                });
                
                instance.worker.postMessage({ type: 'new_client', port: port2 }, [port2]);
            });
        } else {
            socket.destroy();
        }
    }
  });

  const activeInstances: Record<string, { id: string, name: string, playerLimit: number, emptySince?: number, playerCount?: number, worker: Worker, api: any }[]> = {};
  
  // Background Task Loop: Reaping empty instances (runs every 5 seconds)
  setInterval(() => {
    const now = Date.now();
    for (const baseName in activeInstances) {
      const instances = activeInstances[baseName];
      for (let i = instances.length - 1; i >= 0; i--) {
        const instance = instances[i];
        if (instance.playerCount === 0) {
          if (!instance.emptySince) {
            instance.emptySince = now;
          } else if (now - instance.emptySince > 5 * 60 * 1000) {
            // Only reap if there is more than 1 instance to keep the pool warm
            if (instances.length > 1) {
              console.log(`Reaping idle instance: ${instance.id}`);
              instance.worker.terminate();
              // The 'exit' event handler will remove it from the instances array
            }
          }
        } else {
          instance.emptySince = undefined;
        }
      }
    }
  }, 5000);
  
  function getOrProvisionServer(baseName: string) {
    if (!activeInstances[baseName]) {
      activeInstances[baseName] = [];
    }

    const instances = activeInstances[baseName];

    if (instances.length > 0) {
       let bestInstance = instances.find(i => (i.playerCount || 0) < i.playerLimit);
       if (bestInstance) {
           return bestInstance.id;
       }
    }

    // Need a new instance
    const newId = `/${baseName}_${instances.length + 1}`;
    
    // We launch GameServerWorker as a worker_thread to save memory compared to child processes
    const workerFile = path.join(process.cwd(), 'dist/src/server/GameServerWorker.cjs');

    const workerData = { BASE_NAME: baseName, INSTANCE_ID: newId };
    
    let execModule = workerFile;
    let execArgv = [];
    if (!fs.existsSync(workerFile)) {
       execModule = path.join(process.cwd(), 'src/server/GameServerWorker.ts');
       execArgv = process.execArgv; // Inherit tsx loaders if running in dev
    }

    const worker = new Worker(execModule, {
      execArgv: execArgv,
      workerData: workerData
    });

    worker.on('message', (msg: any) => {
        if (msg.type === 'save_chunks' || msg.type === 'save_npcs') {
            dbWorker.postMessage(msg);
        } else if (msg.type === 'playerCount') {
            const list = activeInstances[baseName];
            if (list) {
                const instance = list.find(i => i.id === newId);
                if (instance) {
                    instance.playerCount = msg.count;
                }
            }
        }
    });

    worker.on('error', (err) => {
        console.error(`Worker ${newId} encountered an error:`, err);
        worker.terminate();
    });

    worker.on('exit', (code) => {
        console.log(`Worker ${newId} exited with code ${code}. Cleaning up active instances.`);
        const list = activeInstances[baseName];
        if (list) {
            const index = list.findIndex(i => i.id === newId);
            if (index !== -1) list.splice(index, 1);
        }
    });

    const api = {
      destroy: () => {
        worker.terminate();
      }
    };
    
    instances.push({ id: newId, name: baseName, playerLimit: 50, worker, api });
    console.log(`Provisioned new server child instance: ${newId}`);
    return newId;
  }

  // Pre-warm the instances (Hub allows up to 100 or something, but let's stick to 50 for everything as requested)
  getOrProvisionServer('hub');
  getOrProvisionServer('skybridge');
  getOrProvisionServer('skycastles');
  getOrProvisionServer('voidtrail');
  getOrProvisionServer('dungeondelver');
  getOrProvisionServer('battleroyale');
  getOrProvisionServer('skyisland');

  app.get('/api/matchmake', (req, res) => {
    let mode = (req.query.mode as string) || 'hub';
    if (mode.includes('_')) {
       mode = mode.split('_')[0];
    }
    if (!VALID_MODES.has(mode)) {
       res.status(400).json({ error: 'Invalid game mode' });
       return;
    }
    const serverId = getOrProvisionServer(mode);
    res.json({ serverId });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
