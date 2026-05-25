import { GameModeInfo } from "./GameMode";
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from "../constants";
import { ChunkManager } from "../ChunkManager";
import { noise2D, noise3D, biomes } from "../../game/TerrainGenerator";
import dungeonBakedBlocksData from "../../../data/dungeonBakedBlocks.json";

const dungeonBakedBlocks = new Map<string, number>(Object.entries(dungeonBakedBlocksData));

export class DungeonDelverMode implements GameModeInfo {
  name = "/dungeondelver";
  allowPvP = true;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  isIndestructible(
    x: number,
    y: number,
    z: number,
    bakedBlocks: Map<string, number>,
  ): boolean {
    if (Math.floor(x) === 0 && Math.floor(y) === 0 && Math.floor(z) === 0) return true;
    const blockKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (dungeonBakedBlocks.has(blockKey) && dungeonBakedBlocks.get(blockKey) !== 0) return true;

    if (y <= -2 || y >= 7) return true;
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

    const blockKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (dungeonBakedBlocks.has(blockKey)) return dungeonBakedBlocks.get(blockKey)!;

    // Remove block generation outside playable bounds for performance
    if (y < -2 || y > 7) return BLOCK.AIR;

    // Catacombs boundaries
    if (Math.abs(x) > 50 || Math.abs(z) > 50) {
      if (Math.abs(x) > 55 || Math.abs(z) > 55) return BLOCK.AIR; // Prevent infinite continent of obsidian
      if (y >= -2 && y <= 7) return BLOCK.OBSIDIAN;
    }

    // Outer bedrock/floor limits
    if (y < -2) return BLOCK.OBSIDIAN; // This line won't be reached because of the if above, but leaving it or changing it is fine.


    // Spawn Room (safe area)
    const distSq = x * x + z * z;
    if (distSq < 100) { // Radius 10
      // Put a solid chest at 0, 0, 0
      if (Math.floor(x) === 0 && Math.floor(y) === 0 && Math.floor(z) === 0) {
        return BLOCK.CHEST;
      }
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
        return BLOCK.AIR;
      }
      
      // Floor details
      if (y === -1) {
        // Lava pools natively occurring at y=-1 occasionally
        if (caveNoise > 0.5) return BLOCK.LAVA;

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

  onMobDeath(ctx: any, mob: any, attackerId?: string) {
    if (attackerId && ctx.players[attackerId]) {
      const attacker = ctx.players[attackerId];
      attacker.kills = (attacker.kills || 0) + 1;
      ctx.ioNamespace.emit("playerStatsUpdate", { 
        id: attackerId, 
        kills: attacker.kills, 
        deaths: attacker.deaths 
      });
      ctx.pendingPlayerUpdates.add(attackerId);
    }
  }

  getRespawnPosition(
    playerId: string,
    playerState?: any,
    chunkManager?: ChunkManager,
    bakedBlocks?: Map<string, number>,
  ): { x: number; y: number; z: number; yaw?: number } {
    if (chunkManager && bakedBlocks) {
      for (let i = 0; i < 50; i++) {
        const rx = Math.floor((Math.random() - 0.5) * 100);
        const rz = Math.floor((Math.random() - 0.5) * 100);

        const id0 = this.getBlockAt(rx, 0, rz, chunkManager, bakedBlocks);
        const id1 = this.getBlockAt(rx, 1, rz, chunkManager, bakedBlocks);
        const idFloor = this.getBlockAt(rx, -1, rz, chunkManager, bakedBlocks);

        if (id0 === BLOCK.AIR && id1 === BLOCK.AIR && idFloor !== BLOCK.AIR && idFloor !== BLOCK.LAVA) {
          return { x: rx + 0.5, y: 1, z: rz + 0.5 };
        }
      }
    }

    const rx = (Math.random() - 0.5) * 12;
    const rz = (Math.random() - 0.5) * 12;
    return { x: rx, y: 1, z: rz };
  }
}
