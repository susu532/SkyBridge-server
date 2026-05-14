import { parentPort } from 'worker_threads';
import Database from 'better-sqlite3';

const databases = new Map<string, Database.Database>();

const initDB = (filename: string) => {
  const instance = new Database(filename);
  instance.pragma('journal_mode = WAL');
  instance.pragma('synchronous = NORMAL');
  const integrity = instance.pragma('integrity_check') as { integrity_check: string }[];
  if (integrity[0].integrity_check !== 'ok') {
      throw new Error('Integrity check failed');
  }
  instance.exec(`
    CREATE TABLE IF NOT EXISTS chunk_data (
      world TEXT,
      chunk_id TEXT,
      data BLOB,
      PRIMARY KEY (world, chunk_id)
    );
    CREATE TABLE IF NOT EXISTS world_npcs (
      world TEXT,
      data TEXT,
      PRIMARY KEY (world)
    );
  `);
  
  return instance;
};

const getDB = (world: string) => {
  const sanitized = world.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `db_${sanitized}.db`;
  let db = databases.get(filename);
  if (!db) {
    db = initDB(filename);
    databases.set(filename, db);
  }
  return db;
};

setInterval(() => {
  for (const db of databases.values()) {
    try {
      db.pragma('wal_checkpoint(RESTART)');
    } catch (err) {
      console.error("DatabaseWorker WAL Checkpoint failed:", err);
    }
  }
}, 300_000);

let chunkQueue: { world: string, chunkId: string, data: string }[] = [];

setInterval(() => {
  if (chunkQueue.length > 0) {
    try {
      const queueCopy = [...chunkQueue];
      chunkQueue = [];
      
      const byWorld = new Map<string, typeof queueCopy>();
      for (const item of queueCopy) {
         if (!byWorld.has(item.world)) byWorld.set(item.world, []);
         byWorld.get(item.world)!.push(item);
      }
      
      for (const [world, items] of byWorld.entries()) {
         const db = getDB(world);
         const insertChunk = db.prepare(`INSERT OR REPLACE INTO chunk_data (world, chunk_id, data) VALUES (?, ?, ?)`);
         const saveTransaction = db.transaction((txItems: typeof items) => {
           for (const item of txItems) {
             insertChunk.run(item.world, item.chunkId, item.data);
           }
         });
         saveTransaction(items);
      }
    } catch (e) {
      console.error('Error in DatabaseWorker save_chunks batch:', e);
    }
  }
}, 1000);

parentPort?.on('message', (msg) => {
  if (msg.type === 'save_chunks') {
    const { world, chunksData } = msg;
    for (const chunk of chunksData) {
      chunkQueue.push({ world, chunkId: chunk.chunkId, data: chunk.data });
    }
  } else if (msg.type === 'save_npcs') {
    const { world, data } = msg;
    try {
      const db = getDB(world);
      const insertNPCs = db.prepare(`INSERT OR REPLACE INTO world_npcs (world, data) VALUES (?, ?)`);
      insertNPCs.run(world, data);
    } catch (e) {
      console.error('Error in DatabaseWorker save_npcs:', e);
    }
  } else if (msg.type === 'exit') {
    for (const db of databases.values()) {
       db.close();
    }
    process.exit(0);
  }
});

