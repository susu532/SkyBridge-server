import { CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from './constants';
import Database from 'better-sqlite3';
import { parentPort } from 'worker_threads';

export class ChunkManager {
  worldName: string;
  db: Database.Database;
  
  // Memory efficient chunk storage
  // Compressing chunk data into flat singular Uint16Array ensures contiguous memory
  chunks: Map<string, Uint16Array> = new Map();
  dirtyChunks: Set<string> = new Set();
  
  // Database preloaded chunks cache (cx,cz -> Uint16Array)
  dbChunks: Map<string, Uint16Array> = new Map();
  
  insertChunk: Database.Statement;
  getChunk: Database.Statement;
  getAllChunks: Database.Statement;

  constructor(worldName: string, db: Database.Database) {
    this.worldName = worldName;
    this.db = db;
    this.insertChunk = db.prepare(`INSERT OR REPLACE INTO chunk_data (world, chunk_id, data) VALUES (?, ?, ?)`);
    this.getChunk = db.prepare(`SELECT data FROM chunk_data WHERE world = ? AND chunk_id = ?`);
    this.getAllChunks = db.prepare(`SELECT chunk_id, data FROM chunk_data WHERE world = ?`);
    this.loadChunksFromDB(); // Initialize faster direct cache on startup
  }

  loadChunksFromDB() {
    try {
      const rows = this.getAllChunks.all(this.worldName) as any[];
      for (const row of rows) {
        if (!row || !row.data) continue;
        const key = row.chunk_id;
        let changes: Uint16Array;
        
        if (typeof row.data === 'string' && row.data.startsWith('{')) {
          const oldRecord = JSON.parse(row.data) as Record<string, number>;
          changes = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
          changes.fill(65535);
          for (const [k, v] of Object.entries(oldRecord)) {
            const [wx, wy, wz] = k.split(',').map(Number);
            const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const ly = wy - WORLD_Y_OFFSET;
            if (ly >= 0 && ly < CHUNK_HEIGHT) {
              changes[lx | (lz << 4) | (ly << 8)] = v;
            }
          }
        } else {
          // If row.data is a Buffer or has a buffer property
          const buffer = row.data.buffer || row.data;
          changes = new Uint16Array(
            buffer,
            row.data.byteOffset || 0,
            row.data.byteLength / 2
          );
        }
        this.dbChunks.set(key, changes);
      }
    } catch (err) {
      console.error('Error preloading chunks from DB:', err);
    }
  }

  getChunkChanges(cx: number, cz: number, createIfMissing: boolean = true) {
    const key = `${cx},${cz}`;
    let changes = this.chunks.get(key);
    if (changes) return changes;
    
    const dbChanges = this.dbChunks.get(key);
    if (dbChanges) {
      this.chunks.set(key, dbChanges);
      return dbChanges;
    }
    
    if (createIfMissing) {
      changes = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
      changes.fill(65535);
      this.chunks.set(key, changes);
      this.dbChunks.set(key, changes);
      return changes;
    }
    return undefined;
  }
  
  // For backwards compatibility where getChunkArray was called just to force load
  getChunkArray(cx: number, cz: number, createIfMissing: boolean = true) {
    this.getChunkChanges(cx, cz, createIfMissing);
    return null; 
  }
  
  setBlockInChunk(cx: number, cz: number, lx: number, ly: number, lz: number, type: number) {
    if (ly >= 0 && ly < CHUNK_HEIGHT) {
      const changes = this.getChunkChanges(cx, cz, true)!;
      changes[lx | (lz << 4) | (ly << 8)] = type;
      this.dirtyChunks.add(`${cx},${cz}`);
      this.dbChunks.set(`${cx},${cz}`, changes);
    }
  }

  getBlockFromChunk(cx: number, cz: number, lx: number, ly: number, lz: number) {
    if (ly >= 0 && ly < CHUNK_HEIGHT) {
      const changes = this.getChunkChanges(cx, cz, false);
      if (changes) {
         const type = changes[lx | (lz << 4) | (ly << 8)];
         if (type !== 65535) return type;
      }
    }
    return undefined;
  }

  markChunkDirty(x: number, z: number) {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    this.dirtyChunks.add(`${cx},${cz}`);
  }

  saveDirtyChunks() {
    if (this.dirtyChunks.size === 0) return 0;
    
    let savedCount = 0;
    const CHUNK_SAVE_LIMIT = 50;
    const chunksArray = Array.from(this.dirtyChunks).slice(0, CHUNK_SAVE_LIMIT);
    const chunksData: { chunkId: string, data: any }[] = [];
    
    for (const chunkId of chunksArray) {
      const changes = this.chunks.get(chunkId);
      if (changes) {
        chunksData.push({ chunkId, data: Buffer.from(changes.buffer) });
        savedCount++;
      }
      this.dirtyChunks.delete(chunkId);
    }

    if (chunksData.length > 0) {
      parentPort?.postMessage({
        type: 'save_chunks',
        world: this.worldName,
        chunksData
      });
    }

    return savedCount;
  }

  unloadIdleChunks(players: Record<string, any>, renderDistance: number) {
    const activeChunkCoords = new Set<string>();
    for (const p of Object.values(players)) {
      if (!p.position || p.isBot) continue;
      const pcx = Math.floor(p.position.x / CHUNK_SIZE);
      const pcz = Math.floor(p.position.z / CHUNK_SIZE);
      const margin = renderDistance + 2;
      for (let dx = -margin; dx <= margin; dx++) {
        for (let dz = -margin; dz <= margin; dz++) {
          activeChunkCoords.add(`${pcx + dx},${pcz + dz}`);
        }
      }
    }
    
    let unloadedCount = 0;
    for (const chunkId of this.chunks.keys()) {
      if (this.dirtyChunks.has(chunkId)) continue; // Never unload unsaved chunks
      if (!activeChunkCoords.has(chunkId)) {
        this.chunks.delete(chunkId);
        this.dbChunks.delete(chunkId);
        unloadedCount++;
      }
    }

    if (unloadedCount > 0) {
      console.log(`[${this.worldName}] Unloaded ${unloadedCount} chunks from memory.`);
    }
  }

  resetWorld() {
    this.chunks.clear();
    this.dbChunks.clear();
    this.dirtyChunks.clear();
    try {
      const stmt = this.db.prepare(`DELETE FROM chunk_data WHERE world = ?`);
      stmt.run(this.worldName);
      console.log(`[${this.worldName}] World has been completely reset.`);
    } catch (e) {
      console.error('Error resetting world map:', e);
    }
  }

  getBlockChangesDict() {
    return {};
  }
}
