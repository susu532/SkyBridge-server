import { GameModeInfo } from "./GameMode";
import { GameContext } from "../GameContext";
import { BLOCK, CHUNK_SIZE, WORLD_Y_OFFSET } from "../constants";
import { ChunkManager } from "../ChunkManager";
import {
  getTerrainHeight,
  getTerrainMinHeight,
  noise2D,
  noise3D,
} from "../../game/TerrainGenerator";
import { skycastlesBakedBlocks } from "../../game/SkycastlesBakedBlocks";
import { getCastleBlock } from "../../game/generation/SkyCastlesGenerator";

export class SkyCastlesMode implements GameModeInfo {
  name: string;
  allowPvP = true;
  allowMobSpawns = false;
  allowPlayerMobSpawns = false;

  constructor(name: string) {
    this.name = name;
  }

  onInit?(server: {
    setBlock: (x: number, y: number, z: number, type: number) => void;
    spawnMob: (
      type: string,
      x: number,
      y: number,
      z: number,
      level?: number,
      team?: string,
    ) => void;
  }): void {
    server.spawnMob("Morvane", 0.5, 104, 200.5, 200, "blue");
    server.spawnMob("Morvane", 0.5, 104, -200.5, 200, "red");
  }

  onSlowTick?(ctx: GameContext): void {
    const positions = [
      { x: 0.5, y: 104, z: 200.5, team: "blue" },
      { x: 0.5, y: 104, z: -200.5, team: "red" },
    ];
    for (const target of positions) {
      let found = false;
      for (const id in ctx.mobs) {
        const m = ctx.mobs[id];
        if (m.type === "Morvane" && m.team === target.team) {
          found = true;
          let hasP = false;
          for (const _ in ctx.players) {
            hasP = true;
            break;
          }
          if (!hasP) {
            m.health = 5000;
            m.lastHealth = 5000;
            m.position.x = target.x;
            m.position.y = target.y;
            m.position.z = target.z;
            m.velocity.x = 0;
            m.velocity.y = 0;
            m.velocity.z = 0;
          }
          break;
        }
      }
      let hasP = false;
      for (const _ in ctx.players) {
        hasP = true;
        break;
      }
      if (!hasP) {
        ctx.morvaneDead[target.team] = false;
      }
      if (!found && !ctx.morvaneDead[target.team]) {
        ctx.spawnMob("Morvane", target.x, target.y, target.z, 200, target.team);
      }
    }
  }

  onTick?(ctx: GameContext, delta: number, now: number): void {
    // 20 Minute Overtime rules for Sky Castles
    if (now - ctx.state.gameStartTime >= 20 * 60 * 1000) {
      if (now - ctx.state.lastOvertimeDamageTick >= 1000) {
        ctx.state.lastOvertimeDamageTick = now;
        
        // Morvane takes 100 damage/sec
        for (const mId in ctx.mobs) {
          const mob = ctx.mobs[mId];
          if (mob.type === "Morvane") {
            mob.health -= 100;
            if (mob.health <= 0) {
              if (mob.team) {
                ctx.morvaneDead[mob.team] = true;
              }
              ctx.ioNamespace.emit("mobDespawned", mId);
              delete ctx.mobs[mId];
              ctx.mobBuffers.delete(mId);
            } else {
              ctx.pendingMobHits.push({
                id: mId,
                damage: 100,
                knockbackDir: { x: 0, y: 0, z: 0 },
                isCrit: true,
                attackerId: "system",
                position: { x: mob.position.x, z: mob.position.z },
              });
            }
          }
        }
      }
    }

    let hasPlayersForReset = false;
    for (const _ in ctx.players) {
      hasPlayersForReset = true;
      break;
    }

    if (hasPlayersForReset) {
      let blueHp = 0,
        blueMax = 5000,
        redHp = 0,
        redMax = 5000;
        
      let redPlayersCount = 0;
      let bluePlayersCount = 0;
      for (const id in ctx.players) {
        if (ctx.players[id].team === "red") redPlayersCount++;
        if (ctx.players[id].team === "blue") bluePlayersCount++;
      }

      for (const mId in ctx.mobs) {
        const m = ctx.mobs[mId];
        if (m.type === "Morvane") {
          if (m.team === "blue") {
            blueHp = m.health;
            blueMax = m.maxHealth || 5000;
          }
          if (m.team === "red") {
            redHp = m.health;
            redMax = m.maxHealth || 5000;
          }
        }
      }

      const timeRemainingSeconds = Math.ceil(Math.max(0, 20 * 60 * 1000 - (now - ctx.state.gameStartTime)) / 1000);

      const timeToRestart = ctx.state.resetCountdown
        ? Math.max(0, Math.floor((ctx.state.resetCountdown - now) / 1000))
        : 0;
      const syncData = {
        redHp,
        redMax,
        blueHp,
        blueMax,
        gameState: ctx.state.gameState,
        winningTeam: ctx.state.winningTeam,
        timeToRestart,
        timeRemaining: timeRemainingSeconds,
        redPlayers: redPlayersCount,
        bluePlayers: bluePlayersCount
      };
      const syncStr = JSON.stringify(syncData);
      if (syncStr !== ctx.state.lastSkyCastlesSyncJSON) {
        ctx.state.lastSkyCastlesSyncJSON = syncStr;
        ctx.ioNamespace.emit("skyCastlesSync", syncData);
      }
    }

    if (ctx.state.gameState === "playing" && (ctx.morvaneDead.red || ctx.morvaneDead.blue)) {
      ctx.handleMorvaneDeath();
    }
  }

