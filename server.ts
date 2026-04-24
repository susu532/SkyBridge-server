import { createGameServer } from './src/server/GameServer';
import express from 'express';
import { createServer as createViteServer } from 'vite';
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
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  let db: Database.Database;
  try {
    db = new Database('skybridge.db');
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



  createGameServer(io, db, '/hub', 'hub_world_data.json', true);
  createGameServer(io, db, '/skybridge', 'world_data.json', false);
  createGameServer(io, db, '/skycastles', 'skycastles_world_data.json', false);
  createGameServer(io, db, '/voidtrail', 'voidtrail_world_data.json', false);
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
