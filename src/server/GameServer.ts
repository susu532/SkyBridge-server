import { setupSocketHandlers } from "./SocketHandlers";
import { tick as runTick } from "./GameTick";
import { GameModeInfo } from "./modes/GameMode";
import { ChunkManager } from "./ChunkManager";
import { chatModerator } from "./ChatModerator";
import { parentPort } from "worker_threads";
import { encodePacket } from "./WSHelpers";
import {
  getTerrainHeight,
  getTerrainMinHeight,
  isNature,
  noise2D,
  noise3D,
} from "../game/TerrainGenerator";

import { BLOCK, isSolidBlock, CHUNK_SIZE, WORLD_Y_OFFSET } from "./constants";
import { MobTypes, calculateMobMaxHealth } from "../game/Constants";
import { tickItemDespawn, tickMobDespawn } from "./Systems";
import itemsData from "../../data/items.json";
import npcsData from "../game/data/npcs.json";
import bakedBlocksData from "../../data/bakedBlocks.json";
import fs from "fs";
import path from "path";

const bakedBlocks = new Map<string, number>(Object.entries(bakedBlocksData));

import { spawnMobsTick } from "./MobSpawner";

import { IServerPlayer, ITickMob, IDroppedItemState, IMinionState } from "../types/shared";
import { getRandomCutePlayerName } from "../game/CuteNames";
import type { Worker } from "worker_threads";

export function createGameServer(io: any, db: any, mode: GameModeInfo, genWorker?: Worker) {
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

    let packet: any = null;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const key = getCellKey(pcx + dx, pcz + dz);
        const cellPlayers = playerHash.get(key);
        if (cellPlayers) {
          for (const p of cellPlayers) {
            if (p.id !== excludeSocketId) {
              const sock = ioNamespace.sockets.get(p.id);
              if (sock) {
                if (sock.ws && typeof sock.ws.send === 'function') {
                  if (!packet) packet = encodePacket(eventName, [data]);
                  sock.ws.send(packet);
                } else {
                  sock.emit(eventName, data);
                }
              }
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

  const BOT_NAMES = [
    "AdvenBot", "BotSir", "SirBot", "RoboDelver", "DungeonMech",
    "MechaKnight", "Bot_73", "AutoLooter", "IronClad", "Botus",
    "CyberDelver", "MechWarrior", "BotO_Mato", "DroidDelver",
    "Automaton", "GearHead", "Botbert", "RoboPaladin", "Botimus",
    "MechMage", "Sir_Clanks", "Bot_101", "Droid_X", "RoboRogue",
    "Bot_Ninja", "Gear_Bot", "Auto_Bot", "Bot_Rex", "Robo_King",
    "Bot_Queen", "Droid_Lord", "Mech_God"
  ];

  const isLavaColumnAt = (x: number, y: number, z: number): boolean => {
    const bx = Math.floor(x);
    const by = Math.floor(y - 0.1);
    const bz = Math.floor(z);
    const blk = getBlockAt(bx, by, bz);
    if (blk === BLOCK.LAVA) return true;
    const checkDepthY = Math.max(-20, by - 40);
    for (let checkY = by; checkY >= checkDepthY; checkY--) {
      const tempBlk = getBlockAt(bx, checkY, bz);
      if (tempBlk === BLOCK.LAVA) return true;
      if (isSolidBlock(tempBlk)) break;
    }
    return false;
  };

  const intervals: NodeJS.Timeout[] = [];

  const slowTick = () => {
    state.tick10sCount++;
    chunkManager.saveDirtyChunks();

    let hasHumanPlayers = false;
    for (const id in players) {
      if (!players[id].isBot) {
        hasHumanPlayers = true;
        break;
      }
    }

    if (!hasHumanPlayers) {
      return;
    }

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

    if ((worldName.startsWith("dungeondelver") || worldName.startsWith("skycastles")) && worldName.endsWith("_1")) {
      const currentPlayers = Object.keys(players).length;
      if (currentPlayers < 30) {
        const hasTeams = mode.name.startsWith("/skycastles") || mode.name.startsWith("/skybridge");
        for (let i = 0; i < 30 - currentPlayers; i++) {
          const id = "bot_" + Math.random().toString(36).substring(2, 9);
          const team = hasTeams ? (Math.random() < 0.5 ? "blue" : "red") : undefined;
          
          let respawnData = mode.getRespawnPosition(id, { team }, chunkManager, bakedBlocks);
          let retry = 0;
          while (isLavaColumnAt(respawnData.x, respawnData.y, respawnData.z) && retry < 50) {
            respawnData = mode.getRespawnPosition(id, { team }, chunkManager, bakedBlocks);
            retry++;
          }
          const initialPos = {
            x: respawnData.x,
            y: respawnData.y,
            z: respawnData.z,
          };

          players[id] = {
            id,
            isBot: true,
            position: initialPos,
            velocity: { x: 0, y: 0, z: 0 },
            rotation: respawnData.yaw !== undefined ? { x: 0, y: respawnData.yaw, z: 0 } : { x: 0, y: 0, z: 0 },
            skinSeed: id,
            name: BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)] + Math.floor(Math.random()*10),
            health: 100,
            maxHealth: 100,
            defense: 0,
            team: team,
            isDead: false,
            heldItem: 441, // WOODEN_SWORD
            offHandItem: 0,
            joinTime: Date.now(),
            lastRespawnTime: Date.now()
          };
          ioNamespace.emit("playerJoined", players[id]);
        }
      }
    }

    tickMobDespawn(ctx);
  };

  const droppedItems: Record<string, IDroppedItemState> = {};
  const mobs: Record<string, ITickMob> = {};
  const minions: Record<string, IMinionState> = {};

  const mobPool: ITickMob[] = [];
  function getMobFromPool(): ITickMob {
    return (mobPool.length > 0 ? mobPool.pop() : { velocity: {x: 0, y: 0, z: 0}, position: {x: 0, y: 0, z: 0} }) as ITickMob;
  }
  function releaseMobToPool(mob: ITickMob) {
    if (mobPool.length < 500) mobPool.push(mob);
  }
  const pendingPlayerUpdates = new Set<string>();
  const pendingBlockUpdates: any[] = [];
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
      if (genWorker && !chunkManager.chunks.has(`${cx},${cz}`)) {
         genWorker.postMessage({ type: 'generate', cx, cz, worldName, modeName: mode.name });
         // Mark as generating so we don't spam requests. The 65535 array isn't placed yet.
         // Wait, the client expects fallback. Let's just return mode.getBlockAt directly to not break falling collisions right now.
      }
      currentBlock = mode.getBlockAt(x, y, z, chunkManager, bakedBlocks);
    }

    return mode.isIndestructible(x, y, z, bakedBlocks, currentBlock || 0);
  }

  function getBlockAt(x: number, y: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    let currentBlock = chunkManager.getBlockFromChunk(cx, cz, ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, Math.floor(y) - WORLD_Y_OFFSET, ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
    
    if (currentBlock === undefined) {
      if (genWorker && !chunkManager.chunks.has(`${cx},${cz}`) && !chunkManager.dirtyChunks.has(`${cx},${cz}#gen`)) {
         chunkManager.dirtyChunks.add(`${cx},${cz}#gen`); // tag to prevent spam
         genWorker.postMessage({ type: 'generate', cx, cz, worldName, modeName: mode.name });
      }
    }
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
    ].includes(type);

    let mobLvl = 1;
    let hp = 100;
    let scale = 1;

    if (isHostile) {
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
      scale = 1 + (mobLvl - 1) * 0.1;
    } else if (level !== undefined) {
      mobLvl = level;
    }

    hp = calculateMobMaxHealth(type, mobLvl);

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

    if (mode.onMobSpawned) {
      mode.onMobSpawned(mob);
    }

    mobs[id] = mob;
    broadcastToNearby("mobSpawned", mob, x, z, 22500, null);
  }

  // Player Buffer Pool to prevent GC pauses
  const playerBuffers = new Map<string, Buffer>();
  const mobBuffers = new Map<string, Buffer>();
  const hostileMobTypes = ["Zombie", "Creeper", "Skeleton", "Slime", "Morvane"];