  onResetRoom?(ctx: GameContext): void {
    ctx.spawnMob("Morvane", 0.5, 104, 200.5, 200, "blue");
    ctx.spawnMob("Morvane", 0.5, 104, -200.5, 200, "red");
  }

  isIndestructible(
    x: number,
    y: number,
    z: number,
    bakedBlocks: Map<string, number>,
    currentBlock: number = 0,
  ): boolean {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;

    // Make baked blocks indestructible
    if (skycastlesBakedBlocks.has(key) && skycastlesBakedBlocks.get(key) !== 0)
      return true;

    // Make the chests at 5, 65, +-190 unbreakable
    if (x === 5 && y === 65 && Math.abs(z) === 189) return true;

    // Mid void chests and platforms
    if ((y === 16 || y === 15) && x === 0 && (z === 10 || z === -9))
      return true;

    // Small ships unbreakable
    if (Math.abs(x) <= 3 && y >= 8 && y <= 18) {
      if (Math.abs(Math.abs(z) - 310) <= 6) return true;
    }

    if (y === -60) return true; // Keep bedrock indestructible

    const absX = Math.abs(x);
    const absZ = Math.abs(z);

    // 2. The water pool under the ship unbreakable (removed)

    // 3. The stairs of the mountain castle unbreakable
    if (absX <= 6 && absZ >= 65 && absZ <= 175) {
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
        if (
          currentBlock === 1 ||
          currentBlock === 2 ||
          currentBlock === 3 ||
          currentBlock === 164 ||
          currentBlock === 165
        ) {
          return true;
        }
      }
    }

