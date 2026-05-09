import { GameModeInfo } from './GameMode';
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from '../constants';
import { ChunkManager } from '../ChunkManager';
import { getTerrainHeight, getTerrainMinHeight, noise2D, noise3D } from '../../game/TerrainGenerator';
import { skycastlesBakedBlocks } from '../../game/SkycastlesBakedBlocks';
import { getCastleBlock } from '../../game/generation/SkyCastlesGenerator';

export class SkyCastlesMode implements GameModeInfo {
  name: string;
  allowPvP = true;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  constructor(name: string) {
    this.name = name;
  }

  onInit?(server: { 
    setBlock: (x: number, y: number, z: number, type: number) => void, 
    spawnMob: (type: string, x: number, y: number, z: number, level?: number, team?: string) => void 
  }): void {
    server.spawnMob("Morvane", 0.5, 104, 200.5, 200, "blue");
    server.spawnMob("Morvane", 0.5, 104, -200.5, 200, "red");
  }

  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>, currentBlock: number = 0): boolean {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    
    // Make baked blocks indestructible
    if (skycastlesBakedBlocks.has(key) && skycastlesBakedBlocks.get(key) !== 0) return true;
    
    // Make the chests at 5, 65, +-190 unbreakable
    if (x === 5 && y === 65 && Math.abs(z) === 189) return true;

    if (y === -60) return true; // Keep bedrock indestructible


    // Huge protective zone on the entire void space from y -60 to 25, limited to between z -70 and 70
    if (y >= -60 && y <= 25 && z >= -70 && z <= 70) {
      if (currentBlock !== 0) return true;
    }

    const absX = Math.abs(x);
    const absZ = Math.abs(z);

    // 2. The water pool under the ship unbreakable (removed)

    // 3. The stairs of the mountain castle unbreakable
    if (absX <= 6 && (absZ >= 65 && absZ <= 175)) {
      const groundY = getTerrainHeight(x, z, true);
      if (y <= groundY && currentBlock !== 0) return true;
    }

    // 4. The flanks in the middle void and the tunnels unbreakable
    // Flanks
    if (absZ <= 13 && absX <= 15) {
      const groundY = getTerrainHeight(x, z, true);
      if (y <= groundY && currentBlock !== 0) return true;
    }
    
    // Tunnels (Main tube and the vertical shafts at absZ=78)
    if (absX >= 22 && absX <= 42 && absZ <= 315) {
      if (y <= 24 || (Math.abs(absZ - 78) <= 5 && Math.abs(absX - 32) <= 5)) {
         // Protect natural terrain blocks so we don't accidentally let them mine the cave walls (1 = stone, 2 = grass, 3 = dirt, 164 = deepslate, 165 = tuff)
         if (currentBlock === 1 || currentBlock === 2 || currentBlock === 3 || currentBlock === 164 || currentBlock === 165) {
           return true;
         }
      }
    }

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
    if (y >= 65) {
      // Castle area (approximate, should match SkyCastlesGenerator)
      if (z > 0) {
        const castleBlock = getCastleBlock(x, y - 60, z, 200, BLOCK.BLUE_STONE, true);
        if (castleBlock !== BLOCK.AIR) return castleBlock;
      } else {
        const castleBlock = getCastleBlock(x, y - 60, z, -200, BLOCK.RED_STONE, true);
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

    if (x === 5 && y === 65 && z === 189) return BLOCK.CHEST;
    if (x === 5 && y === 65 && z === -189) return BLOCK.CHEST_REVERSED;

    const groundY = getTerrainHeight(x, z, true);
    if (y >= groundY && y < groundY + 1) return 1; 
    
    if (y < groundY) {
      const minH = getTerrainMinHeight(x, z, true);
      if (y < minH) return BLOCK.AIR;
      return 1;
    }
    
    return BLOCK.AIR;  
  }

  getRespawnPosition(playerId: string, playerState?: any, chunkManager?: ChunkManager, bakedBlocks?: Map<string, number>): {x: number, y: number, z: number, yaw?: number} {
    let sideZ = 1;
    let yaw = 0;
    if (playerState && playerState.team) {
      sideZ = playerState.team === 'red' ? -1 : 1;
    } else {
      sideZ = (playerState && playerState.position && playerState.position.z >= 0) ? 1 : -1;
    }
    yaw = sideZ === -1 ? Math.PI : 0; 
    return { x: 0, y: 66, z: sideZ * 195, yaw };
  }
}
