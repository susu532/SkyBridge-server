import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';
import { getTerrainHeight, getTerrainMinHeight, noise2D, noise3D } from '../../game/TerrainGenerator';
import { skycastlesBakedBlocks } from '../../game/SkycastlesBakedBlocks';
import { getGiantMythicalShipBlock } from '../../game/generation/ShipGenerator';
import { getCastleBlock } from '../../game/generation/SkyCastlesGenerator';

export class SkyCastlesMode implements GameModeInfo {
  name: string;
  allowPvP = true;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  constructor(name: string) {
    this.name = name;
  }

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    
    // TEMPORARILY DISABLED to allow map building and baking:
    // if (skycastlesBakedBlocks.has(key) && skycastlesBakedBlocks.get(key) !== 0) return true;
    // if (bakedBlocks.has(key) && bakedBlocks.get(key) !== 0) return true;
    
    if (y === -60) return true; // Keep bedrock indestructible

    /* TEMPORARILY DISABLED ship protection for map building
    const isWithinX = x >= -45 && x <= 45;
    const shipCenter = 450;
    const isBlueShip = z >= (shipCenter - 50) && z <= (shipCenter + 100);
    const isRedShip = z >= -(shipCenter + 100) && z <= -(shipCenter - 50);
    if (isWithinX && (isBlueShip || isRedShip) && y >= 130) {
      return true;
    }
    */

    return false;
  }

  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
    if (chunkType !== undefined) return chunkType;

    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;
    if (skycastlesBakedBlocks.has(key)) return skycastlesBakedBlocks.get(key)!;
    
    // Check generators
    if (y >= 130) {
      if (z >= 200 && z <= 550 && x >= -45 && x <= 45) {
        const shipBlock = getGiantMythicalShipBlock(x, y, z, true);
        if (shipBlock !== BLOCK.AIR) return shipBlock;
      }
      if (z <= -200 && z >= -550 && x >= -45 && x <= 45) {
        const shipBlock = getGiantMythicalShipBlock(x, y, z, false);
        if (shipBlock !== BLOCK.AIR) return shipBlock;
      }
      
      // Castle area (approximate, should match SkyCastlesGenerator)
      if (z > 0) {
        const castleBlock = getCastleBlock(x, y - 120, z, 200, BLOCK.BLUE_STONE, true);
        if (castleBlock !== BLOCK.AIR) return castleBlock;
      } else {
        const castleBlock = getCastleBlock(x, y - 120, z, -200, BLOCK.RED_STONE, true);
        if (castleBlock !== BLOCK.AIR) return castleBlock;
      }
    }

    const isBlueSide = z >= 70;
    const isRedSide = z <= -70;
    const isVoid = !isBlueSide && !isRedSide;
    const isBridge = isVoid && x >= -8 && x <= 8;

    if (isBridge) {
      if (y === 0 || (y === 1 && (x === -8 || x === 8))) return 1;
      return BLOCK.AIR;
    }

    if (isVoid) return BLOCK.AIR;
    if (Math.abs(z) >= 550 || Math.abs(x) > 95) return BLOCK.AIR;

    const groundY = getTerrainHeight(x, z, true);
    if (y >= groundY && y < groundY + 1) return 1; 
    
    if (y < groundY) {
      const minH = getTerrainMinHeight(x, z, true);
      if (y < minH) return BLOCK.AIR;
      return 1;
    }
    
    return BLOCK.AIR;  
  }

  getRespawnPosition(playerId: string, playerState?: any, chunkManager?: ChunkManager, bakedBlocks?: Map<string, number>): {x: number, y: number, z: number} {
    const rx = (Math.random() - 0.5) * 2;
    const rz = (Math.random() - 0.5) * 2;
    let sideZ = 1;
    if (playerState && playerState.team) {
      sideZ = playerState.team === 'red' ? -1 : 1;
    } else {
      sideZ = (playerState && playerState.position && playerState.position.z >= 0) ? 1 : -1;
    }
    return { x: 1 + rx, y: 114, z: sideZ * 427 + rz };
  }
}
