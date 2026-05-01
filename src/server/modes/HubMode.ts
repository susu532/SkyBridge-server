import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';

export class HubMode implements GameModeInfo {
  name = '/hub';
  allowPvP = false;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean {
    return true; // Entire hub is indestructible
  }

  private procCache = new Map<number, number>();

  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
    if (chunkType !== undefined) return chunkType;

    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);
    const hash = (fx & 0x3FFF) | ((fy + 60) & 0xFF) << 14 | ((fz & 0x3FFF) << 22);
    
    const cached = this.procCache.get(hash);
    if (cached !== undefined) return cached;

    const result = this.computeProceduralBlock(fx, fy, fz);
    if (this.procCache.size > 100000) {
      this.procCache.clear();
    }
    this.procCache.set(hash, result);
    return result;
  }

  private computeProceduralBlock(x: number, y: number, z: number): number {
    // Portal to SkyBridge (Force at Y=3 floor level)
    if (z === 15 && Math.abs(x) <= 2) {
       if (Math.abs(x) === 2) {
          if (y >= 3 && y <= 7) return BLOCK.OBSIDIAN;
       } else {
          if (y === 7) return BLOCK.OBSIDIAN;
          if (y >= 3 && y <= 6) return BLOCK.LAVA;
       }
    }
    
    const distSq = x * x + z * z;
    const dist = Math.sqrt(distSq);
    
    if (distSq <= 7225 && y >= -60 && y <= 0) { // Max radius 85, within world height bounds
      const radiusAtY = Math.sqrt(y + 60) * 11;
      const noise = (Math.sin(x * 0.1) + Math.cos(z * 0.1)) * 4;
      
      if (dist < radiusAtY + noise) {
         if (y === -60) return 1; // Bedrock
         if (y >= -60 && y < 0) return 1; // Stone/Dirt
         if (y === 0) return 115; // Polished Andesite
      }
    }
    return BLOCK.AIR;
  }

  getRespawnPosition(playerId: string, playerState?: any): {x: number, y: number, z: number} {
    const rx = (Math.random() - 0.5) * 2;
    const rz = (Math.random() - 0.5) * 2;
    return { x: 0.5 + rx, y: 7.5, z: 0.5 + rz };
  }
}
