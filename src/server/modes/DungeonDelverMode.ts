import { GameModeInfo } from "./GameMode";
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from "../constants";
import { ChunkManager } from "../ChunkManager";
import {
  getTerrainHeight,
  getTerrainMinHeight,
  noise2D,
  noise3D,
} from "../../game/TerrainGenerator";

export class DungeonDelverMode implements GameModeInfo {
  name = "/dungeondelver";
  allowPvP = true;
  allowMobSpawns = true;
  allowPlayerMobSpawns = true;

  isIndestructible(
    x: number,
    y: number,
    z: number,
    bakedBlocks: Map<string, number>,
  ): boolean {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    // if (bakedBlocks.has(key) && bakedBlocks.get(key) !== 0) return true;
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

    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    // if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;

    // For now simplistic terrain like bridge
    const isBridge = z >= -10 && z <= 10 && x >= -10 && x <= 10;
    if (isBridge && y === 0) return 1;

    return BLOCK.AIR;
  }

  getRespawnPosition(
    playerId: string,
    playerState?: any,
    chunkManager?: ChunkManager,
    bakedBlocks?: Map<string, number>,
  ): { x: number; y: number; z: number } {
    return { x: 0, y: 10, z: 0 };
  }
}
