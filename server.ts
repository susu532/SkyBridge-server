import express from 'express';
import cors from 'cors';

import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { Worker, MessageChannel } from 'worker_threads';
import { WebSocketServer } from 'ws';

import Piscina from 'piscina';

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://starplex-io.vercel.app'];

function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true;
    if (ALLOWED_ORIGIN.includes(origin)) return true;
    if (origin === 'https://crazygames.com' || origin.endsWith('.crazygames.com')) return true;
    return false;
}

const VALID_MODES = new Set(['hub', 'skybridge', 'skycastles', 'voidtrail', 'dungeondelver', 'battleroyale','skyisland']);

async function startServer() {
  const app = express();

  app.use(cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST']
  }));

  const PORT = process.env.PORT || 3000;
  const httpServer = createServer(app);
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/feedback', express.json(), async (req, res) => {
    try {
      const { message } = req.body;
      if (message) {
        // Log to an ephemeral local file as a backup
        fs.appendFileSync(path.join(process.cwd(), 'feedback.txt'), `${new Date().toISOString()} - Feedback: ${message}\n`);
        console.log(`[Feedback Received]: ${message}`);

        // Send to Discord if webhook is configured
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
          if (!webhookUrl.includes('/api/webhooks/')) {
            console.error('Invalid Discord Webhook URL. It must contain "/api/webhooks/". You provided a regular channel link.');
            return res.json({ status: 'ok', warning: 'Invalid Discord Webhook URL configured in environment.' });
          }

          try {
            const discordRes = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `**New Game Feedback:**\n> ${message.replace(/\n/g, '\n> ')}`
              })
            });
            
            if (!discordRes.ok) {
              console.error('Discord Webhook returned an error:', discordRes.status, await discordRes.text());
            } else {
              console.log('Successfully forwarded feedback to Discord!');
            }
          } catch (discordError) {
            console.error('Failed to send to Discord webhook:', discordError);
          }
        } else {
          console.log('No DISCORD_WEBHOOK_URL environment variable configured. Feedback saved locally only.');
          return res.json({ status: 'ok', warning: 'DISCORD_WEBHOOK_URL not configured' });
        }
      }
      res.json({ status: 'ok' });
    } catch (e) {
      console.error('Error saving feedback', e);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  });
  
  const genWorkerFileNode = path.join(process.cwd(), 'dist/src/server/GenWorker.cjs');
  const fallbackTs = path.join(process.cwd(), 'src/server/GenWorker.ts');
  const genWorkerFileForPiscina = fs.existsSync(genWorkerFileNode) ? genWorkerFileNode : fallbackTs;
  
  const genWorkerPool = new Piscina({
    filename: genWorkerFileForPiscina,
    execArgv: fs.existsSync(genWorkerFileNode) ? [] : ['--require', 'tsx/cjs']
  });
  
  app.use((req, res, next) => {
    // COOP and COEP removed to fix mobile connection issues on LAN
    next();
  });

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
    if (!isOriginAllowed(origin)) {
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
            activeInstances[mode] = [];
            instances = activeInstances[mode];
        }
        
        let instance = instances.find(i => i.id === `/${serverName}`);
        if (!instance) {
            // Client is attempting to join a specific room (e.g., via a CrazyGames invite or lobby)
            getOrProvisionServer(mode, `/${serverName}`);
            instance = instances.find(i => i.id === `/${serverName}`);
            
            // Fallback (shouldn't happen unless getOrProvision fails)
            if (!instance) {
                instance = instances[0];
                serverName = instance.id.replace('/', '');
            }
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
          } else if (now - instance.emptySince > 1 * 60 * 1000) {
            // Only reap if there is more than 1 instance to keep the pool warm
            if (instances.length > 1) {
              console.log(`Reaping idle instance: ${instance.id}`);
              instance.worker.postMessage({ type: 'destroy' });
              
              // Fallback timeout to terminate if worker doesn't exit cleanly within 5 seconds
              setTimeout(() => {
                const list = activeInstances[baseName];
                if (list?.find(i => i.id === instance.id)) {
                   console.log(`Force terminating unresponsive instance after destroy signal: ${instance.id}`);
                   instance.worker.terminate();
                }
              }, 5000);
              // The 'exit' event handler will remove it from the instances array
            }
          }
        } else {
          instance.emptySince = undefined;
        }
      }
    }
  }, 5000);
  
  function getOrProvisionServer(baseName: string, forceId?: string) {
    if (!activeInstances[baseName]) {
      activeInstances[baseName] = [];
    }

    const instances = activeInstances[baseName];

    if (!forceId && instances.length > 0) {
       let bestInstance = instances.find(i => (i.playerCount || 0) < i.playerLimit);
       
       const MAX_INSTANCES = process.env.MAX_INSTANCES ? parseInt(process.env.MAX_INSTANCES) : 1;
       if (!bestInstance && instances.length >= MAX_INSTANCES) {
           // Fallback to least crowded instance if we hit max instance cap
           bestInstance = instances.sort((a, b) => (a.playerCount || 0) - (b.playerCount || 0))[0];
       }
       
       if (bestInstance) {
           return bestInstance.id;
       }
    }

    // Need a new instance
    let newId = forceId || `/${baseName}_${instances.length + 1}`;
    
    // Ensure uniqueness if forcing an ID that somehow got used (though highly unlikely, but safe to check)
    let duplicateIndex = 1;
    while(instances.find(i => i.id === newId)) {
        newId = forceId ? `${forceId}_dup${duplicateIndex++}` : `/${baseName}_${instances.length + duplicateIndex++}`;
    }
    
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

    worker.on('message', async (msg: any) => {
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
        } else if (msg.type === 'generate') {
            try {
                const res = await genWorkerPool.run(msg);
                worker.postMessage({ type: 'chunk_generated', cx: res.cx, cz: res.cz, worldName: res.worldName, data: res.data }, [res.data]);
            } catch (err) {
                console.error("Error generating chunk in pool:", err);
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
        worker.postMessage({ type: 'destroy' });
        setTimeout(() => {
           worker.terminate();
        }, 5000);
      }
    };
    
    const playerLimit = baseName === 'dungeondelver' ? 30 : 50;
    instances.push({ id: newId, name: baseName, playerLimit, worker, api });
    console.log(`Provisioned new server child instance: ${newId}`);
    return newId;
  }

  // Pre-warm the instances
  getOrProvisionServer('dungeondelver');

  app.get('/api/matchmake', (req, res) => {
    let mode = 'dungeondelver'; // Lock to dungeondelver
    let serverId = getOrProvisionServer(mode);
    
    res.json({ serverId: serverId.replace('/', '') });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Keep-alive mechanism to prevent Render free tier from sleeping (sleeps after 15m of inactivity)
    const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_EXTERNAL_URL) {
      setInterval(() => {
        fetch(`${RENDER_EXTERNAL_URL}/api/health`)
          .then(res => console.log(`[Keep-Alive] Pinged ${RENDER_EXTERNAL_URL}/api/health - Status: ${res.status}`))
          .catch(err => console.error(`[Keep-Alive] Error pinging server:`, err.message));
      }, 14 * 60 * 1000); // Ping every 14 minutes
      
      console.log(`[Keep-Alive] Configured to ping ${RENDER_EXTERNAL_URL}/api/health every 14 minutes`);
    }
  });
}

startServer();
