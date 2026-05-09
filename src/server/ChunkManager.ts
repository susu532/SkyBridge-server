import { CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from './constants';
import Database from 'better-sqlite3';

export class ChunkManager {
  worldName: string;
  db: Database.Database;
  
  // Memory efficient chunk storage (sparse)
  // Instead of Uint16Array, we store a Record of modified blocks per chunk.
  chunks: Map<string, Record<string, number>> = new Map();
  dirtyChunks: Set<string> = new Set();
  
  cachedBlockChanges: Record<string, number> | null = null;
  
  insertChunk: Database.Statement;
  getChunk: Database.Statement;
  getAllChunks: Database.Statement;

  constructor(worldName: string, db: Database.Database) {
    this.worldName = worldName;
    this.db = db;
    this.insertChunk = db.prepare(`INSERT OR REPLACE INTO chunk_data (world, chunk_id, data) VALUES (?, ?, ?)`);
    this.getChunk = db.prepare(`SELECT data FROM chunk_data WHERE world = ? AND chunk_id = ?`);
    this.getAllChunks = db.prepare(`SELECT chunk_id, data FROM chunk_data WHERE world = ?`);
    this.getBlockChangesDict(); // Initialize cache on startup
  }

  getChunkChanges(cx: number, cz: number, createIfMissing: boolean = true) {
    const key = `${cx},${cz}`;
    let changes = this.chunks.get(key);
    
    if (!changes && createIfMissing) {
      // Try to load from DB
      try {
        const row = this.getChunk.get(this.worldName, key) as any;
        if (row) {
          changes = JSON.parse(row.data) as Record<string, number>;
          this.chunks.set(key, changes);
          return changes;
        }
      } catch (err) {
        console.error('Error loading chunk from DB:', err);
      }

      // Create new empty chunk changes
      changes = {};
      this.chunks.set(key, changes);
    }
    return changes;
  }
  
  // For backwards compatibility where getChunkArray was called just to force load
  getChunkArray(cx: number, cz: number, createIfMissing: boolean = true) {
    this.getChunkChanges(cx, cz, createIfMissing);
    return null; // The old code expected an array, but actually only getBlockFromChunk used it. GameServer uses it for isIndestructible.
  }
  
  setBlockInChunk(cx: number, cz: number, lx: number, ly: number, lz: number, type: number) {
    if (ly >= 0 && ly < CHUNK_HEIGHT) {
      const changes = this.getChunkChanges(cx, cz, true)!;
      // Use world coordinates for key since it's easier to parse back, as done previously
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const wy = ly + WORLD_Y_OFFSET;
      const key = `${wx},${wy},${wz}`;
      
      changes[key] = type;
      this.dirtyChunks.add(`${cx},${cz}`);
      
      if (this.cachedBlockChanges) {
        this.cachedBlockChanges[key] = type;
      }
    }
  }

  getBlockFromChunk(cx: number, cz: number, lx: number, ly: number, lz: number) {
    if (ly >= 0 && ly < CHUNK_HEIGHT) {
      const changes = this.getChunkChanges(cx, cz, false);
      if (changes) {
         const wx = cx * CHUNK_SIZE + lx;
         const wz = cz * CHUNK_SIZE + lz;
         const wy = ly + WORLD_Y_OFFSET;
         const key = `${wx},${wy},${wz}`;
         if (changes[key] !== undefined) return changes[key];
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
    const CHUNK_SAVE_LIMIT = 50; // Increased limit because saving is much faster now
    const chunksArray = Array.from(this.dirtyChunks).slice(0, CHUNK_SAVE_LIMIT);
    
    try {
      const saveTransaction = this.db.transaction((wName: string, chunksToSave: string[]) => {
        for (const chunkId of chunksToSave) {
          const changes = this.chunks.get(chunkId);
          if (changes) {
            this.insertChunk.run(wName, chunkId, JSON.stringify(changes));
            savedCount++;
          }
          this.dirtyChunks.delete(chunkId);
        }
      });
      saveTransaction(this.worldName, chunksArray);
    } catch (err) {
      console.error('Error saving chunks to DB:', err);
    }
    return savedCount;
  }

  unloadIdleChunks(players: Record<string, any>, renderDistance: number) {
    // Keep chunks that are within renderDistance + 2 margin of any player
    const activeChunkCoords = new Set<string>();
    for (const pid in players) {
      const p = players[pid];
      if (!p.position) continue;
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
        unloadedCount++;
      }
    }

    if (unloadedCount > 0) {
      console.log(`[${this.worldName}] Unloaded ${unloadedCount} chunks from memory.`);
    }
  }

  resetWorld() {
    this.chunks.clear();
    this.dirtyChunks.clear();
    this.cachedBlockChanges = null;
    try {
      const stmt = this.db.prepare(`DELETE FROM chunk_data WHERE world = ?`);
      stmt.run(this.worldName);
      console.log(`[${this.worldName}] World has been completely reset.`);
    } catch (e) {
      console.error('Error resetting world map:', e);
    }
  }

  getBlockChangesDict() {
    if (this.cachedBlockChanges === null) {
      this.cachedBlockChanges = {};
      
      try {
        const rows = this.getAllChunks.all(this.worldName) as any[];
        for (const row of rows) {
          const chunkBlocks = JSON.parse(row.data);
          for (const k of Object.keys(chunkBlocks)) {
            this.cachedBlockChanges[k] = chunkBlocks[k];
          }
        }
      } catch (err) {
        console.error('Error fetching chunk dict from DB:', err);
      }

      // Memory override not needed initially since this runs in constructor
    }
    return this.cachedBlockChanges;
  }
}
