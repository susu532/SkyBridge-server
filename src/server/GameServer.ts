import { setupSocketHandlers } from "./SocketHandlers";
import { tick as runTick } from "./GameTick";
import { GameModeInfo } from "./modes/GameMode";
import { Server } from "socket.io";
import { ChunkManager } from "./ChunkManager";
import { chatModerator } from "./ChatModerator";
import {
  getTerrainHeight,
  getTerrainMinHeight,
  isNature,
  noise2D,
  noise3D,
} from "../game/TerrainGenerator";

import { BLOCK, isSolidBlock, CHUNK_SIZE, WORLD_Y_OFFSET } from "./constants";
import itemsData from "../../data/items.json";
import npcsData from "../game/data/npcs.json";
import bakedBlocksData from "../../data/bakedBlocks.json";
import fs from "fs";
import path from "path";

const bakedBlocks = new Map<string, number>(Object.entries(bakedBlocksData));

export function createGameServer(io: Server, db: any, mode: GameModeInfo) {
  const isHubMode = mode.name.startsWith("/hub");
  const namespacePrefix = mode.name;
  const worldName = namespacePrefix.replace("/", "");
  const isSkyCastlesMode = mode.name.startsWith("/skycastles") || mode.name.startsWith("/voidtrail");
  // Spatial Hash definitions (reused to prevent GC thrashing)
  const CELL_SIZE = 16;
  const PLAYER_CELL_SIZE = 25;
  const getCellKey = (cx: number, cz: number) =>
    (cx & 0x7fff) | ((cz & 0x7fff) << 15);
  const spatialHash = new Map<number, any[]>();
  const playerHash = new Map<number, any[]>();

  const ioNamespace = io.of(mode.name);

  const state = {
    dayTime: 0,
    gameState: "playing",
    gameStartTime: Date.now(),
    resetCountdown: null as number | null,
    emptyRoomSince: null as number | null,
    hasSetEndgameMessage: false,
    hasBeenReset: false,
    lastOvertimeDamageTick: 0,
    lastSkyCastlesSyncJSON: "",
    tick10sCount: 0,
    spawnInterval: 1000,
    spawnTimeout: null as NodeJS.Timeout | null,
    isDestroyed: false
  };


  const chunkManager = new ChunkManager(worldName, db);
  let npcs: any[] = [];
  const players: Record<string, any> = {};
  const morvaneDead: Record<string, boolean> = { red: false, blue: false };

  function broadcastToNearby(
    eventName: string,
    data: any,
    positionx: number,
    positionz: number,
    rangeSq: number,
    excludeSocketId: string | null = null,
  ) {
    const pcx = Math.floor(positionx / PLAYER_CELL_SIZE);
    const pcz = Math.floor(positionz / PLAYER_CELL_SIZE);
    const targetRoom = `grid_${getCellKey(pcx, pcz)}`;

    if (excludeSocketId) {
      ioNamespace.to(targetRoom).except(excludeSocketId).emit(eventName, data);
    } else {
      ioNamespace.to(targetRoom).emit(eventName, data);
    }
  }

  // Load NPCs (Chunk loading is now implicit inside ChunkManager.getChunkArray)
  try {
    const getNPCs = db.prepare(`SELECT data FROM world_npcs WHERE world = ?`);
    const npcRow = getNPCs.get(worldName) as any;

    let baseWorldName = worldName;
    if (worldName.includes("_")) {
      baseWorldName = worldName.split("_")[0];
    }

    if (npcRow) {
      npcs = JSON.parse(npcRow.data);
      console.log(`Loaded ${npcs.length} NPCs for ${worldName} from DB`);
    } else {
      npcs = (npcsData as any)[baseWorldName] || [];
    }
    if (npcs.length === 0) {
      npcs = (npcsData as any)[baseWorldName] || [];
    }
  } catch (err) {
    console.error("Error loading NPCs:", err);

    let baseWorldName = worldName;
    if (worldName.includes("_")) {
      baseWorldName = worldName.split("_")[0];
    }
    npcs = (npcsData as any)[baseWorldName] || [];
  }

  const intervals: NodeJS.Timeout[] = [];

  const insertNPCs = db.prepare(
    `INSERT OR REPLACE INTO world_npcs (world, data) VALUES (?, ?)`,
  );

  // Unified 10s Background Tasks (optimized for many game mode instances)
  
  const slowTick = () => {
    state.tick10sCount++;
    chunkManager.saveDirtyChunks();

    try {
      if (npcs.length > 0) insertNPCs.run(worldName, JSON.stringify(npcs));
    } catch (e) {}

    ioNamespace.emit("timeUpdate", { dayTime: state.dayTime });

    if (state.tick10sCount % 3 === 0) {
      chunkManager.unloadIdleChunks(players, 6); // Every 30s

      // Item Despawn Logic
      const now = Date.now();
      const expiryTime = 5 * 60 * 1000; // 5 minutes
      let despawned = 0;
      for (const id in droppedItems) {
        if (now - droppedItems[id].timestamp > expiryTime) {
          const pos = droppedItems[id].position;
          delete droppedItems[id];
          broadcastToNearby("itemDespawned", id, pos.x, pos.z, 22500, null);
          despawned++;
        }
        if (despawned > 50) break; // Limit despawns per tick
      }
    }

    // Mob Despawn Logic (every 10s)
    if (isSkyCastlesMode) {
      const positions = [
        { x: 0.5, y: 104, z: 200.5, team: "blue" },
        { x: 0.5, y: 104, z: -200.5, team: "red" },
      ];
      for (const target of positions) {
        let found = false;
        for (const id in mobs) {
          const m = mobs[id];
          if (m.type === "Morvane" && m.team === target.team) {
            found = true;
            let hasP = false;
            for (const _ in players) {
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
        for (const _ in players) {
          hasP = true;
          break;
        }
        if (!hasP) {
          morvaneDead[target.team] = false;
        }
        if (!found && !morvaneDead[target.team]) {
          spawnMob("Morvane", target.x, target.y, target.z, 200, target.team);
        }
      }
    }

    let hasPlayers = false;
    for (const _ in players) {
      hasPlayers = true;
      break;
    }

    const isDay = Math.sin(state.dayTime * Math.PI * 2) > 0;
    if (!hasPlayers) {
      for (const id in mobs) {
        if (mobs[id].type === "Morvane") continue;
        const mx = mobs[id].position.x;
        const mz = mobs[id].position.z;
        delete mobs[id];
        mobBuffers.delete(id);
        broadcastToNearby("mobDespawned", id, mx, mz, 22500, null);
      }
    } else {
      for (const id in mobs) {
        const mob = mobs[id];
        let minPlayerDistSq = Infinity;
        for (const pId in players) {
          const p = players[pId];
          const dx = p.position.x - mob.position.x;
          const dy = p.position.y - mob.position.y;
          const dz = p.position.z - mob.position.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < minPlayerDistSq) minPlayerDistSq = distSq;
        }
        const isHostile = [
          "Zombie",
          "Creeper",
          "Skeleton",
          "Slime",
          "Morvane",
        ].includes(mob.type);
        if (
          mob.type !== "Morvane" &&
          (Math.sqrt(minPlayerDistSq) > 120 || (isDay && isHostile))
        ) {
          const mx = mob.position.x;
          const mz = mob.position.z;
          delete mobs[id];
          mobBuffers.delete(id);
          broadcastToNearby("mobDespawned", id, mx, mz, 22500, null);
        }
      }
    }
  };

  const droppedItems: Record<string, any> = {};
  const mobs: Record<string, any> = {};
  const minions: Record<string, any> = {};
  const pendingPlayerUpdates = new Set<string>();
  const pendingHits: any[] = [];
  const pendingMobHits: any[] = [];
  const pendingRespawns: any[] = [];

  
  const dayCycleSpeed = 0.0008;

  // Indestructible blocks (baked builds, bedrock, castles, villages)
  function isIndestructible(x: number, y: number, z: number): boolean {
    const wx = Math.floor(x);
    const wy = Math.floor(y);
    const wz = Math.floor(z);
    const key = `${wx},${wy},${wz}`;
    const changes = chunkManager.getBlockChangesDict();
    
    // If a player placed this block, it must be breakable
    if (changes[key] !== undefined && changes[key] > 0) {
      return false;
    }

    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = y - WORLD_Y_OFFSET;

    // Force load the chunk if it isn't loaded so we get the accurate current block
    chunkManager.getChunkArray(cx, cz, true);
    let currentBlock = chunkManager.getBlockFromChunk(cx, cz, lx, ly, lz);

    // If the chunk is literally empty/ungenerated, we could fall back to the game mode's terrain generator
    if (currentBlock === undefined) {
      currentBlock = mode.getBlockAt(x, y, z, chunkManager, bakedBlocks);
    }

    return mode.isIndestructible(x, y, z, bakedBlocks, currentBlock || 0);
  }
  function DEPRECATED_isIndestructible(
    x: number,
    y: number,
    z: number,
  ): boolean {
    if (isHubMode) return true; // Entire hub is indestructible
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (bakedBlocks.has(key)) return true;

    // Bedrock is always indestructible
    if (y === -60) return true;

    // Ship/Castle footprints (only in SkyCastles mode)
    if (isSkyCastlesMode) {
      const isWithinX = x >= -45 && x <= 45;
      const shipCenter = 450;
      const isBlueShip = z >= shipCenter - 50 && z <= shipCenter + 100;
      const isRedShip = z >= -(shipCenter + 100) && z <= -(shipCenter - 50);
      if (isWithinX && (isBlueShip || isRedShip) && y >= 130) {
        return true;
      }
    }

    // Village boundaries (protected area)
    if (!isSkyCastlesMode) {
      const isBlueVillageZ = z >= 61 && z <= 110;
      const isRedVillageZ = z >= -110 && z <= -61;
      const isVillageX = x >= -50 && x <= 50;
      if (isVillageX && (isBlueVillageZ || isRedVillageZ) && y >= 4) {
        return true;
      }
    }

    return false;
  }

  function getBlockAt(x: number, y: number, z: number) {
    return mode.getBlockAt(x, y, z, chunkManager, bakedBlocks);
  }
  function DEPRECATED_getBlockAt(x: number, y: number, z: number) {
    if (isHubMode) {
      const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;

      // Portal to SkyBridge (Force at Y=3 floor level)
      if (z === 15 && Math.abs(x) <= 2) {
        if (Math.abs(x) === 2) {
          if (y >= 3 && y <= 7) return BLOCK.OBSIDIAN;
        } else {
          if (y === 7) return BLOCK.OBSIDIAN;
          if (y >= 3 && y <= 6) return BLOCK.LAVA;
        }
      }

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

      if (distSq <= 7225 && y >= -60 && y <= 0) {
        // Max radius 85, within world height bounds
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
    if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;

    // Match client-side void/island logic
    const isBlueSide = isSkyCastlesMode ? z >= 70 : z >= 0;
    const isRedSide = isSkyCastlesMode ? z <= -70 : z < 0;
    const isVoid = !isBlueSide && !isRedSide;
    const isBridge = isSkyCastlesMode ? isVoid && x >= -8 && x <= 8 : false;

    if (isBridge) {
      // Bridge is at world Y=0, fences at Y=1. Server just needs to support walking.
      if (y === 0 || (y === 1 && (x === -8 || x === 8))) return 1;
      return BLOCK.AIR;
    }

    if (isVoid) return BLOCK.AIR;

    if (isSkyCastlesMode) {
      if (Math.abs(z) >= 550 || Math.abs(x) > 95) return BLOCK.AIR;
    }

    const groundY = getTerrainHeight(x, z, isSkyCastlesMode);
    // A block at groundY occupies [groundY, groundY + 1)
    if (y >= groundY && y < groundY + 1) return 1;

    if (y < groundY) {
      if (isSkyCastlesMode) {
        const minH = getTerrainMinHeight(x, z, true);
        if (y < minH) return BLOCK.AIR;
      }
      // Check for caves
      const dxBlue = Math.max(0, Math.abs(x) - 50);
      const caveExclusionEnd = isSkyCastlesMode ? 130 : 110;
      const dzBlue = Math.max(
        0,
        (isSkyCastlesMode ? 70 : 0) - z,
        z - caveExclusionEnd,
      );
      const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

      const dxRed = Math.max(0, Math.abs(x) - 50);
      const dzRed = Math.max(
        0,
        -caveExclusionEnd - z,
        z - -(isSkyCastlesMode ? 70 : 0),
      );
      const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

      const distToProtected = Math.min(distBlue, distRed);
      const isAreaProtected = distToProtected === 0;

      const maxProtectedZ = isSkyCastlesMode ? 410 : 410;
      const villageStart = isSkyCastlesMode ? 70 : 61; // For Bridge mode, protect from village onwards
      const isVillageOrCastle =
        x >= -50 &&
        x <= 50 &&
        ((z >= villageStart && z <= maxProtectedZ) ||
          (z <= -villageStart && z >= -maxProtectedZ));
      const isBridgeArea = isSkyCastlesMode
        ? x >= -12 && x <= 12 && z > -70 && z < 70
        : false;
      const isProtected = isVillageOrCastle || isBridgeArea || isAreaProtected;

      const elevationNoise = noise2D(x * 0.001, z * 0.001);
      const isOcean = elevationNoise < -0.5;

      const hasCaves =
        !isSkyCastlesMode &&
        !isProtected &&
        !isOcean &&
        noise2D(x * 0.01, z * 0.01) > 0.3;

      const cy = y + 60;
      const cTerrainHeight = groundY + 60;

      if (hasCaves && cy > 1 && cy < cTerrainHeight - 4) {
        let isCave = false;
        const caveNoise1 = noise3D(x * 0.015, cy * 0.015, z * 0.015);
        const caveNoise2 = noise3D(
          x * 0.015 + 1000,
          cy * 0.015 + 1000,
          z * 0.015 + 1000,
        );
        const tunnelRadius =
          0.08 + noise3D(x * 0.005, cy * 0.005, z * 0.005) * 0.05;
        if (
          Math.abs(caveNoise1) < tunnelRadius &&
          Math.abs(caveNoise2) < tunnelRadius
        ) {
          isCave = true;
        }

        const cavernNoise = noise3D(x * 0.008, cy * 0.01, z * 0.008);
        if (cavernNoise > 0.3) {
          isCave = true;
        }

        if (isCave) {
          if (cy < 10) {
            return BLOCK.LAVA;
          }
          return BLOCK.AIR;
        }
      }
      return 1; // Below ground is solid
    }

    // Above ground - No ocean/lakes
    return BLOCK.AIR;
  }

  function spawnMob(
    type: string,
    x: number,
    y: number,
    z: number,
    level?: number,
    team?: string,
  ) {
    const id = "mob_" + Math.random().toString(36).substring(2, 9);

    const isHostile = [
      "Zombie",
      "Creeper",
      "Skeleton",
      "Slime",
      "Morvane",
    ].includes(type);

    let mobLvl = 1;
    let hp = 100;
    let scale = 1;

    if (type === "Morvane") {
      hp = 5000;
      scale = 5;
      mobLvl = 100;
    } else if (isHostile) {
      if (level !== undefined && level >= 1) {
        mobLvl = level;
      } else {
        mobLvl = 1;
        for (let i = 2; i <= 13; i++) {
          if (Math.random() < Math.pow(0.8, i - 1)) {
            mobLvl = i;
          } else {
            break;
          }
        }
      }
      hp = 100 + (mobLvl - 1) * 20;
      scale = 1 + (mobLvl - 1) * 0.1;
    }

    const mob = {
      id,
      type,
      level: mobLvl,
      scale,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      health: hp,
      maxHealth: hp,
      targetId: null,
      isGrounded: false,
      team,
    };
    mobs[id] = mob;
    // console.log(`Spawned Lv${mobLvl} ${type} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
    broadcastToNearby("mobSpawned", mob, x, z, 22500, null);
  }

  // Player Buffer Pool to prevent GC pauses
  const playerBuffers = new Map<string, Buffer>();
  const mobBuffers = new Map<string, Buffer>();
  const hostileMobTypes = ["Zombie", "Creeper", "Skeleton", "Slime", "Morvane"];
const ctx: import("./GameContext").GameContext = {
    ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode, db, mode,
    bakedBlocks, npcs, players, morvaneDead, droppedItems, mobs, minions,
    pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
    playerBuffers, mobBuffers, spatialHash, playerHash, state,
    CELL_SIZE, PLAYER_CELL_SIZE, dayCycleSpeed, hostileMobTypes,
    getCellKey, broadcastToNearby, spawnMob, isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath
  };
  
  setupSocketHandlers(ctx);
  
  

  // Game Reset / End Game state
   // "playing" | "endgame"
  
  
  
  
  
  

  function resetRoom() {
    state.gameState = "playing";
    state.resetCountdown = null;
    state.emptyRoomSince = null;
    state.hasSetEndgameMessage = false;
    state.dayTime = 0;
    ioNamespace.emit("timeUpdate", { dayTime: state.dayTime });
    state.gameStartTime = Date.now();
    morvaneDead.red = false;
    morvaneDead.blue = false;

    // Clear dictionaries without replacing object references
    for (const key in droppedItems) delete droppedItems[key];
    for (const key in mobs) delete mobs[key];
    mobBuffers.clear();
    for (const key in minions) delete minions[key];

    // Clear chunks
    chunkManager.resetWorld();

    if (isSkyCastlesMode) {
      spawnMob("Morvane", 0.5, 104, 200.5, 200, "blue");
      spawnMob("Morvane", 0.5, 104, -200.5, 200, "red");
    }

    ioNamespace.emit("entitiesReset", { mobs, droppedItems, gameStartTime: state.gameStartTime });

    // Re-initialize players
    const oldBlue: string[] = [];
    const oldRed: string[] = [];
    const unassigned: string[] = [];
    
    for (const id in players) {
      if (players[id].team === "blue") oldBlue.push(id);
      else if (players[id].team === "red") oldRed.push(id);
      else unassigned.push(id);
    }

    const shuffle = (arr: string[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };

    shuffle(oldBlue);
    shuffle(oldRed);
    shuffle(unassigned);

    const orderedPlayers = [...oldBlue, ...oldRed, ...unassigned];
    
    let bCount = 0;
    let rCount = 0;

    const respawns = [];
    for (const id of orderedPlayers) {
      const p = players[id];
      p.health = 100;
      p.maxHealth = 100;
      p.defense = 0;
      p.skills = {};
      p.heldItem = 0;
      p.offHandItem = 0;
      p.isDead = false;
      p.isSpectator = false;

      if (bCount <= rCount) {
        p.team = "blue";
        bCount++;
      } else {
        p.team = "red";
        rCount++;
      }

      const respawnData = mode.getRespawnPosition(
        id,
        p,
        chunkManager,
        bakedBlocks,
      );
      p.position = { x: respawnData.x, y: respawnData.y, z: respawnData.z };
      if (respawnData.yaw !== undefined) {
        p.rotation = { x: 0, y: respawnData.yaw, z: 0 };
      }

      respawns.push({
        id,
        position: p.position,
        team: p.team,
        yaw: respawnData.yaw,
      });
    }

    for (const r of respawns) {
      // Notify all players of respawn
      ioNamespace.emit("playerRespawn", r);

      // Send fresh init data
      ioNamespace.to(r.id).emit("init", {
        players,
        blockChanges: chunkManager.getBlockChangesDict(),
        droppedItems,
        mobs,
        minions,
        dayTime: state.dayTime,
        npcs,
      });
    }
  }

  function handleMorvaneDeath(deadTeam: string) {
    if (state.gameState === "endgame") return;
    state.gameState = "endgame";
    state.resetCountdown = Date.now() + 15000;
    state.hasBeenReset = false;

    const winningTeam = deadTeam === "blue" ? "Red" : "Blue";

    // Global announcement
    ioNamespace.emit("chatMessage", {
      sender: "System",
      message: `Team ${winningTeam} wins! You will be moved to a new game in 15 seconds.`,
    });

    for (const id in players) {
      const p = players[id];
      if (p.team === deadTeam) {
        if (!p.isDead && !p.isSpectator) {
          p.health = 0;
          p.isDead = false;
          p.isSpectator = true;
          ioNamespace.emit("playerDied", { id: p.id });
          ioNamespace.emit("playerStatus", {
            id: p.id,
            isDead: false,
            isSpectator: true,
            health: 0,
          });
          ioNamespace.to(p.id).emit("becomeSpectator");
          ioNamespace.emit("chatMessage", {
            sender: "System",
            message: `${p.name} died and became a spectator`,
          });
        } else if (p.isDead) {
          p.isDead = false;
          p.isSpectator = true;
          ioNamespace.emit("playerStatus", {
            id: p.id,
            isDead: false,
            isSpectator: true,
            health: 0,
          });
          ioNamespace.to(p.id).emit("becomeSpectator");
        }
      }
    }
  }

  

  const tick = (delta: number) => {
    runTick(ctx, delta);
  };
  // Internal ticking logic managed by Node event loop
  let lastTickTime = Date.now();
  const tickInterval = setInterval(() => {
    const now = Date.now();
    let delta = (now - lastTickTime) / 1000;
    if (delta > 0.1) delta = 0.1;
    lastTickTime = now;
    try {
      tick(delta);
    } catch (err) {
      console.error(`Error in tick for ${mode.name}`, err);
    }
  }, 50);
  intervals.push(tickInterval);

  const slowTickInterval = setInterval(() => {
    try {
      slowTick();
    } catch (err) {
      console.error(`Error in slowTick for ${mode.name}`, err);
    }
  }, 10000); // 10 seconds
  intervals.push(slowTickInterval);

  // Mob Spawning Loop
  
  

  const spawnMobsTick = () => {
    if (state.isDestroyed) return;
    const isDay = Math.sin(state.dayTime * Math.PI * 2) > 0;
    state.spawnInterval = isDay ? 1000 : 500; // Double spawn rate at night
    state.spawnTimeout = setTimeout(spawnMobsTick, state.spawnInterval);

    if (!mode.allowMobSpawns) return;
    const playerIds = Object.keys(players);
    if (playerIds.length === 0) return;

    const maxMobs = Math.min(600, playerIds.length * 12);
    const currentMobs = Object.keys(mobs).length;
    if (currentMobs < maxMobs) {
      // Spawn rapidly when many players join organically
      const batchSize = Math.max(
        1,
        Math.min(20, Math.ceil(playerIds.length / 2)),
      );

      const spawnMemBlocks: Record<string, number> = {};
      const fastSpawnGetBlock = (bx: number, by: number, bz: number) => {
        const cx = Math.floor(bx);
        const cy = Math.floor(by);
        const cz = Math.floor(bz);
        const key = `${cx},${cy},${cz}`;
        if (key in spawnMemBlocks) return spawnMemBlocks[key];
        const blk = getBlockAt(cx, cy, cz);
        spawnMemBlocks[key] = blk;
        return blk;
      };

      for (let batch = 0; batch < batchSize; batch++) {
        if (Object.keys(mobs).length >= maxMobs) break;
        const randomPlayerId =
          playerIds[Math.floor(Math.random() * playerIds.length)];
        const randomPlayer = players[randomPlayerId];
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        const x = randomPlayer.position.x + Math.cos(angle) * dist;
        const z = randomPlayer.position.z + Math.sin(angle) * dist;

        if (isNature(x, z, isSkyCastlesMode)) {
          let spawnY = -1;
          // Try to find a valid ground near the player's Y level
          // We search for multiple layers (surface and caves) and pick one
          let validSpawnYLevels: number[] = [];
          const startY = 150; // Search from near the top, covering Skycastles peaks
          const endY = -50; // Search down to near the bottom

          // Search in the vertical column
          for (let y = startY; y > endY; y--) {
            const blockBelow = fastSpawnGetBlock(x, y - 1, z);
            const blockAt = fastSpawnGetBlock(x, y, z);
            const blockAbove = fastSpawnGetBlock(x, y + 1, z);

            // Allow standing on solid blocks, except leaves and glass
            const validGround =
              isSolidBlock(blockBelow) &&
              blockBelow !== BLOCK.LEAVES &&
              blockBelow !== BLOCK.GLASS &&
              blockBelow !== BLOCK.BIRCH_LEAVES &&
              blockBelow !== BLOCK.SPRUCE_LEAVES &&
              blockBelow !== BLOCK.DARK_OAK_LEAVES &&
              blockBelow !== BLOCK.CHERRY_LEAVES;
            const validSpace =
              blockAt === BLOCK.AIR && blockAbove === BLOCK.AIR;

            if (validGround && validSpace) {
              // Valid ground found. Check if it's within a reasonable semi-vertical distance of the player
              // to keep them loaded or if it's just a valid spot in general
              if (Math.abs(y - randomPlayer.position.y) < 40) {
                validSpawnYLevels.push(y);
              }
              // Skip 2 blocks to find next potential platform faster
              y -= 2;
            }
          }

          if (validSpawnYLevels.length > 0) {
            spawnY =
              validSpawnYLevels[
                Math.floor(Math.random() * validSpawnYLevels.length)
              ];
          }

          if (spawnY !== -1) {
            const rand = Math.random();
            let type = "";
            let level = 1;

            if (isDay) {
              // Day: spawn mostly passive mobs, but also try hostile (client will only allow them in caves)
              if (rand > 0.8) type = "Cow";
              else if (rand > 0.6) type = "Cow";
              else if (rand > 0.4) type = "Sheep";
              else if (rand > 0.3) type = "Zombie";
              else if (rand > 0.2) type = "Skeleton";
              else if (rand > 0.1) type = "Creeper";
              else type = "Slime";
            } else {
              // Night: mostly hostile mobs
              if (rand > 0.95) type = "Cow";
              else if (rand > 0.9) type = "Cow";
              else if (rand > 0.85) type = "Sheep";
              else if (rand > 0.6) type = "Zombie";
              else if (rand > 0.4) type = "Skeleton";
              else if (rand > 0.2) type = "Creeper";
              else type = "Slime";
            }

            // For hostile mobs, we need to check light level securely off the client
            if (["Zombie", "Creeper", "Skeleton", "Slime"].includes(type)) {
              level = 1;

              // Server-side spawn lighting check
              let nearLightSource = false;
              const radius = 7;
              const px = Math.floor(x);
              const py = Math.floor(spawnY);
              const pz = Math.floor(z);

              for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                  for (let dz = -radius; dz <= radius; dz++) {
                    if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                      const b = fastSpawnGetBlock(px + dx, py + dy, pz + dz);
                      if (
                        b === BLOCK.GLOWSTONE ||
                        b === BLOCK.LAVA ||
                        b === BLOCK.TORCH ||
                        b === BLOCK.CANDLE ||
                        b === BLOCK.TORCH_WALL_X_POS ||
                        b === BLOCK.TORCH_WALL_X_NEG ||
                        b === BLOCK.TORCH_WALL_Z_POS ||
                        b === BLOCK.TORCH_WALL_Z_NEG
                      ) {
                        nearLightSource = true;
                        break;
                      }
                    }
                  }
                  if (nearLightSource) break;
                }
                if (nearLightSource) break;
              }

              let isExposed = true;
              if (!nearLightSource) {
                for (let y = py + 1; y < 150; y++) {
                  const block = fastSpawnGetBlock(px, y, pz);
                  if (
                    block !== BLOCK.AIR &&
                    block !== BLOCK.WATER &&
                    block !== BLOCK.GLASS
                  ) {
                    // Simple exposure test
                    isExposed = false;
                    break;
                  }
                }
              }

              if (!nearLightSource && (!isDay || !isExposed)) {
                for (let i = 2; i <= 13; i++) {
                  if (Math.random() < Math.pow(0.8, i - 1)) {
                    level = i;
                  } else {
                    break;
                  }
                }
                spawnMob(
                  type,
                  Math.floor(x) + 0.5,
                  spawnY,
                  Math.floor(z) + 0.5,
                  level,
                );
              }
            } else {
              spawnMob(
                type,
                Math.floor(x) + 0.5,
                spawnY,
                Math.floor(z) + 0.5,
                level,
              );
            }
          }
        }
      }
    }
  };
  setTimeout(spawnMobsTick, state.spawnInterval);

  // Call mode-specific initialization
  if (mode.onInit) {
    mode.onInit({
      setBlock: (x: number, y: number, z: number, type: number) => {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = Math.floor(y) - WORLD_Y_OFFSET;
        chunkManager.setBlockInChunk(cx, cz, lx, ly, lz, type);
        ioNamespace.emit("blockChanged", { x, y, z, type });
      },
      spawnMob: (
        type: string,
        x: number,
        y: number,
        z: number,
        level?: number,
        team?: string,
      ) => {
        spawnMob(type, x, y, z, level, team);
      },
    });
  }

  // (Despawn loops moved to unified 10s background task)

  // Mob Spawning ticks - wait, that's done with setTimeout.
  // Let's clear the timeouts via a boolean flag
  

  return {
    destroy: () => {
      state.isDestroyed = true;
      if (state.spawnTimeout) clearTimeout(state.spawnTimeout);
      intervals.forEach(clearInterval);
      ioNamespace.removeAllListeners();
      console.log(`Destroyed instance ${mode.name}`);
    },
    isDestroyed: () => state.isDestroyed,
    tick,
    slowTick,
  };
}