    return false;
  }

  getBlockAt(
    x: number,
    y: number,
    z: number,
    chunkManager: ChunkManager,
    bakedBlocks: Map<string, number>,
  ): number {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;

    // Explicit Chests near tree
    if (y === 5 && (x === 75 || x === -75) && z === 1) return BLOCK.CHEST;

    // Mid void chests
    if (y === 16 && x === 0 && z === 10) return BLOCK.CHEST;
    if (y === 16 && x === 0 && z === -9) return BLOCK.CHEST_REVERSED;
    if (y === 15 && x === 0 && (z === 10 || z === -9)) return BLOCK.PLANKS;

    // Small ships
    const centerZ = z >= 0 ? 310 : -310;
    const isShip = Math.abs(z - centerZ) <= 8 && Math.abs(x) <= 3;
    if (isShip) {
      const shipGroundY = 8;
      const dz = (z - centerZ) * (z >= 0 ? -1 : 1); // Flipped dz for opposite rotation (facing center)
      const ax = Math.abs(x);

      // Floor
      if (y === shipGroundY) {
        if (ax === 0 && dz >= -5 && dz <= 5) return BLOCK.DARK_OAK_PLANKS;
        if (ax === 1 && dz >= -4 && dz <= 4) return BLOCK.DARK_OAK_PLANKS;
        if (ax === 2 && dz >= -2 && dz <= 2) return BLOCK.DARK_OAK_PLANKS;
      }

      // Walls
      if (y === shipGroundY + 1) {
        if (x === 0 && dz >= 6 && dz <= 8) return BLOCK.SPRUCE_LOG; // Bowsprit
        if (ax === 2 && dz >= -2 && dz <= 2) return BLOCK.WOOD;
        if (ax === 1 && (dz === 3 || dz === 4 || dz === 5)) return BLOCK.WOOD;
        if (ax === 2 && dz === 3) return BLOCK.WOOD;
        if (ax === 1 && (dz === -3 || dz === -4)) return BLOCK.WOOD;
        if (ax === 0 && dz === -5) return BLOCK.WOOD;

        // Stern deck
        if (ax <= 1 && dz <= -3 && dz >= -5) return BLOCK.DARK_OAK_PLANKS;

        // Chest - moved to dz = -1 (near mast at dz=0)
        if (x === 0 && dz === -1)
          return z >= 0 ? BLOCK.CHEST_REVERSED : BLOCK.CHEST;
      }

      // Stern raised part
      if (y === shipGroundY + 2) {
        if (ax <= 1 && dz <= -3 && dz >= -5) {
          if (ax === 1 || dz === -5) return BLOCK.PLANKS;
        }
      }

      // Mast
      if (x === 0 && dz === 0) {
        if (y >= shipGroundY + 1 && y <= shipGroundY + 8)
          return BLOCK.SPRUCE_LOG;
        if (y === shipGroundY + 9) return BLOCK.PLANKS; // Crow's nest
      }

      // Sail
      if (dz === 1 && ax <= 2) {
        if (y >= shipGroundY + 3 && y <= shipGroundY + 7) {
          const sailWidth =
            y === shipGroundY + 3 || y === shipGroundY + 7 ? 1 : 2;
          if (ax <= sailWidth) return BLOCK.WOOL_WHITE;
        }
      }

      if (y >= shipGroundY && y <= shipGroundY + 10) return BLOCK.AIR;
    }

    if (x === 5 && y === 65 && z === 189) return BLOCK.CHEST;
    if (x === 5 && y === 65 && z === -189) return BLOCK.CHEST_REVERSED;

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

    if (skycastlesBakedBlocks.has(key)) return skycastlesBakedBlocks.get(key)!;

    // Check generators
    if (y >= 65) {
      // Castle area (approximate, should match SkyCastlesGenerator)
      if (z > 0) {
        const castleBlock = getCastleBlock(
          x,
          y - 60,
          z,
          200,
          BLOCK.BLUE_STONE,
          true,
        );
        if (castleBlock !== BLOCK.AIR) return castleBlock;
      } else {
        const castleBlock = getCastleBlock(
          x,
          y - 60,
          z,
          -200,
          BLOCK.RED_STONE,
          true,
        );
        if (castleBlock !== BLOCK.AIR) return castleBlock;
      }
    }

    const isBlueSide = z >= 70;
    const isRedSide = z <= -70;
    const isVoid = !isBlueSide && !isRedSide;

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

  getRespawnPosition(
    playerId: string,
    playerState?: any,
    chunkManager?: ChunkManager,
    bakedBlocks?: Map<string, number>,
  ): { x: number; y: number; z: number; yaw?: number } {
    let sideZ = 1;
    let yaw = 0;
    if (playerState && playerState.team) {
      sideZ = playerState.team === "red" ? -1 : 1;
    } else {
      sideZ =
        playerState && playerState.position && playerState.position.z >= 0
          ? 1
          : -1;
    }
    yaw = sideZ === -1 ? Math.PI : 0;
    return { x: 0, y: 66, z: sideZ * 195, yaw };
  }
}
