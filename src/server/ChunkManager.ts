import { CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from './constants';
import Database from 'better-sqlite3';

export class ChunkManager {
  worldName: string;
  db: Database.Database;
  
  // Memory efficient chunk storage (sparse)
  // A single Uint16Array per chunk. 0xFFFF means unchanged!
  chunks: Map<string, Uint16Array> = new Map();
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
  }

  getChunkArray(cx: number, cz: number, createIfMissing: boolean = true) {
    const key = `${cx},${cz}`;
    let arr = this.chunks.get(key);
    
    if (!arr && createIfMissing) {
      // First, try to load from DB
      try {
        const row = this.getChunk.get(this.worldName, key) as any;
        if (row) {
          arr = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
          arr.fill(0xFFFF);
          const chunkBlocks = JSON.parse(row.data);
          for (const k of Object.keys(chunkBlocks)) {
             const parts = k.split(',');
             const xx = parseInt(parts[0], 10);
             const yy = parseInt(parts[1], 10);
             const zz = parseInt(parts[2], 10);
             
             const lx = ((xx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
             const lz = ((zz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
             const ly = yy - WORLD_Y_OFFSET;
             
             if (ly >= 0 && ly < CHUNK_HEIGHT) {
                const idx = lx | (lz << 4) | (ly << 8);
                arr[idx] = chunkBlocks[k];
             }
          }
          this.chunks.set(key, arr);
          return arr;
        }
      } catch (err) {
        console.error('Error loading chunk from DB:', err);
      }

      // Create new empty chunk
      arr = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
      arr.fill(0xFFFF); // 0xFFFF means unchanged from PCG
      this.chunks.set(key, arr);
    }
    return arr;
  }
  
  setBlockInChunk(cx: number, cz: number, lx: number, ly: number, lz: number, type: number) {
    if (ly >= 0 && ly < CHUNK_HEIGHT) {
      const arr = this.getChunkArray(cx, cz, true)!;
      const idx = lx | (lz << 4) | (ly << 8);
      arr[idx] = type;
      this.dirtyChunks.add(`${cx},${cz}`);
      
      if (this.cachedBlockChanges) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const wy = ly + WORLD_Y_OFFSET;
        this.cachedBlockChanges[`${wx},${wy},${wz}`] = type;
      }
    }
  }

  getBlockFromChunk(cx: number, cz: number, lx: number, ly: number, lz: number) {
    if (ly >= 0 && ly < CHUNK_HEIGHT) {
      const arr = this.getChunkArray(cx, cz, false);
      if (arr) {
         const idx = lx | (lz << 4) | (ly << 8);
         const type = arr[idx];
         if (type !== 0xFFFF) return type;
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
    try {
      const saveTransaction = this.db.transaction((wName: string, chunksToSave: string[]) => {
        for (const chunkId of chunksToSave) {
          const arr = this.chunks.get(chunkId);
          if (arr) {
            const [cxStr, czStr] = chunkId.split(',');
            const cx = parseInt(cxStr, 10);
            const cz = parseInt(czStr, 10);
            
            const chunkBlocks: Record<string, number> = {};
            for (let i = 0; i < arr.length; i++) {
              if (arr[i] !== 0xFFFF) {
                const ly = Math.floor(i / 256);
                const lz = Math.floor((i % 256) / 16);
                const lx = i % 16;
                const wx = cx * CHUNK_SIZE + lx;
                const wz = cz * CHUNK_SIZE + lz;
                const wy = ly + WORLD_Y_OFFSET;
                chunkBlocks[`${wx},${wy},${wz}`] = arr[i];
              }
            }
            this.insertChunk.run(wName, chunkId, JSON.stringify(chunkBlocks));
            savedCount++;
          }
        }
      });
      saveTransaction(this.worldName, Array.from(this.dirtyChunks));
      this.dirtyChunks.clear();
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

  getBlockChangesDict() {
    if (this.cachedBlockChanges === null) {
      this.cachedBlockChanges = {};
      
      // First, load from SQLite for the persistent state
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

      // Then, override with any dirty/unsaved chunks currently in memory
      for (const chunkId of this.dirtyChunks) {
        const arr = this.chunks.get(chunkId);
        if (arr) {
          const [cxStr, czStr] = chunkId.split(',');
          const cx = parseInt(cxStr, 10);
          const cz = parseInt(czStr, 10);
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] !== 0xFFFF) {
              const ly = Math.floor(i / 256);
              const lz = Math.floor((i % 256) / 16);
              const lx = i % 16;
              const wx = cx * CHUNK_SIZE + lx;
              const wz = cz * CHUNK_SIZE + lz;
              const wy = ly + WORLD_Y_OFFSET;
              this.cachedBlockChanges[`${wx},${wy},${wz}`] = arr[i];
            }
          }
        }
      }
    }
    return this.cachedBlockChanges;
  }
}
