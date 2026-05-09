import { GameModeInfo } from "./GameMode";
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from "../constants";
import { ChunkManager } from "../ChunkManager";
import { noise2D, noise3D, biomes } from "../../game/TerrainGenerator";

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
    if (y <= -60 || y >= 50) return true;
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

    // Catacombs boundaries
    if (Math.abs(x) > 200 || Math.abs(z) > 200) {
      if (y >= -5 && y <= 15) return BLOCK.OBSIDIAN;
    }

    // Outer bedrock/floor limits
    if (y < -5) return BLOCK.OBSIDIAN;
    if (y > 15) return BLOCK.STONE; // solid roof

    // Spawn Room (safe area)
    const distSq = x * x + z * z;
    if (distSq < 100) { // Radius 10
      // Spawn room floor: y=-1
      if (y === -1) {
        // pattern on the floor
        if ((Math.abs(x) + Math.abs(z)) % 2 === 0) return BLOCK.BRICK;
        return BLOCK.STONE;
      }
      if (y < -1) return BLOCK.STONE;
      if (y > 5) return BLOCK.CONCRETE_GRAY;
      
      // Walls of spawn room with an opening
      if (distSq > 64 && distSq < 100) {
        if (z < -3 && Math.abs(x) < 3) return BLOCK.AIR; // Opening looking North
        return BLOCK.STONE;
      }
      return BLOCK.AIR;
    }

    // Dungeon carving logic
    let isCarved = false;
    
    // 1. Cellular/Noise-based rooms
    const roomNoise = noise2D(x * 0.05, z * 0.05);
    if (roomNoise > 0.4) {
      isCarved = true;
    }

    // 2. Tunnels / corridors via ridged multi-fractal style noise
    const tunnelNoise1 = Math.abs(noise2D(x * 0.03, z * 0.03));
    const tunnelNoise2 = Math.abs(noise2D(x * 0.03 + 1000, z * 0.03 + 1000));
    if (tunnelNoise1 < 0.06 || tunnelNoise2 < 0.06) {
      isCarved = true;
    }
    
    // 3. 3D noise for vertical cave variations occasionally
    const caveNoise = noise3D(x * 0.04, y * 0.04, z * 0.04);
    if (caveNoise > 0.3) {
      isCarved = true;
    }

    if (isCarved) {
      // Hollow space
      if (y >= 0 && y <= 4) {
        // Lava pools natively occurring at y=0 occasionally
        if (y === 0 && caveNoise > 0.5) return BLOCK.LAVA;
        return BLOCK.AIR;
      }
      
      // Floor details
      if (y === -1) {
        // Floor blocks
        const detailNoise = noise2D(x * 0.2, z * 0.2);
        if (detailNoise > 0.4) return BLOCK.DIRT;
        if (detailNoise < -0.4) return BLOCK.CONCRETE_GRAY;
        return BLOCK.STONE;
      }
      if (y < -1) return BLOCK.STONE;

      // Ceiling details
      if (y === 5) {
        const glowNoise = noise2D(x * 0.1, z * 0.1);
        if (glowNoise > 0.8) return BLOCK.GLOWSTONE; // scary eerie lighting
        return BLOCK.OBSIDIAN;
      }
      if (y > 5) return BLOCK.STONE;

    }

    // Solid walls
    const wallNoise = noise3D(x * 0.1, y * 0.1, z * 0.1);
    if (wallNoise > 0.5) return BLOCK.OBSIDIAN;
    if (wallNoise < -0.5) return BLOCK.BRICK;
    return BLOCK.STONE;
  }

  getRespawnPosition(
    playerId: string,
    playerState?: any,
    chunkManager?: ChunkManager,
    bakedBlocks?: Map<string, number>,
  ): { x: number; y: number; z: number; yaw?: number } {
    const rx = (Math.random() - 0.5) * 12;
    const rz = (Math.random() - 0.5) * 12;
    return { x: rx, y: 1, z: rz };
  }
}
