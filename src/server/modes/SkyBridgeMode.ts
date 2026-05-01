import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';
import { getTerrainHeight, getTerrainMinHeight, noise2D, noise3D } from '../../game/TerrainGenerator';

export class SkyBridgeMode implements GameModeInfo {
  name = '/skybridge';
  allowPvP = true;
  allowMobSpawns = true;
  allowPlayerMobSpawns = true;

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (bakedBlocks.has(key)) return true;
    if (y === -60) return true; // Bedrock
    
    // Village boundaries (protected area)
    const isBlueVillageZ = z >= 61 && z <= 110;
    const isRedVillageZ = z >= -110 && z <= -61;
    const isVillageX = x >= -50 && x <= 50;
    if (isVillageX && (isBlueVillageZ || isRedVillageZ) && y >= 4) {
      return true;
    }
    return false;
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

    const result = this.computeProceduralBlock(fx, fy, fz, bakedBlocks);
    if (this.procCache.size > 200000) {
      this.procCache.clear();
    }
    this.procCache.set(hash, result);
    return result;
  }

  private computeProceduralBlock(x: number, y: number, z: number, bakedBlocks: Map<string, number>): number {
    const key = `${x},${y},${z}`;
    if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;
    
    const isBlueSide = z >= 0;
    const isRedSide = z < 0;
    const isVoid = !isBlueSide && !isRedSide;

    if (isVoid) return BLOCK.AIR;

    const groundY = getTerrainHeight(x, z, false);
    if (y >= groundY && y < groundY + 1) return 1; 
    
    if (y < groundY) {
      const dxBlue = Math.max(0, Math.abs(x) - 50);
      const dzBlue = Math.max(0, 0 - z, z - 110);
      const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

      const dxRed = Math.max(0, Math.abs(x) - 50);
      const dzRed = Math.max(0, -110 - z, z - 0);
      const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

      const distToProtected = Math.min(distBlue, distRed);
      const isAreaProtected = distToProtected === 0;
      
      const isVillageOrCastle = (x >= -50 && x <= 50) && ((z >= 61 && z <= 410) || (z <= -61 && z >= -410));
      const isProtected = isVillageOrCastle || isAreaProtected;

      const elevationNoise = noise2D(x * 0.001, z * 0.001);
      const isOcean = elevationNoise < -0.5;

      const hasCaves = !isProtected && !isOcean && noise2D(x * 0.01, z * 0.01) > 0.3;
      
      const cy = y + 60;
      const cTerrainHeight = groundY + 60;
      
      if (hasCaves && cy > 1 && cy < cTerrainHeight - 4) {
        let isCave = false;
        const tunnelRadius = 0.08 + noise3D(x * 0.005, cy * 0.005, z * 0.005) * 0.05;
        if (Math.abs(noise3D(x * 0.015, cy * 0.015, z * 0.015)) < tunnelRadius && 
            Math.abs(noise3D(x * 0.015 + 1000, cy * 0.015 + 1000, z * 0.015 + 1000)) < tunnelRadius) {
          isCave = true;
        }
        
        if (noise3D(x * 0.008, cy * 0.01, z * 0.008) > 0.3) {
          isCave = true;
        }

        if (isCave) {
          if (cy < 10) return BLOCK.LAVA;
          return BLOCK.AIR;
        }
      }
      return 1;
    }
    
    return BLOCK.AIR;
  }

  getRespawnPosition(playerId: string, playerState?: any): {x: number, y: number, z: number} {
    const rx = (Math.random() - 0.5) * 4;
    const rz = (Math.random() - 0.5) * 4;
    let sideZ = 1;
    if (playerState && playerState.team) {
      sideZ = playerState.team === 'red' ? -1 : 1;
    } else {
      sideZ = (playerState && playerState.position && playerState.position.z >= 0) ? 1 : -1;
    }
    const targetZ = sideZ * 80 + rz;
    const groundY = getTerrainHeight(rx, targetZ, false);
    return { x: rx, y: groundY + 3, z: targetZ };
  }
}
