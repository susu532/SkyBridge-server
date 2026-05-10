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
  const isSkyCastlesMode = mode.name.startsWith("/skycastles");
  // Spatial Hash definitions (reused to prevent GC thrashing)
  const CELL_SIZE = 16;
  const PLAYER_CELL_SIZE = 25;
  const getCellKey = (cx: number, cz: number) =>
    (cx & 0x7fff) | ((cz & 0x7fff) << 15);
  const spatialHash = new Map<number, any[]>();
  const playerHash = new Map<number, any[]>();

  const ioNamespace = io.of(mode.name);

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
  let tick10sCount = 0;
  const slowTick = () => {
    tick10sCount++;
    chunkManager.saveDirtyChunks();

    try {
      if (npcs.length > 0) insertNPCs.run(worldName, JSON.stringify(npcs));
    } catch (e) {}

    ioNamespace.emit("timeUpdate", { dayTime });

    if (tick10sCount % 3 === 0) {
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

    const isDay = Math.sin(dayTime * Math.PI * 2) > 0;
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

  let dayTime = 0;
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

  ioNamespace.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    if (Object.keys(players).length === 0 && isSkyCastlesMode) {
      gameStartTime = Date.now();
    }

    // Send current state to new player
    socket.emit("init", {
      players,
      blockChanges: chunkManager.getBlockChangesDict(),
      droppedItems,
      mobs,
      minions,
      dayTime,
      gameStartTime, // added
      npcs,
    });
    
    if (lastSkyCastlesSyncJSON) {
      socket.emit("skyCastlesSync", JSON.parse(lastSkyCastlesSyncJSON));
    }

    // Handle player join
    socket.on("join", (data) => {
      let team = null;

      if (mode.name.startsWith("/skycastles")) {
        let b = 0;
        let r = 0;
        Object.values(players).forEach((p) => {
          if (p.team === "blue") b++;
          if (p.team === "red") r++;
        });
        if (b < 25 && b <= r) {
          team = "blue";
        } else if (r < 25) {
          team = "red";
        } else if (b < 25) {
          team = "blue";
        } else {
          team = Math.random() < 0.5 ? "blue" : "red"; // Fallback if somehow both are >= 25
        }
      }

      const respawnData = mode.getRespawnPosition(
        socket.id,
        { team, position: data.position },
        chunkManager,
        bakedBlocks,
      );
      const initialPos = {
        x: respawnData.x,
        y: respawnData.y,
        z: respawnData.z,
      };

      // Force the client to accept the server-authoritative spawn position
      socket.emit("playerRespawn", {
        id: socket.id,
        position: initialPos,
        team,
        yaw: respawnData.yaw,
      });

      const rawName = String(data.name || "Unknown Player").slice(0, 20);
      const _moderation = chatModerator.moderateMessage(socket.id, rawName, {
        skipSpamCheck: true,
      });
      const finalName = _moderation.isAllowed ? rawName : "Unknown Player";

      players[socket.id] = {
        id: socket.id,
        position: initialPos,
        rotation:
          respawnData.yaw !== undefined
            ? { x: 0, y: respawnData.yaw, z: 0 }
            : data.rotation,
        skinSeed: data.skinSeed || socket.id,
        name: finalName,
        health: 100,
        maxHealth: 100,
        skills: data.skills || {},
        heldItem: data.heldItem || 0,
        offHandItem: data.offHandItem || 0,
        team: team,
        lastRespawnTime: Date.now(),
        kills: 0,
        deaths: 0,
      };
      broadcastToNearby(
        "playerJoined",
        players[socket.id],
        initialPos.x,
        initialPos.z,
        22500,
        socket.id,
      );
      ioNamespace.emit("chatMessage", {
        sender: "System",
        message: `${finalName} joined the game`,
      });
    });

    socket.on("requestPlayerInfo", (targetId) => {
      if (players[targetId]) {
        socket.emit("playerJoined", players[targetId]);
      }
    });

    // Handle skill updates
    socket.on("skillUpdate", (data) => {
      const player = players[socket.id];
      if (player) {
        const now = Date.now();
        if (player.lastSkillTime && now - player.lastSkillTime < 250) return; // Max 4 times per sec
        player.lastSkillTime = now;

        if (!player.skills) player.skills = {};
        player.skills[data.skill] = data.progress;

        // Broadcast to others
        socket.broadcast.emit("skillUpdate", {
          id: socket.id,
          skill: data.skill,
          progress: data.progress,
        });
      }
    });

    // Handle player hit
    socket.on("playerHit", (data) => {
      if (isHubMode) return;
      const { id, damage, knockbackDir, attackerId, reason } = data;

      // Security: Players can only apply self-inflicted damage via this event (e.g. falling into void)
      if (id !== socket.id) return;

      if (players[id]) {
        // Invulnerability for 5 seconds after respawn
        if (Date.now() - (players[id].lastRespawnTime || 0) < 5000) return;

        players[id].health -= damage;
        players[id].lastDamageTime = Date.now();
        if (players[id].health <= 0 && !players[id].isDead) {
          players[id].isDead = true;
          players[id].deaths = (players[id].deaths || 0) + 1;

          const attackerName = players[attackerId]
            ? players[attackerId].name
            : "Someone";
          let deathMessage = `${players[id].name} died`;
          if (reason) {
            deathMessage = `${players[id].name} ${reason}`;
          } else if (id !== attackerId && players[attackerId]) {
            deathMessage = `${players[id].name} was slain by ${attackerName}`;
            players[attackerId].kills = (players[attackerId].kills || 0) + 1;
            ioNamespace.emit("playerStatsUpdate", { 
              id: attackerId, 
              kills: players[attackerId].kills, 
              deaths: players[attackerId].deaths 
            });
            pendingPlayerUpdates.add(attackerId);
          }

          ioNamespace.emit("chatMessage", {
            sender: "System",
            message: deathMessage,
          });

          ioNamespace.emit("playerStatsUpdate", { 
            id: id, 
            kills: players[id].kills, 
            deaths: players[id].deaths 
          });

          broadcastToNearby(
            "playerDied",
            { id },
            players[id].position.x,
            players[id].position.z,
            22500,
            null,
          );

          if (gameState === "endgame") {
            players[id].isDead = false;
            players[id].isSpectator = true;
            ioNamespace.emit("playerStatus", {
              id: id,
              isDead: false,
              isSpectator: true,
              health: 0,
            });
            ioNamespace.to(id).emit("becomeSpectator");
            return;
          }

          // Auto respawn!
          players[id].health = Math.max(100, players[id].maxHealth || 100);
          players[id].isDead = false;
          players[id].lastRespawnTime = Date.now();
          const respawnData = mode.getRespawnPosition(
            id,
            players[id],
            chunkManager,
            bakedBlocks,
          );
          players[id].position = {
            x: respawnData.x,
            y: respawnData.y,
            z: respawnData.z,
          };
          if (respawnData.yaw !== undefined) {
            if (players[id].rotation) players[id].rotation.y = respawnData.yaw;
            else players[id].rotation = { x: 0, y: respawnData.yaw, z: 0 };
          }
          pendingRespawns.push({
            id,
            position: players[id].position,
            team: players[id].team,
            yaw: respawnData.yaw,
          });

          if (attackerId && attackerId !== id && players[attackerId]) {
            ioNamespace
              .to(attackerId)
              .emit("skycoinsRewarded", { amount: 35, reason: "Kill Player" });
          }
        }
        // Broadcast hit back to nearby players ONLY to avoid global packet flooding
        broadcastToNearby(
          "playerHit",
          { id, damage, knockbackDir, attackerId },
          players[id].position.x,
          players[id].position.z,
          22500,
          socket.id, // Exclude the sender so they do not process their own self-inflicted damage twice
        );
      }
    });

    // Handle server-authoritative attack
    socket.on("attack", (data) => {
      if (gameState === "endgame") return;

      const {
        targetId,
        isMob,
        knockbackDir,
        isSprinting,
        damage: clientDamage,
        isCrit: clientIsCrit,
      } = data;

      if (isHubMode && !isMob) return; // Prevent PvP in Hub
      const attacker = players[socket.id];
      if (!attacker) return;

      const now = Date.now();
      if (attacker.lastAttackTime && now - attacker.lastAttackTime < 220)
        return; // Max ~4.5 attacks per second over network to account for jitter
      attacker.lastAttackTime = now;

      // Base combat calculation
      let baseDamage = 5;
      let strength = 0;
      let critChance = 30;
      let critDamage = 50;

      const heldItem = attacker.heldItem || 0;
      const itemStats = (
        itemsData as Record<string, { baseDamage: number; strength: number }>
      )[heldItem.toString()];

      if (itemStats) {
        baseDamage += itemStats.baseDamage;
        strength += itemStats.strength;
      }

      const combatLevel = attacker.skills?.["Combat"]?.level || 0;
      const additiveMultiplier = 1 + combatLevel * 0.04;
      const strengthMultiplier = 1 + strength / 100;

      const _isCrit = Math.random() < critChance / 100;
      const critMultiplier = _isCrit ? 1 + critDamage / 100 : 1;

      let damage = Math.floor(
        baseDamage * strengthMultiplier * critMultiplier * additiveMultiplier,
      );

      if (typeof clientDamage === "number") {
        damage = Math.max(0, Math.floor(clientDamage));
      }

      if (isMob) {
        const mob = mobs[targetId];
        if (mob && knockbackDir) {
          const mobWidth = mob.type === "Morvane" ? 3.0 : 0.6;
          const mobHeight = mob.type === "Morvane" ? 9.0 : 1.8;
          let dx = Math.abs(attacker.position.x - mob.position.x) - mobWidth / 2;
          let dy = 0;
          if (attacker.position.y > mob.position.y + mobHeight) {
            dy = attacker.position.y - (mob.position.y + mobHeight);
          } else if (attacker.position.y < mob.position.y) {
            dy = mob.position.y - attacker.position.y;
          }
          let dz = Math.abs(attacker.position.z - mob.position.z) - mobWidth / 2;
          if (dx < 0) dx = 0;
          if (dy < 0) dy = 0;
          if (dz < 0) dz = 0;

          const distSq = dx * dx + dy * dy + dz * dz;
          const maxDistSquared = mob.type === "Morvane" ? 49 : 64; // Relaxed validation to prevent jitter from false rejections
          if (distSq > maxDistSquared) return; // Validation

          if (mob.team && attacker.team && mob.team === attacker.team) return;

          mob.health -= damage;

          if (!hostileMobTypes.includes(mob.type)) {
            mob.fleeTimer = 5.0;
          }

          if (mob.health <= 0) {
            if (mob.type === "Morvane" && mob.team) {
              morvaneDead[mob.team] = true;
              handleMorvaneDeath(mob.team);
              ioNamespace.emit("mobDespawned", targetId);
            } else {
              broadcastToNearby(
                "mobDespawned",
                targetId,
                mob.position.x,
                mob.position.z,
                22500,
              );
            }
            delete mobs[targetId];
            mobBuffers.delete(targetId);
          } else {
            mob.velocity.x = knockbackDir.x * 1.5;
            mob.velocity.z = knockbackDir.z * 1.5;
            mob.velocity.y = 6;
            mob.knockbackTimer = 0.5;
          }
          pendingMobHits.push({
            id: targetId,
            damage,
            knockbackDir,
            isCrit: clientIsCrit ?? _isCrit,
            attackerId: socket.id,
            position: { x: mob.position.x, z: mob.position.z },
          });
        }
      } else {
        const target = players[targetId];
        if (target) {
          // Invulnerability for 5 seconds after respawn
          if (Date.now() - (target.lastRespawnTime || 0) < 5000) return;

          if (attacker.team && target.team && attacker.team === target.team)
            return;

          const dx = attacker.position.x - target.position.x;
          const dy = attacker.position.y - target.position.y;
          const dz = attacker.position.z - target.position.z;
          if (dx * dx + dy * dy + dz * dz > 100) return; // Validation

          const targetDefense = target.defense || 0;
          const reduction = targetDefense / (targetDefense + 100);
          let actualDamage = damage * (1 - reduction);
          if (target.isBlocking) {
            actualDamage *= 0.5;
          }
          actualDamage = Math.floor(actualDamage);

          target.health -= actualDamage;
          if (actualDamage > 0) target.lastDamageTime = Date.now();
          if (target.health < 0) target.health = 0;
          if (target.health === 0 && !target.isDead) {
            target.isDead = true;
            target.deaths = (target.deaths || 0) + 1;
            attacker.kills = (attacker.kills || 0) + 1;
            pendingPlayerUpdates.add(socket.id);
            
            ioNamespace.emit("playerStatsUpdate", { 
              id: socket.id, 
              kills: attacker.kills, 
              deaths: attacker.deaths 
            });
            ioNamespace.emit("playerStatsUpdate", { 
              id: targetId, 
              kills: target.kills, 
              deaths: target.deaths 
            });

            let deathMessage = `${target.name} was slain by ${attacker.name}`;
            ioNamespace.emit("chatMessage", {
              sender: "System",
              message: deathMessage,
            });
            broadcastToNearby(
              "playerDied",
              { id: targetId },
              target.position.x,
              target.position.z,
              22500,
            );

            // Auto respawn!
            target.health = Math.max(100, target.maxHealth || 100);
            target.isDead = false;
            target.lastRespawnTime = Date.now();
            const tRespawnData = mode.getRespawnPosition(
              target.id,
              target,
              chunkManager,
              bakedBlocks,
            );
            target.position = {
              x: tRespawnData.x,
              y: tRespawnData.y,
              z: tRespawnData.z,
            };
            if (tRespawnData.yaw !== undefined) {
              if (target.rotation) target.rotation.y = tRespawnData.yaw;
              else target.rotation = { x: 0, y: tRespawnData.yaw, z: 0 };
            }
            pendingRespawns.push({
              id: targetId,
              position: target.position,
              team: target.team,
              yaw: tRespawnData.yaw,
            });

            if (targetId !== socket.id) {
              socket.emit("skycoinsRewarded", {
                amount: 35,
                reason: "Kill Player",
              });
            }
          }
          pendingHits.push({
            id: targetId,
            damage: actualDamage,
            knockbackDir,
            attackerId: socket.id,
            isCrit: clientIsCrit ?? _isCrit,
            position: { x: target.position.x, z: target.position.z },
          });
        }
      }
    });

    socket.on("requestRespawn", () => {
      const p = players[socket.id];
      if (p && p.isDead) {
        if (gameState === "endgame") {
          // Do not allow respawn during endgame cutscene
          return;
        }
        p.health = Math.max(100, p.maxHealth || 100);
        p.isDead = false;
        const pRespawnData = mode.getRespawnPosition(
          p.id,
          p,
          chunkManager,
          bakedBlocks,
        );
        p.position = {
          x: pRespawnData.x,
          y: pRespawnData.y,
          z: pRespawnData.z,
        };
        if (pRespawnData.yaw !== undefined) {
          if (p.rotation) p.rotation.y = pRespawnData.yaw;
          else p.rotation = { x: 0, y: pRespawnData.yaw, z: 0 };
        }
        pendingRespawns.push({
          id: socket.id,
          position: p.position,
          team: p.team,
          yaw: pRespawnData.yaw,
        });
      }
    });

    // Handle binary packed player movement
    socket.on("moveP", (buf: Buffer | ArrayBuffer) => {
      const player = players[socket.id];
      if (!player) return;

      try {
        // Socket.IO receives Node 'Buffer' in the backend
        let view: DataView;
        if (Buffer.isBuffer(buf)) {
          view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        } else {
          view = new DataView(buf as ArrayBuffer);
        }
        const px = view.getFloat32(0);
        const py = view.getFloat32(4);
        const pz = view.getFloat32(8);
        const rx = view.getFloat32(12);
        const ry = view.getFloat32(16);

        if (player.position) {
          if (
            player.isDead ||
            (player.isSpectator && gameState === "endgame")
          ) {
            // Let them spectate if spectator, but if dead, ignore move updates completely
            if (player.isDead) return;
          }
          const dx = player.position.x - px;
          const dy = player.position.y - py;
          const dz = player.position.z - pz;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > 900) {
            // Teleporting more than 30 blocks instantly is invalid
            socket.emit("playerRespawn", {
              id: socket.id,
              position: player.position,
            });
            return;
          }
        }

        const newPos = { x: px, y: py, z: pz };
        player.position = newPos;
        player.rotation = { x: rx, y: ry, z: 0 };

        pendingPlayerUpdates.add(socket.id);
      } catch (e) {
        console.error("Invalid moveP buffer length");
      }
    });

    socket.on("updateProfile", (data: { name: string; skinSeed?: string }) => {
      if (!players[socket.id]) return;
      if (data.name) {
        const rawName = String(data.name).slice(0, 20);
        const mod = chatModerator.moderateMessage(socket.id, rawName, {
          skipSpamCheck: true,
        });
        if (mod.isAllowed) {
          players[socket.id].name = rawName;
        }
      }
      if (data.skinSeed) {
        players[socket.id].skinSeed = data.skinSeed;
      }
      // Broadcast the updated player to inform everyone of the new name/skin
      ioNamespace.emit("playerJoined", players[socket.id]);
      pendingPlayerUpdates.add(socket.id);
    });

    socket.on("playerState", (state: any) => {
      if (!players[socket.id]) return;
      players[socket.id].isFlying = state.isFlying;
      players[socket.id].isSwimming = state.isSwimming;
      players[socket.id].isCrouching = state.isCrouching;
      players[socket.id].isSprinting = state.isSprinting;
      players[socket.id].isSwinging = state.isSwinging;
      players[socket.id].isGliding = state.isGliding;
      players[socket.id].isBlocking = state.isBlocking;
      players[socket.id].swingSpeed = state.swingSpeed;
      players[socket.id].isGrounded = state.isGrounded;
      players[socket.id].heldItem = state.heldItem;
      players[socket.id].offHandItem = state.offHandItem;
      players[socket.id].defense = state.defense;
      if (state.maxHealth !== undefined)
        players[socket.id].maxHealth = state.maxHealth;
      pendingPlayerUpdates.add(socket.id);
    });

    // Handle legacy player movement
    socket.on("move", (data) => {
      const player = players[socket.id];
      if (player) {
        if (player.isDead) return;

        // Anti-cheat: distance limit per tick
        if (player.position) {
          const dx = player.position.x - data.position.x;
          const dy = player.position.y - data.position.y;
          const dz = player.position.z - data.position.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq > 900) {
            // Teleporting more than 30 blocks instantly is invalid
            socket.emit("playerRespawn", {
              id: socket.id,
              position: player.position,
            });
            return;
          }
        }

        player.position = data.position;
        player.rotation = data.rotation;
        player.isFlying = data.isFlying;
        player.isSwimming = data.isSwimming;
        player.isCrouching = data.isCrouching;
        player.isSprinting = data.isSprinting;
        player.isSwinging = data.isSwinging;
        player.swingSpeed = data.swingSpeed;
        player.isGrounded = data.isGrounded;
        player.heldItem = data.heldItem;
        player.offHandItem = data.offHandItem || 0;
        player.defense = data.defense || 0;
        if (data.maxHealth !== undefined) player.maxHealth = data.maxHealth;

        pendingPlayerUpdates.add(socket.id);
      }
    });

    // Handle block changes
    socket.on("setBlock", (data) => {
      const { x, y, z, type } = data;

      if (gameState === "endgame") return;

      const player = players[socket.id];
      if (!player) return;

      const now = Date.now();
      if (player.lastBlockTime && now - player.lastBlockTime < 10) return; // Max 100 blocks per second per player
      player.lastBlockTime = now;

      if (player) {
        const dx = player.position.x - x;
        const dy = player.position.y - y;
        const dz = player.position.z - z;
        if (dx * dx + dy * dy + dz * dz > 144) return; // Range validation (approx 12 blocks)
      }

      // Prevent modifying indestructible blocks
      if (isIndestructible(x, y, z)) {
        const currentBlock = getBlockAt(x, y, z);
        socket.emit("blockChanged", { x, y, z, type: currentBlock || 0 });
        return; // Ignore request to modify indestructible block
      }

      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = y - WORLD_Y_OFFSET;
      chunkManager.setBlockInChunk(cx, cz, lx, ly, lz, type);
      chunkManager.markChunkDirty(x, z);

      // Broadcast to nearby players
      broadcastToNearby(
        "blockChanged",
        data,
        player.position.x,
        player.position.z,
        22500,
        socket.id,
      ); // 150 blocks radius
    });

    // Handle chat message
    socket.on("chatMessage", async (message) => {
      const player = players[socket.id];
      if (player) {
        const now = Date.now();
        if (player.lastChatTime && now - player.lastChatTime < 500) return; // Max 2 messages per second
        player.lastChatTime = now;

        const trimmed = String(message).slice(0, 200); // Max 200 chars
        if (trimmed.length === 0) return;

        const moderationResult = chatModerator.moderateMessage(
          socket.id,
          trimmed,
        );

        if (moderationResult.isAllowed) {
          ioNamespace.emit("chatMessage", {
            sender: player.name,
            message: trimmed,
            team: player.team,
          });
        } else {
          // Send a message back to the sender
          socket.emit("chatMessage", {
            sender: "System",
            message: `§c${moderationResult.reason || "Your message was blocked by moderation."}`,
          });
        }
      }
    });

    // Handle dropping items
    socket.on("dropItem", (data) => {
      const player = players[socket.id];
      if (player) {
        const now = Date.now();
        if (player.lastDropTime === now) {
          player.dropsInTick = (player.dropsInTick || 0) + 1;
          if (player.dropsInTick > 64) return;
        } else {
          player.lastDropTime = now;
          player.dropsInTick = 1;
        }
      }

      // Limit total dropped items to 500 to prevent performance issues
      const itemIds = Object.keys(droppedItems);
      if (itemIds.length >= 500) {
        const oldestId = itemIds[0];
        const pos = droppedItems[oldestId].position;
        delete droppedItems[oldestId];
        broadcastToNearby("itemDespawned", oldestId, pos.x, pos.z, 22500, null);
      }

      const id = Math.random().toString(36).substring(2, 9);
      const item = {
        id,
        type: data.type,
        position: data.position,
        velocity: data.velocity,
        timestamp: Date.now(),
      };
      droppedItems[id] = item;
      broadcastToNearby(
        "itemSpawned",
        item,
        data.position.x,
        data.position.z,
        22500,
        null,
      );
    });

    // Handle picking up items
    socket.on("pickupItem", (id) => {
      if (droppedItems[id]) {
        const itemType = droppedItems[id].type;
        const pos = droppedItems[id].position;
        delete droppedItems[id];
        socket.emit("itemAcquired", { type: itemType, count: 1 });
        broadcastToNearby("itemDespawned", id, pos.x, pos.z, 22500, null);
      }
    });

    // Handle spawning minions
    socket.on("spawnMinion", (data) => {
      const player = players[socket.id];
      if (!player) return;

      let playerMinionCount = 0;
      for (const mId in minions) {
        if (minions[mId].ownerId === socket.id) playerMinionCount++;
      }

      if (playerMinionCount >= 30) return; // Max 30 minions per player
      if (Object.keys(minions).length >= 500) return; // Global hard cap for the whole instance

      const id = "minion_" + Math.random().toString(36).substring(2, 9);
      const minion = {
        id,
        type: data.type,
        position: data.position,
        ownerId: socket.id,
        storage: 0,
        maxStorage: 64,
        lastActionTime: Date.now(),
      };
      minions[id] = minion;
      broadcastToNearby(
        "minionSpawned",
        minion,
        data.position.x,
        data.position.z,
        22500,
        null,
      );
    });

    // Handle removing minions
    socket.on("removeMinion", (id) => {
      if (minions[id]) {
        const pos = minions[id].position;
        delete minions[id];
        broadcastToNearby("minionDespawned", id, pos.x, pos.z, 22500, null);
      }
    });

    // Handle collecting from minions
    socket.on("collectMinion", (id) => {
      const minion = minions[id];
      if (minion && minion.storage > 0) {
        const amount = minion.storage;
        minion.storage = 0;
        socket.emit("minionCollected", { id, amount, type: minion.type });
        broadcastToNearby(
          "minionUpdate",
          { id, storage: 0 },
          minion.position.x,
          minion.position.z,
          22500,
          null,
        );
      }
    });

    // Deprecated: client attempts to hit mobs directly via `mobHit` will be ignored
    // Clients must use the server-authoritative `attack` event instead to prevent damage exploits
    socket.on("mobHit", (data) => {
      // Ignored. Server handles it via `attack`.
    });

    socket.on("spawnMob", (data) => {
      if (!mode.allowPlayerMobSpawns && data?.type !== "Morvane") return;
      if (!data || !data.type || !data.position) return;
      const { type, position, level, team } = data;

      // Limit total mobs (except for Bosses like Morvane)
      if (
        Object.keys(mobs).length >
          Math.min(600, Object.keys(players).length * 12) &&
        type !== "Morvane"
      )
        return;

      // Prevent duplicate mobs at the same location
      for (const id in mobs) {
        const m = mobs[id];
        const distLimit = type === "Morvane" ? 50 : 0.5;
        if (
          m.type === type &&
          Math.abs(m.position.x - position.x) < distLimit &&
          Math.abs(m.position.z - position.z) < distLimit
        ) {
          return; // Already spawned
        }
      }

      spawnMob(type, position.x, position.y, position.z, level, team);
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      const p = players[socket.id];
      if (p) {
        // Broadcast left globally to prevent ghost players, since a player disconnected 
        // from a different chunk might still be rendered for players out of broadcastToNearby range.
        ioNamespace.emit("playerLeft", socket.id);
        
        ioNamespace.emit("chatMessage", {
          sender: "System",
          message: `${p.name} left the game`,
        });
      }
      delete players[socket.id];
      pendingPlayerUpdates.delete(socket.id);
      playerBuffers.delete(socket.id);
    });
  });

  // Player Buffer Pool to prevent GC pauses
  const playerBuffers = new Map<string, Buffer>();
  const mobBuffers = new Map<string, Buffer>();

  // Server Tick Loop (20Hz)
  const hostileMobTypes = ["Zombie", "Creeper", "Skeleton", "Slime", "Morvane"];

  // Game Reset / End Game state
  let gameState = "playing"; // "playing" | "endgame"
  let resetCountdown: number | null = null;
  let emptyRoomSince: number | null = null;
  let hasSetEndgameMessage = false;
  let hasBeenReset = false;
  let gameStartTime = Date.now();
  let lastOvertimeDamageTick = 0;

  function resetRoom() {
    gameState = "playing";
    resetCountdown = null;
    emptyRoomSince = null;
    hasSetEndgameMessage = false;
    dayTime = 0;
    ioNamespace.emit("timeUpdate", { dayTime });
    gameStartTime = Date.now();
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

    ioNamespace.emit("entitiesReset", { mobs, droppedItems, gameStartTime });

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
        dayTime,
        npcs,
      });
    }
  }

  function handleMorvaneDeath(deadTeam: string) {
    if (gameState === "endgame") return;
    gameState = "endgame";
    resetCountdown = Date.now() + 15000;
    hasBeenReset = false;

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

  let lastSkyCastlesSyncJSON = "";

  const tick = (delta: number) => {
    const now = Date.now();

    let hasPlayersForReset = false;
    for (const _ in players) {
      hasPlayersForReset = true;
      break;
    }

    if (!hasPlayersForReset) {
      if (emptyRoomSince === null) emptyRoomSince = now;
      else if (now - emptyRoomSince >= 0) {
        if (isSkyCastlesMode && !hasBeenReset) {
          resetRoom();
          hasBeenReset = true;
        } else if (!isSkyCastlesMode) {
          emptyRoomSince = null;
        }
      }
    } else {
      emptyRoomSince = null;
      hasBeenReset = false;
      if (gameState === "endgame") {
        if (!hasSetEndgameMessage) {
          hasSetEndgameMessage = true;
          ioNamespace.emit("chatMessage", {
            sender: "System",
            message: "Game restarting in 15 seconds...",
          });
        }
        if (resetCountdown && now >= resetCountdown) {
          resetRoom();
        }
      }
    }

    const memBlocks: Record<string, number> = {};
    const fastGetBlock = (bx: number, by: number, bz: number) => {
      const cx = Math.floor(bx);
      const cy = Math.floor(by);
      const cz = Math.floor(bz);
      const key = `${cx},${cy},${cz}`;
      if (key in memBlocks) return memBlocks[key];
      const blk = getBlockAt(cx, cy, cz);
      memBlocks[key] = blk;
      return blk;
    };

    // Clear spatial hashes instead of reallocating
    for (const cell of spatialHash.values()) cell.length = 0;
    for (const cell of playerHash.values()) cell.length = 0;

    for (const mId in mobs) {
      const m = mobs[mId];
      const key = getCellKey(
        Math.floor(m.position.x / CELL_SIZE),
        Math.floor(m.position.z / CELL_SIZE),
      );
      let cell = spatialHash.get(key);
      if (!cell) {
        cell = [];
        spatialHash.set(key, cell);
      }
      cell.push(m);
    }

    for (const pId in players) {
      const p = players[pId];
      const pcx = Math.floor(p.position.x / PLAYER_CELL_SIZE);
      const pcz = Math.floor(p.position.z / PLAYER_CELL_SIZE);
      const key = getCellKey(pcx, pcz);
      let cell = playerHash.get(key);
      if (!cell) {
        cell = [];
        playerHash.set(key, cell);
      }
      cell.push(p);

      // Update socket.io spatial subscription
      if (!p.lastGrid || p.lastGrid.x !== pcx || p.lastGrid.z !== pcz) {
        p.lastGrid = { x: pcx, z: pcz };
        const sock = ioNamespace.sockets.get(pId);
        if (sock) {
          // clear old grid rooms
          for (const r of Array.from(sock.rooms)) {
            if (r.startsWith("grid_")) sock.leave(r);
          }
          for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
              sock.join(`grid_${getCellKey(pcx + dx, pcz + dz)}`);
            }
          }
        }
      }
    }

    // Health Regeneration
    let numPlayersRegen = 0;
    for (const id in players) {
      const p = players[id];
      if (p && !p.isDead && p.health < (p.maxHealth || 100)) {
        if (now - (p.lastDamageTime || 0) >= 20000) {
          const healthRegen = ((p.maxHealth || 100) * 0.01 + 1) * delta;
          p.health = Math.min(p.maxHealth || 100, p.health + healthRegen);
          pendingPlayerUpdates.add(id); // Send updated health to clients
          numPlayersRegen++;
        }
      }
    }

    // 20 Minute Overtime rules for Sky Castles
    if (isSkyCastlesMode && now - gameStartTime >= 20 * 60 * 1000) {
      if (now - lastOvertimeDamageTick >= 1000) {
        lastOvertimeDamageTick = now;
        
        // Morvane takes 100 damage/sec
        for (const mId in mobs) {
          const mob = mobs[mId];
          if (mob.type === "Morvane") {
            mob.health -= 100;
            if (mob.health <= 0) {
              if (mob.team) {
                morvaneDead[mob.team] = true;
                handleMorvaneDeath(mob.team);
              }
              ioNamespace.emit("mobDespawned", mId);
              delete mobs[mId];
              mobBuffers.delete(mId);
            } else {
              pendingMobHits.push({
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

    // Player updates (Global Broadcast for scalability)
    if (pendingPlayerUpdates.size > 0) {
      // Pre-compute buffers for all pending players
      const updates: Record<string, Buffer> = {};
      for (const id of pendingPlayerUpdates) {
        const p = players[id];
        if (p && !p.isDead) {
          let stateMask = 0;
          if (p.isFlying) stateMask |= 1;
          if (p.isSwimming) stateMask |= 2;
          if (p.isCrouching) stateMask |= 4;
          if (p.isSprinting) stateMask |= 8;
          if (p.isSwinging) stateMask |= 16;
          if (p.isGrounded) stateMask |= 32;
          if (p.isBlocking) stateMask |= 64;
          if (p.isGliding) stateMask |= 128;
          if (Date.now() - (p.lastRespawnTime || 0) < 5000) stateMask |= 256;

          let buf = playerBuffers.get(id);
          if (!buf) {
            buf = Buffer.allocUnsafe(11 * 4);
            playerBuffers.set(id, buf);
          }
          const arr = new Float32Array(buf.buffer, buf.byteOffset, 11);

          arr[0] = p.position.x;
          arr[1] = p.position.y;
          arr[2] = p.position.z;
          arr[3] = p.rotation.x;
          arr[4] = p.rotation.y;
          arr[5] = stateMask;
          arr[6] = p.swingSpeed || 0;
          arr[7] = p.heldItem || 0;
          arr[8] = p.offHandItem || 0;
          arr[9] = p.defense || 0;
          arr[10] = p.health || 0;

          updates[id] = buf;
        }
      }

      // Distance-based Player Culling via Socket.IO Rooms
      const updatesByGrid = new Map<number, Record<string, Buffer>>();

      for (const id of pendingPlayerUpdates) {
        const p = players[id];
        if (!p || p.isDead) continue;
        const pcx = Math.floor(p.position.x / PLAYER_CELL_SIZE);
        const pcz = Math.floor(p.position.z / PLAYER_CELL_SIZE);
        const key = getCellKey(pcx, pcz);
        let cellUpdates = updatesByGrid.get(key);
        if (!cellUpdates) {
          cellUpdates = {};
          updatesByGrid.set(key, cellUpdates);
        }
        if (updates[id]) cellUpdates[id] = updates[id];
      }

      for (const [key, cellUpdates] of updatesByGrid.entries()) {
        ioNamespace
          .to(`grid_${key}`)
          .volatile.emit("playersUpdate", cellUpdates);
      }

      pendingPlayerUpdates.clear();
    }

    if (pendingHits.length > 0) {
      const hitsByGrid = new Map<number, any[]>();
      for (const h of pendingHits) {
        const cx = Math.floor(h.position.x / PLAYER_CELL_SIZE);
        const cz = Math.floor(h.position.z / PLAYER_CELL_SIZE);
        const key = getCellKey(cx, cz);
        let cellHits = hitsByGrid.get(key);
        if (!cellHits) {
          cellHits = [];
          hitsByGrid.set(key, cellHits);
        }
        cellHits.push(h);
      }
      for (const [key, hits] of hitsByGrid.entries()) {
        ioNamespace.to(`grid_${key}`).emit("batchedPlayerHits", hits);
      }
      pendingHits.length = 0;
    }
    if (pendingMobHits.length > 0) {
      const mobHitsByGrid = new Map<number, any[]>();
      for (const h of pendingMobHits) {
        const cx = Math.floor(h.position.x / PLAYER_CELL_SIZE);
        const cz = Math.floor(h.position.z / PLAYER_CELL_SIZE);
        const key = getCellKey(cx, cz);
        let cellHits = mobHitsByGrid.get(key);
        if (!cellHits) {
          cellHits = [];
          mobHitsByGrid.set(key, cellHits);
        }
        cellHits.push(h);
      }
      for (const [key, hits] of mobHitsByGrid.entries()) {
        ioNamespace.to(`grid_${key}`).emit("batchedMobHits", hits);
      }
      pendingMobHits.length = 0;
    }
    if (pendingRespawns.length > 0) {
      for (const data of pendingRespawns) {
        ioNamespace.emit("playerRespawn", data);
      }
      pendingRespawns.length = 0;
    }

    // Mob updates
    const gravity = -20;

    for (const id in mobs) {
      const mob = mobs[id];

      if (mob.type === "Morvane") {
        // Special logic for Morvane: It is completely stationary
        // It floats via client-side rendering, server just keeps it alive and registers hits.
        continue;
      }

      // Initialize AI state if missing
      if (mob.wanderTimer === undefined) {
        mob.wanderTimer = 0;
        mob.wanderAngle = 0;
        mob.fleeTimer = 0;
        mob.knockbackTimer = 0;
        mob.stuckTimer = 0;
        mob.stuckAngle = -1;
        mob.aiTimer = Math.random() * 0.25; // Random offset to stagger AI ticks
      }

      if (mob.knockbackTimer > 0) {
        mob.knockbackTimer -= delta;
      }

      mob.aiTimer += delta;
      const mpCX = Math.floor(mob.position.x / PLAYER_CELL_SIZE);
      const mpCY = Math.floor(mob.position.y / PLAYER_CELL_SIZE);
      const mpCZ = Math.floor(mob.position.z / PLAYER_CELL_SIZE);

      if (mob.aiTimer >= 0.25) {
        // AI runs at ~4Hz
        mob.aiTimer = 0;
        let closestDist = Infinity;
        let closestPlayer: any = null;

        // We must check up to 3 cells away (3 * 25 = 75 blocks) to wake up correctly when players are within 60 blocks.
        for (let ix = -3; ix <= 3; ix++) {
          for (let iz = -3; iz <= 3; iz++) {
            const key = getCellKey(mpCX + ix, mpCZ + iz);
            const cellPlayers = playerHash.get(key);
            if (cellPlayers) {
              for (const p of cellPlayers) {
                if (
                  p.isDead ||
                  p.isSpectator ||
                  (mob.team && p.team && mob.team === p.team)
                )
                  continue;
                const dx = p.position.x - mob.position.x;
                const dy = p.position.y - mob.position.y;
                const dz = p.position.z - mob.position.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq < closestDist * closestDist) {
                  closestDist = Math.sqrt(distSq);
                  closestPlayer = p;
                }
              }
            }
          }
        }
        mob.closestDist = closestDist;
        mob.closestPlayerId = closestPlayer ? closestPlayer.id : null;
      }

      let closestDist = mob.closestDist || Infinity;
      let closestPlayer = mob.closestPlayerId
        ? players[mob.closestPlayerId]
        : null;

      // Suspend simulation if no players are within 120 blocks (~5 chunks)
      // Except for bosses like Morvane who might need to keep track of state, but Morvane stays at 0,0 usually.
      if (closestDist > 120 && mob.type !== "Morvane") {
        continue;
      }

      // Movement logic
      let moveSpeed = 2.5;
      let wishDirX = 0;
      let wishDirZ = 0;

      const isHostile = hostileMobTypes.includes(mob.type);

      if (mob.knockbackTimer > 0) {
        // Apply knockback velocity with friction
        mob.velocity.x *= 0.9;
        mob.velocity.z *= 0.9;
        wishDirX = mob.velocity.x;
        wishDirZ = mob.velocity.z;
        moveSpeed = 1.0; // Velocity is already scaled, so multiplier is 1
      } else if (mob.fleeTimer > 0) {
        mob.fleeTimer -= delta;
        if (closestPlayer) {
          const dx = mob.position.x - closestPlayer.position.x;
          const dz = mob.position.z - closestPlayer.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > 0.1) {
            wishDirX = dx / len;
            wishDirZ = dz / len;
            moveSpeed = 4.0; // Run away faster
          }
        }
      } else if (isHostile && closestPlayer && closestDist < 25) {
        if (mob.stuckTimer < 0 && mob.stuckAngle !== -1) {
          wishDirX = Math.cos(mob.stuckAngle);
          wishDirZ = Math.sin(mob.stuckAngle);
          mob.stuckTimer += delta;
          if (mob.stuckTimer >= 0) {
            mob.stuckAngle = -1;
          }
        } else {
          const dx = closestPlayer.position.x - mob.position.x;
          const dz = closestPlayer.position.z - mob.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > 0.5) {
            wishDirX = dx / len;
            wishDirZ = dz / len;
          }

          // Attack logic
          if (closestDist <= 1.5 && mob.stuckTimer >= 0) {
            mob.lastAttackTime = mob.lastAttackTime || 0;
            const now = Date.now();
            if (
              now - mob.lastAttackTime > 1500 &&
              !closestPlayer.isDead &&
              !closestPlayer.isSpectator
            ) {
              mob.lastAttackTime = now;
              const baseDamage = 5 * (mob.level || 1);

              const defense = closestPlayer.defense || 0;
              let blockMultiplier = 1.0;
              if (closestPlayer.isBlocking) {
                blockMultiplier = 0.5;
              }

              // Invulnerability for 5 seconds after respawn
              if (Date.now() - (closestPlayer.lastRespawnTime || 0) < 5000)
                continue;

              const damageReduction = defense / (defense + 100);
              let actualDamage =
                baseDamage * (1 - damageReduction) * blockMultiplier;
              actualDamage = Math.max(1, Math.round(actualDamage));

              closestPlayer.health -= actualDamage;
              closestPlayer.lastDamageTime = Date.now();

              const pushLen = Math.max(0.1, len);
              const kb = { x: dx / pushLen, y: 0.4, z: dz / pushLen };

              ioNamespace.emit("playerHit", {
                id: closestPlayer.id,
                damage: actualDamage,
                knockbackDir: kb,
                attackerId: id,
                reason: `was slain by a ${mob.type}`, // server parses this if id == attackerId, but here id != attackerId so it will say was slain by Someone if we dont do reason
              });

              if (closestPlayer.health <= 0 && !closestPlayer.isDead) {
                closestPlayer.isDead = true;
                ioNamespace.emit("chatMessage", {
                  sender: "System",
                  message: `${closestPlayer.name} was slain by a ${mob.type}`,
                });
                broadcastToNearby(
                  "playerDied",
                  { id: closestPlayer.id },
                  closestPlayer.position.x,
                  closestPlayer.position.z,
                  22500,
                );

                // Auto respawn!
                closestPlayer.health = Math.max(
                  100,
                  closestPlayer.maxHealth || 100,
                );
                closestPlayer.isDead = false;
                closestPlayer.lastRespawnTime = Date.now();
                const cRespawnData = mode.getRespawnPosition(
                  closestPlayer.id,
                  closestPlayer,
                  chunkManager,
                  bakedBlocks,
                );
                closestPlayer.position = {
                  x: cRespawnData.x,
                  y: cRespawnData.y,
                  z: cRespawnData.z,
                };
                if (cRespawnData.yaw !== undefined) {
                  if (closestPlayer.rotation)
                    closestPlayer.rotation.y = cRespawnData.yaw;
                  else
                    closestPlayer.rotation = {
                      x: 0,
                      y: cRespawnData.yaw,
                      z: 0,
                    };
                }
                pendingRespawns.push({
                  id: closestPlayer.id,
                  position: closestPlayer.position,
                  team: closestPlayer.team,
                  yaw: cRespawnData.yaw,
                });
              }
            }
          }
        }
      } else if (!isHostile) {
        // Passive wandering
        mob.wanderTimer -= delta;
        if (mob.wanderTimer <= 0) {
          mob.wanderTimer = 2 + Math.random() * 5;
          if (Math.random() < 0.4) {
            mob.wanderAngle = -1; // Idle
          } else {
            mob.wanderAngle = Math.random() * Math.PI * 2;
          }
        }

        if (mob.wanderAngle !== -1) {
          wishDirX = Math.cos(mob.wanderAngle);
          wishDirZ = Math.sin(mob.wanderAngle);
          moveSpeed = 1.2;
        }
      }

      // Water and Ledge avoidance for ALL mobs
      if (mob.isGrounded && mob.knockbackTimer <= 0) {
        const checkDist = 0.8;
        const checkX = mob.position.x + wishDirX * checkDist;
        const checkZ = mob.position.z + wishDirZ * checkDist;
        const blockBelow = fastGetBlock(checkX, mob.position.y - 0.5, checkZ);
        const blockFarBelow = fastGetBlock(
          checkX,
          mob.position.y - 1.5,
          checkZ,
        );
        const blockAtFeet = fastGetBlock(checkX, mob.position.y + 0.5, checkZ);

        const isWater =
          blockAtFeet === BLOCK.WATER ||
          blockAtFeet === BLOCK.LAVA ||
          blockBelow === BLOCK.WATER ||
          blockBelow === BLOCK.LAVA;
        const isLedge =
          !isSolidBlock(blockBelow) && !isSolidBlock(blockFarBelow) && !isWater;

        if (isWater || (isLedge && !isHostile)) {
          wishDirX = 0;
          wishDirZ = 0;
          if (!isHostile) mob.wanderTimer = 0;
        }
      }

      // Entity push/separation (Collision with other mobs and players)
      let pushX = 0;
      let pushZ = 0;
      const pushRadius = 0.8;
      let pushCount = 0; // Optimization: limit collision interactions per tick to prevent O(n^2) clustering lag

      for (let ix = -1; ix <= 1 && pushCount < 4; ix++) {
        for (let iz = -1; iz <= 1 && pushCount < 4; iz++) {
          const key = getCellKey(mpCX + ix, mpCZ + iz);
          const cellPlayers = playerHash.get(key);
          if (cellPlayers) {
            for (const p of cellPlayers) {
              if (Math.abs(p.position.y - mob.position.y) < 1.5) {
                const dx = mob.position.x - p.position.x;
                const dz = mob.position.z - p.position.z;
                const distSq = dx * dx + dz * dz;
                if (distSq < pushRadius * pushRadius && distSq > 0.001) {
                  const dist = Math.sqrt(distSq);
                  pushX += (dx / dist) * (pushRadius - dist) * 0.2;
                  pushZ += (dz / dist) * (pushRadius - dist) * 0.2;
                  pushCount++;
                }
              }
            }
          }
        }
      }

      // Use spatial hash to quickly find nearby mobs
      const mx = mob.position.x;
      const my = mob.position.y;
      const mz = mob.position.z;
      for (let ix = -1; ix <= 1 && pushCount < 8; ix++) {
        for (let iz = -1; iz <= 1 && pushCount < 8; iz++) {
          const key = getCellKey(
            Math.floor((mx + ix * CELL_SIZE) / CELL_SIZE),
            Math.floor((mz + iz * CELL_SIZE) / CELL_SIZE),
          );
          const adjacentMobs = spatialHash.get(key);
          if (adjacentMobs) {
            for (const m of adjacentMobs) {
              if (m.id === id) continue;
              if (Math.abs(m.position.y - my) < 1.5) {
                const dx = mx - m.position.x;
                const dz = mz - m.position.z;
                const distSq = dx * dx + dz * dz;
                if (distSq < pushRadius * pushRadius && distSq > 0.001) {
                  const dist = Math.sqrt(distSq);
                  pushX += (dx / dist) * (pushRadius - dist) * 0.2;
                  pushZ += (dz / dist) * (pushRadius - dist) * 0.2;
                  pushCount++;
                }
              }
            }
          }
        }
      }

      // Apply gravity
      mob.velocity.y += gravity * delta;

      // Horizontal movement with radius-based collision and sliding
      const radius = 0.35;
      const canMoveTo = (tx: number, tz: number, ty: number) => {
        // Prevent mobs from entering protected areas (castles, villages)
        let inProtectedZone = false;

        if (isSkyCastlesMode) {
          const protectionEnd = 520;
          const safeZStartBlue = 70;
          const safeZStartRed = -70;
          const dxBlue = Math.max(0, Math.abs(tx) - 50);
          const dzBlue = Math.max(0, safeZStartBlue - tz, tz - protectionEnd);
          const dxRed = Math.max(0, Math.abs(tx) - 50);
          const dzRed = Math.max(0, -protectionEnd - tz, tz - safeZStartRed);
          inProtectedZone =
            Math.min(
              Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue),
              Math.sqrt(dxRed * dxRed + dzRed * dzRed),
            ) <= 0;
        } else if (mode.name.startsWith("/skybridge")) {
          const protectionEnd = 110;
          const safeZStartBlue = 61;
          const safeZStartRed = -61;
          const dxBlue = Math.max(0, Math.abs(tx) - 50);
          const dzBlue = Math.max(0, safeZStartBlue - tz, tz - protectionEnd);
          const dxRed = Math.max(0, Math.abs(tx) - 50);
          const dzRed = Math.max(0, -protectionEnd - tz, tz - safeZStartRed);
          inProtectedZone =
            Math.min(
              Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue),
              Math.sqrt(dxRed * dxRed + dzRed * dzRed),
            ) <= 0;
        }

        if (inProtectedZone) return false;

        const offsets = [
          { x: -radius, z: -radius },
          { x: radius, z: -radius },
          { x: -radius, z: radius },
          { x: radius, z: radius },
        ];
        for (const off of offsets) {
          const legBlock = fastGetBlock(tx + off.x, ty + 0.5, tz + off.z);
          const headBlock = fastGetBlock(tx + off.x, ty + 1.5, tz + off.z);
          if (isSolidBlock(legBlock) || isSolidBlock(headBlock)) return false;
          // Also treat water/lava as solid for mobs so they don't enter it
          if (legBlock === BLOCK.WATER || legBlock === BLOCK.LAVA) return false;

          // Cliff detection (don't walk off ledges higher than 4 blocks)
          if (mob.type !== "Morvane") {
            let safeDropFound = false;
            for (let drop = 0; drop < 4; drop++) {
              if (
                isSolidBlock(
                  fastGetBlock(tx + off.x, ty - 0.5 - drop, tz + off.z),
                )
              ) {
                safeDropFound = true;
                break;
              }
            }
            if (!safeDropFound) return false;
          }
        }
        return true;
      };

      // Apply push directly to position
      if (pushX !== 0 || pushZ !== 0) {
        const nextPushX = mob.position.x + pushX;
        const nextPushZ = mob.position.z + pushZ;
        if (canMoveTo(nextPushX, mob.position.z, mob.position.y))
          mob.position.x = nextPushX;
        if (canMoveTo(mob.position.x, nextPushZ, mob.position.y))
          mob.position.z = nextPushZ;
      }

      const nextX = mob.position.x + wishDirX * moveSpeed * delta;
      const nextZ = mob.position.z + wishDirZ * moveSpeed * delta;

      let moved = false;
      if (canMoveTo(nextX, nextZ, mob.position.y)) {
        mob.position.x = nextX;
        mob.position.z = nextZ;
        moved = true;
      } else if (
        mob.isGrounded &&
        canMoveTo(nextX, nextZ, mob.position.y + 1)
      ) {
        mob.velocity.y = 7;
        mob.isGrounded = false;
        moved = true;
      } else {
        // Try sliding X
        if (canMoveTo(nextX, mob.position.z, mob.position.y)) {
          mob.position.x = nextX;
          moved = true;
        } else if (
          mob.isGrounded &&
          canMoveTo(nextX, mob.position.z, mob.position.y + 1)
        ) {
          mob.velocity.y = 7;
          mob.isGrounded = false;
          moved = true;
        }

        // Try sliding Z
        if (!moved && canMoveTo(mob.position.x, nextZ, mob.position.y)) {
          mob.position.z = nextZ;
          moved = true;
        } else if (
          !moved &&
          mob.isGrounded &&
          canMoveTo(mob.position.x, nextZ, mob.position.y + 1)
        ) {
          mob.velocity.y = 7;
          mob.isGrounded = false;
          moved = true;
        }
      }

      if (!moved) {
        mob.stuckTimer = (mob.stuckTimer || 0) + delta;
        if (mob.stuckTimer > 0.3 && isHostile) {
          // We are stuck. Move perpendicular to the player temporarily (Wall sliding / whisker approach)
          mob.stuckAngle =
            Math.atan2(wishDirZ, wishDirX) +
            (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
          mob.stuckTimer = -0.5; // Walk this direction for 0.5 seconds
        } else if (!isHostile && mob.fleeTimer <= 0) {
          mob.wanderTimer = 0;
        }
      } else if (mob.stuckTimer > 0) {
        mob.stuckTimer = 0;
      }

      // Vertical movement and ground collision
      mob.position.y += mob.velocity.y * delta;

      const blockBelow = fastGetBlock(
        mob.position.x,
        mob.position.y - 0.05,
        mob.position.z,
      );
      const legBlock = fastGetBlock(
        mob.position.x,
        mob.position.y + 0.5,
        mob.position.z,
      );

      if (legBlock === BLOCK.LAVA || blockBelow === BLOCK.LAVA) {
        mob.health -= 25 * delta;
        if (mob.health <= 0) {
          const mx = mob.position.x;
          const mz = mob.position.z;
          if (mob.type === "Morvane" && mob.team) {
            morvaneDead[mob.team] = true;
            handleMorvaneDeath(mob.team);
            ioNamespace.emit("mobDespawned", id);
          } else {
            broadcastToNearby("mobDespawned", id, mx, mz, 22500, null);
          }
          delete mobs[id];
          mobBuffers.delete(id);
          continue;
        }
      }

      if (isSolidBlock(blockBelow) && mob.velocity.y <= 0) {
        mob.position.y = Math.floor(mob.position.y - 0.05) + 1;
        mob.velocity.y = 0;
        mob.isGrounded = true;
      } else {
        mob.isGrounded = false;
      }

      // Despawn if fell into void
      if (mob.position.y < -60) {
        const mx = mob.position.x;
        const mz = mob.position.z;
        if (mob.type === "Morvane" && mob.team) {
          morvaneDead[mob.team] = true;
          handleMorvaneDeath(mob.team);
          ioNamespace.emit("mobDespawned", id);
        } else {
          broadcastToNearby("mobDespawned", id, mx, mz, 22500, null);
        }
        delete mobs[id];
        mobBuffers.delete(id);
        continue;
      }
    }

    if (Object.keys(mobs).length > 0) {
      let numPackedMobs = 0;
      const packedMobs: Record<string, Buffer> = {};
      for (const id in mobs) {
        const m = mobs[id];
        if (
          m.type === "Morvane" ||
          Math.abs((m.lastX || 0) - m.position.x) > 0.05 ||
          Math.abs((m.lastY || 0) - m.position.y) > 0.05 ||
          Math.abs((m.lastZ || 0) - m.position.z) > 0.05 ||
          m.lastHealth !== m.health
        ) {
          let buf = mobBuffers.get(id);
          if (!buf) {
            buf = Buffer.allocUnsafe(4 * 4);
            mobBuffers.set(id, buf);
          }
          const arr = new Float32Array(buf.buffer, buf.byteOffset, 4);
          arr[0] = m.position.x;
          arr[1] = m.position.y;
          arr[2] = m.position.z;
          arr[3] = m.health || 0;
          packedMobs[id] = buf;
          m.lastX = m.position.x;
          m.lastY = m.position.y;
          m.lastZ = m.position.z;
          m.lastHealth = m.health;
          numPackedMobs++;
        }
      }
      if (numPackedMobs > 0) {
        // Spatial broadcast for packed mobs via socket.io rooms
        const mobUpdatesByGrid = new Map<number, Record<string, Buffer>>();
        const globalMobUpdates: Record<string, Buffer> = {};

        for (const id in packedMobs) {
          const m = mobs[id];
          if (!m) continue;

          if (m.type === "Morvane") {
            globalMobUpdates[id] = packedMobs[id];
          } else {
            const mcx = Math.floor(m.position.x / PLAYER_CELL_SIZE);
            const mcz = Math.floor(m.position.z / PLAYER_CELL_SIZE);
            const key = getCellKey(mcx, mcz);
            let cellUpdates = mobUpdatesByGrid.get(key);
            if (!cellUpdates) {
              cellUpdates = {};
              mobUpdatesByGrid.set(key, cellUpdates);
            }
            cellUpdates[id] = packedMobs[id];
          }
        }

        if (Object.keys(globalMobUpdates).length > 0) {
          ioNamespace.volatile.emit("mobsUpdate", globalMobUpdates);
        }

        for (const [key, cellUpdates] of mobUpdatesByGrid.entries()) {
          ioNamespace
            .to(`grid_${key}`)
            .volatile.emit("mobsUpdate", cellUpdates);
        }
      }
    }

    if (isSkyCastlesMode && hasPlayersForReset) {
      let blueHp = 0,
        blueMax = 5000,
        redHp = 0,
        redMax = 5000;
        
      let redPlayersCount = 0;
      let bluePlayersCount = 0;
      for (const id in players) {
        if (players[id].team === "red") redPlayersCount++;
        if (players[id].team === "blue") bluePlayersCount++;
      }

      for (const mId in mobs) {
        const m = mobs[mId];
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

      const timeToRestart = resetCountdown
        ? Math.max(0, Math.floor((resetCountdown - now) / 1000))
        : 0;
      const syncData = {
        redHp,
        redMax,
        blueHp,
        blueMax,
        gameState,
        timeToRestart,
        redPlayers: redPlayersCount,
        bluePlayers: bluePlayersCount
      };
      const syncStr = JSON.stringify(syncData);
      if (syncStr !== lastSkyCastlesSyncJSON) {
        lastSkyCastlesSyncJSON = syncStr;
        ioNamespace.emit("skyCastlesSync", syncData);
      }
    }

    // Update dayTime
    dayTime = (dayTime + delta * dayCycleSpeed) % 1;

    // Minion production
    for (const id in minions) {
      const minion = minions[id];
      if (now - minion.lastActionTime > 10000) {
        // 10 seconds
        if (minion.storage < minion.maxStorage) {
          minion.storage++;
          minion.lastActionTime = now;
          ioNamespace.emit("minionUpdate", { id, storage: minion.storage });
        }
      }
    }
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
  let spawnInterval = 1000;
  let spawnTimeout: NodeJS.Timeout | null = null;

  const spawnMobsTick = () => {
    if (isDestroyed) return;
    const isDay = Math.sin(dayTime * Math.PI * 2) > 0;
    spawnInterval = isDay ? 1000 : 500; // Double spawn rate at night
    spawnTimeout = setTimeout(spawnMobsTick, spawnInterval);

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
  setTimeout(spawnMobsTick, spawnInterval);

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
  let isDestroyed = false;

  return {
    destroy: () => {
      isDestroyed = true;
      if (spawnTimeout) clearTimeout(spawnTimeout);
      intervals.forEach(clearInterval);
      ioNamespace.removeAllListeners();
      console.log(`Destroyed instance ${mode.name}`);
    },
    isDestroyed: () => isDestroyed,
    tick,
    slowTick,
  };
}
