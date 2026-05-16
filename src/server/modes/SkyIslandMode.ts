import { GameModeInfo } from "./GameMode";
import { GameContext } from "../GameContext";
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from "../constants";
import { ChunkManager } from "../ChunkManager";
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export class SkyIslandMode implements GameModeInfo {
  name: string;
  allowPvP = true;
  allowMobSpawns = true;
  allowPlayerMobSpawns = true;

  constructor(name: string = '/skyisland') {
    this.name = name;
  }

  isIndestructible(
    x: number,
    y: number,
    z: number,
    bakedBlocks: Map<string, number>,
    currentBlock: number = 0,
  ): boolean {
    if (y === -60) return true;
    return false;
  }

  getBlockAt(
    x: number,
    y: number,
    z: number,
    chunkManager: ChunkManager,
    bakedBlocks: Map<string, number>,
  ): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunkType = chunkManager.getBlockFromChunk(
      cx,
      cz,
      lx,
      Math.floor(y) - WORLD_Y_OFFSET,
      lz,
    );
    if (chunkType !== undefined) return chunkType;

    const distSq = x * x + z * z;
    const dist = Math.sqrt(distSq);

    // Island 1 from radius 0 to 40
    if (dist < 40) {
       const baseHeight = 65;
       const depth = Math.max(1, 15 - dist * 0.35 + noise2D(x * 0.1, z * 0.1) * 3);
       
       if (y === baseHeight) {
          return BLOCK.GRASS;
       } else if (y < baseHeight && y > baseHeight - depth) {
          return y > baseHeight - 3 ? BLOCK.DIRT : BLOCK.STONE;
       } else if (y === baseHeight + 1 && dist < 35 && noise2D(x * 12.3, z * 12.3) > 0.9) {
          return BLOCK.WOOD;
       } else if (y > baseHeight && y <= baseHeight + 2 && noise2D(x * 12.3, z * 12.3) > 0.95) {
          return BLOCK.TALL_GRASS;
       }
    }

    // Island 2
    const x2 = x - 50;
    const z2 = z;
    const distSq2 = x2 * x2 + z2 * z2;
    const dist2 = Math.sqrt(distSq2);

    if (dist2 < 40) {
       const baseHeight2 = 115;
       const depth2 = Math.max(1, 15 - dist2 * 0.35 + noise2D(x2 * 0.1, z2 * 0.1) * 3);
       
       if (y === baseHeight2) {
          return BLOCK.GRASS;
       } else if (y < baseHeight2 && y > baseHeight2 - depth2) {
          return y > baseHeight2 - 3 ? BLOCK.DIRT : BLOCK.STONE;
       } else if (y === baseHeight2 + 1 && dist2 < 35 && noise2D(x2 * 12.3, z2 * 12.3) > 0.9) {
          return BLOCK.WOOD;
       } else if (y > baseHeight2 && y <= baseHeight2 + 2 && noise2D(x2 * 12.3, z2 * 12.3) > 0.95) {
          return BLOCK.TALL_GRASS;
       }
    }

    return BLOCK.AIR;
  }

  getRespawnPosition(
    playerId: string,
    playerState?: any,
    chunkManager?: ChunkManager,
    bakedBlocks?: Map<string, number>,
  ): { x: number; y: number; z: number; yaw?: number } {
    return { x: 0, y: 70, z: 0, yaw: 0 };
  }
}
