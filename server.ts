import { HubMode } from './src/server/modes/HubMode';
import { SkyBridgeMode } from './src/server/modes/SkyBridgeMode';
import { SkyCastlesMode } from './src/server/modes/SkyCastlesMode';
import { createGameServer } from './src/server/GameServer';
import express from 'express';

import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import itemsData from './data/items.json';
import npcsData from './src/game/data/npcs.json';
import bakedBlocksData from './data/bakedBlocks.json';

async function startServer() {
  const app = express();

  const PORT = process.env.PORT || 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { 
      origin: ["https://sky-bridge-teal-two.vercel.app", "https://sky-bridge-teal-two.vercel.app/"],
      methods: ["GET", "POST"]
    }
  });

  let db: Database.Database;
  try {
    db = new Database('skybridge.db');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_data (
        world TEXT,
        chunk_id TEXT,
        data TEXT,
        PRIMARY KEY (world, chunk_id)
      );
      CREATE TABLE IF NOT EXISTS world_npcs (
        world TEXT,
        data TEXT,
        PRIMARY KEY (world)
      );
    `);
  } catch (err) {
    console.warn("Database initialization failed (likely malformed), resetting skybridge.db...", err);
    if (fs.existsSync('skybridge.db')) fs.unlinkSync('skybridge.db');
    db = new Database('skybridge.db');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_data (
        world TEXT,
        chunk_id TEXT,
        data TEXT,
        PRIMARY KEY (world, chunk_id)
      );
      CREATE TABLE IF NOT EXISTS world_npcs (
        world TEXT,
        data TEXT,
        PRIMARY KEY (world)
      );
    `);
  }

  const insertChunk = db.prepare(`INSERT OR REPLACE INTO chunk_data (world, chunk_id, data) VALUES (?, ?, ?)`);
  const getChunk = db.prepare(`SELECT data FROM chunk_data WHERE world = ? AND chunk_id = ?`);
  const getAllChunks = db.prepare(`SELECT chunk_id, data FROM chunk_data WHERE world = ?`);

  const insertNPCs = db.prepare(`INSERT OR REPLACE INTO world_npcs (world, data) VALUES (?, ?)`);
  const getNPCs = db.prepare(`SELECT data FROM world_npcs WHERE world = ?`);



  const activeInstances: Record<string, { id: string, name: string, playerLimit: number, api: any, emptySince?: number }[]> = {};
  
  // Instance Reaper Loop: Destroy instances that have been empty for > 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const baseName in activeInstances) {
      const instances = activeInstances[baseName];
      for (let i = instances.length - 1; i >= 0; i--) {
        const instance = instances[i];
        if (io.of(instance.id).sockets.size === 0) {
          if (!instance.emptySince) {
            instance.emptySince = now;
          } else if (now - instance.emptySince > 5 * 60 * 1000) {
            // Keep at least 1 instance of each core mode
            if (i > 0 || baseName === 'hub_2') {
              console.log(`Reaping empty instance: ${instance.id}`);
              if (instance.api && instance.api.destroy) instance.api.destroy();
              io.of(instance.id).disconnectSockets(true);
              instances.splice(i, 1);
            }
          }
        } else {
          instance.emptySince = undefined;
        }
      }
    }
  }, 60000);

  function getModeFactory(baseName: string) {
    if (baseName === 'hub') return new HubMode();
    if (baseName === 'skybridge') return new SkyBridgeMode();
    if (baseName === 'skycastles') return new SkyCastlesMode('/skycastles');
    if (baseName === 'voidtrail') return new SkyCastlesMode('/voidtrail');
    return new HubMode();
  }

  function getOrProvisionServer(baseName: string) {
    if (!activeInstances[baseName]) {
      activeInstances[baseName] = [];
    }

    const instances = activeInstances[baseName];
    // Find an instance with space
    for (const instance of instances) {
      if (io.of(instance.id).sockets.size < instance.playerLimit) {
        return instance.id;
      }
    }

    if (instances.length >= 20) {
       // Just put them in the least full instance to prevent instance explosion
       let minSize = Infinity;
       let bestInstance = instances[0];
       for (const instance of instances) {
         const size = io.of(instance.id).sockets.size;
         if (size < minSize) {
           minSize = size;
           bestInstance = instance;
         }
       }
       return bestInstance.id;
    }

    // Need a new instance
    const newId = `/${baseName}_${instances.length + 1}`;
    const mode = getModeFactory(baseName);
    mode.name = newId; // override the namespace name
    const api = createGameServer(io, db, mode);
    
    instances.push({ id: newId, name: baseName, playerLimit: 50, api });
    console.log(`Provisioned new server instance: ${newId}`);
    return newId;
  }

  // Pre-warm the instances (Hub allows up to 100 or something, but let's stick to 50 for everything as requested)
  getOrProvisionServer('hub');
  getOrProvisionServer('skybridge');
  getOrProvisionServer('skycastles');
  getOrProvisionServer('voidtrail');

  app.get('/api/matchmake', (req, res) => {
    let mode = (req.query.mode as string) || 'hub';
    if (mode.includes('_')) {
       mode = mode.split('_')[0];
    }
    const serverId = getOrProvisionServer(mode);
    res.json({ serverId });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