const ctx: import("./GameContext").GameContext = {
    ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode, db, mode,
    bakedBlocks, npcs, players, morvaneDead, droppedItems, mobs, minions,
    pendingPlayerUpdates, pendingBlockUpdates, pendingHits, pendingMobHits, pendingRespawns,
    playerBuffers, mobBuffers, spatialHash, playerHash, state,
    CELL_SIZE, PLAYER_CELL_SIZE, dayCycleSpeed, hostileMobTypes,
    getCellKey, broadcastToNearby, spawnMob, isIndestructible, getBlockAt, resetRoom,
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
      p.heldItem = p.isBot ? 441 : 0;
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

  if ((worldName.startsWith("dungeondelver") || worldName.startsWith("skycastles")) && worldName.endsWith("_1")) {
    const hasTeams = mode.name.startsWith("/skycastles") || mode.name.startsWith("/skybridge");
    for (let i = 0; i < 30; i++) {
      const id = "bot_" + Math.random().toString(36).substring(2, 9);
      const team = hasTeams ? (Math.random() < 0.5 ? "blue" : "red") : undefined;
      
      let respawnData = mode.getRespawnPosition(id, { team }, chunkManager, bakedBlocks);
      let retry = 0;
      while (isLavaColumnAt(respawnData.x, respawnData.y, respawnData.z) && retry < 50) {
        respawnData = mode.getRespawnPosition(id, { team }, chunkManager, bakedBlocks);
        retry++;
      }
      const initialPos = {
        x: respawnData.x,
        y: respawnData.y,
        z: respawnData.z,
      };

      players[id] = {
        id,
        isBot: true,
        position: initialPos,
        velocity: { x: 0, y: 0, z: 0 },
        rotation: respawnData.yaw !== undefined ? { x: 0, y: respawnData.yaw, z: 0 } : { x: 0, y: 0, z: 0 },
        skinSeed: id,
        name: BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)] + Math.floor(Math.random()*10),
        health: 100,
        maxHealth: 100,
        defense: 0,
        team: team,
        isDead: false,
        heldItem: 441, // WOODEN_SWORD
        offHandItem: 0,
        joinTime: Date.now(),
        lastRespawnTime: Date.now()
      };
    }
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
    injectChunk: (cx: number, cz: number, data: ArrayBuffer | Buffer) => {
       const key = `${cx},${cz}`;
       chunkManager.dirtyChunks.delete(`${key}#gen`);
       if (!chunkManager.chunks.has(key)) {
          const arr = data instanceof ArrayBuffer 
             ? new Uint16Array(data) 
             : new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
          chunkManager.chunks.set(key, arr);
       }
    },
    isDestroyed: () => state.isDestroyed,
    tick,
    slowTick,
  };
}
