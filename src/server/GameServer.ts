import { setupSocketHandlers } from "./SocketHandlers";
import { tick as runTick } from "./GameTick";
import { GameModeInfo } from "./modes/GameMode";
import { ChunkManager } from "./ChunkManager";
import { chatModerator } from "./ChatModerator";
import { parentPort } from "worker_threads";
import {
  getTerrainHeight,
  getTerrainMinHeight,
  isNature,
  noise2D,
  noise3D,
} from "../game/TerrainGenerator";

import { BLOCK, isSolidBlock, CHUNK_SIZE, WORLD_Y_OFFSET } from "./constants";
import { MobTypes } from "../game/Constants";
import { tickItemDespawn, tickMobDespawn } from "./Systems";
import itemsData from "../../data/items.json";
import npcsData from "../game/data/npcs.json";
import bakedBlocksData from "../../data/bakedBlocks.json";
import fs from "fs";
import path from "path";

const bakedBlocks = new Map<string, number>(Object.entries(bakedBlocksData));

import { spawnMobsTick } from "./MobSpawner";

import { IServerPlayer, ITickMob, IDroppedItemState, IMinionState } from "../types/shared";

export function createGameServer(io: any, db: any, mode: GameModeInfo) {
  const isHubMode = mode.name.startsWith("/hub");
  const namespacePrefix = mode.name;
  const worldName = namespacePrefix.replace("/", "");
  const isSkyCastlesMode = mode.name.startsWith("/skycastles");
  // Spatial Hash definitions (reused to prevent GC thrashing)
  const CELL_SIZE = 16;
  const PLAYER_CELL_SIZE = 25;
  const getCellKey = (cx: number, cz: number) =>
    (cx & 0x7fff) | ((cz & 0x7fff) << 15);
  const spatialHash = new Map<number, ITickMob[]>();
  const playerHash = new Map<number, IServerPlayer[]>();

  const ioNamespace = io.of(mode.name);

  const state = {
    dayTime: 0,
    gameState: "playing",
    winningTeam: null as string | null,
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
  const players: Record<string, IServerPlayer> = {};
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

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const key = getCellKey(pcx + dx, pcz + dz);
        const cellPlayers = playerHash.get(key);
        if (cellPlayers) {
          for (const p of cellPlayers) {
            if (p.id !== excludeSocketId) {
              const sock = ioNamespace.sockets.get(p.id);
              if (sock) sock.emit(eventName, data);
            }
          }
        }
      }
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

  const slowTick = () => {
    state.tick10sCount++;
    chunkManager.saveDirtyChunks();

    try {
      if (npcs.length > 0) {
        parentPort?.postMessage({
          type: 'save_npcs',
          world: worldName,
          data: JSON.stringify(npcs)
        });
      }
    } catch (e) {}

    ioNamespace.emit("timeUpdate", { dayTime: state.dayTime });

    if (state.tick10sCount % 3 === 0) {
      chunkManager.unloadIdleChunks(players, 6); // Every 30s
      tickItemDespawn(ctx);
    }

    if (mode.onSlowTick) {
      mode.onSlowTick(ctx);
    }

    tickMobDespawn(ctx);
  };

  const droppedItems: Record<string, IDroppedItemState> = {};
  const mobs: Record<string, ITickMob> = {};
  const minions: Record<string, IMinionState> = {};

  const mobPool: ITickMob[] = [];
  function getMobFromPool() {
    return mobPool.length > 0 ? mobPool.pop() : { velocity: {x: 0, y: 0, z: 0}, position: {x: 0, y: 0, z: 0} };
  }
  function releaseMobToPool(mob: ITickMob) {
    if (mobPool.length < 500) mobPool.push(mob);
  }
  const pendingPlayerUpdates = new Set<string>();
  const pendingHits: any[] = [];
  const pendingMobHits: any[] = [];
  const pendingRespawns: any[] = [];

  
  const dayCycleSpeed = 0.0008;

  // Indestructible blocks (baked builds, bedrock, castles, villages)
  function isIndestructible(x: number, y: number, z: number): boolean {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = Math.floor(y) - WORLD_Y_OFFSET;

    const absX = Math.abs(Math.floor(x));
    const absZ = Math.abs(Math.floor(z));
    
    // Protect the 4 map corners from block placement/destruction
    if (absX >= 29 && absX <= 34 && absZ >= 76 && absZ <= 81) {
      return true;
    }

    // Do not force load the chunk synchronously. Active regions are already loaded.
    let currentBlock = chunkManager.getBlockFromChunk(cx, cz, lx, ly, lz);

    // If a player placed this block, it must be breakable
    if (currentBlock !== undefined && currentBlock > 0) {
      return false;
    }

    // If the chunk is literally empty/ungenerated, we could fall back to the game mode's terrain generator
    if (currentBlock === undefined) {
      currentBlock = mode.getBlockAt(x, y, z, chunkManager, bakedBlocks);
    }

    return mode.isIndestructible(x, y, z, bakedBlocks, currentBlock || 0);
  }

  function getBlockAt(x: number, y: number, z: number) {
    return mode.getBlockAt(x, y, z, chunkManager, bakedBlocks);
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

    const mob = getMobFromPool();
    mob.id = id;
    mob.type = type;
    mob.level = mobLvl;
    mob.scale = scale;
    mob.position.x = x;
    mob.position.y = y;
    mob.position.z = z;
    mob.velocity.x = 0;
    mob.velocity.y = 0;
    mob.velocity.z = 0;
    mob.health = hp;
    mob.maxHealth = hp;
    mob.targetId = null;
    mob.isGrounded = false;
    mob.team = team;

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
    getCellKey, broadcastToNearby, spawnMob, isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath,
    releaseMobToPool
  };
  
  setupSocketHandlers(ctx);
  
  

  // Game Reset / End Game state
   // "playing" | "endgame"
  
  
  
  
  
  

  function resetRoom() {
    state.gameState = "playing";
    state.winningTeam = null;
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
    for (const key of Object.keys(mobs)) { releaseMobToPool(mobs[key]); delete mobs[key]; }
    mobBuffers.clear();
    for (const key in minions) delete minions[key];

    // Clear chunks
    chunkManager.resetWorld();

    if (mode.onResetRoom) {
      mode.onResetRoom(ctx);
    }

    ioNamespace.emit("entitiesReset", { mobs, droppedItems, gameStartTime: state.gameStartTime });

    // Re-initialize players
    const oldBlue: string[] = [];
    const oldRed: string[] = [];
    const unassigned: string[] = [];
    
    for (const [id, p] of Object.entries(players)) {
      if (p.team === "blue") oldBlue.push(id);
      else if (p.team === "red") oldRed.push(id);
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
      if (!p) continue;
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

  function handleMorvaneDeath() {
    if (state.gameState === "endgame") return;
    state.gameState = "endgame";
    state.resetCountdown = Date.now() + 15000;
    state.hasBeenReset = false;

    if (morvaneDead.red && morvaneDead.blue) {
      state.winningTeam = "draw";
      ioNamespace.emit("chatMessage", {
        sender: "System",
        message: `It's a draw! Both Morvanes died. You will be moved to a new game in 15 seconds.`,
      });
      return;
    }

    const deadTeam = morvaneDead.red ? "red" : "blue";
    const winningTeam = deadTeam === "blue" ? "Red" : "Blue";
    state.winningTeam = winningTeam.toLowerCase();

    // Global announcement
    ioNamespace.emit("chatMessage", {
      sender: "System",
      message: `Team ${winningTeam} wins! You will be moved to a new game in 15 seconds.`,
    });

    for (const p of Object.values(players)) {
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
  // Accumulator/Fixed Timestep Loop
  const TICK_RATE = 20; // 20 TPS -> 50ms per tick
  const FIXED_TIME_STEP = 1000 / TICK_RATE;
  let lastTimeMs = performance.now();
  let accumulatorMs = 0;
  
  const tickLoop = () => {
    if (state.isDestroyed) return;
    
    const now = performance.now();
    let frameTime = now - lastTimeMs;
    // Cap frame time to prevent "spiral of death" on severe lag
    if (frameTime > 250) {
      frameTime = 250;
    }
    lastTimeMs = now;
    
    accumulatorMs += frameTime;
    
    // Process as many fixed steps as we have accumulated
    while (accumulatorMs >= FIXED_TIME_STEP) {
      if (state.isDestroyed) break;
      
      try {
        tick(FIXED_TIME_STEP / 1000);
      } catch (err) {
        console.error(`Error in tick for ${mode.name}`, err);
      }
      
      accumulatorMs -= FIXED_TIME_STEP;
    }
  };
  
  // Start the loop and track interval so it stops correctly on destroy
  const tickInterval = setInterval(tickLoop, Math.floor(FIXED_TIME_STEP / 2));
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
  
  

  const doSpawnMobsTick = () => {
    spawnMobsTick(ctx, doSpawnMobsTick);
  };
  setTimeout(doSpawnMobsTick, state.spawnInterval);

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
