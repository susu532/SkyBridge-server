
import { tickMobs } from "./MobTick";
import { GameContext } from "./GameContext";
import { BLOCK, isSolidBlock, isWaterBlock } from "./constants";

const memBlocks = new Map<number, number>();
const blockKey = (bx: number, by: number, bz: number) => ((bx & 0x7FF) | ((bz & 0x7FF) << 11) | ((by & 0x3FF) << 22));

const hoistedUpdatesByGrid = new Map<number, Record<string, Float32Array>>();
const hoistedHitsByGrid = new Map<number, any[]>();
const hoistedMobHitsByGrid = new Map<number, any[]>();

export function tick(ctx: GameContext, delta: number) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash
  } = ctx;


    const now = Date.now();

    let hasPlayersForReset = false;
    for (const _id in players) {
      hasPlayersForReset = true;
      break;
    }

    if (!hasPlayersForReset) {
      if (state.emptyRoomSince === null) state.emptyRoomSince = now;
      else if (now - state.emptyRoomSince >= 0) {
        if (isSkyCastlesMode && !state.hasBeenReset) {
          resetRoom();
          state.hasBeenReset = true;
        } else if (!isSkyCastlesMode) {
          state.emptyRoomSince = null;
        }
      }
    } else {
      state.emptyRoomSince = null;
      state.hasBeenReset = false;
      if (state.gameState === "endgame") {
        if (!state.hasSetEndgameMessage) {
          state.hasSetEndgameMessage = true;
          ioNamespace.emit("chatMessage", {
            sender: "System",
            message: "Game restarting in 15 seconds...",
          });
        }
        if (state.resetCountdown && now >= state.resetCountdown) {
          resetRoom();
        }
      }
    }

    memBlocks.clear();
    const fastGetBlock = (bx: number, by: number, bz: number) => {
      const cx = Math.floor(bx);
      const cy = Math.floor(by);
      const cz = Math.floor(bz);
      const key = blockKey(cx, cy, cz);
      const cached = memBlocks.get(key);
      if (cached !== undefined) return cached;
      const blk = getBlockAt(cx, cy, cz);
      memBlocks.set(key, blk);
      return blk;
    };

    // Clear spatial hashes instead of reallocating
    for (const cell of spatialHash.values()) cell.length = 0;
    for (const cell of playerHash.values()) cell.length = 0;

    for (const id in mobs) {
      const m = mobs[id];
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
    }

    // Health Regeneration
    let numPlayersRegen = 0;
    for (const id in players) {
      const p = players[id];
      if (p && !p.isDead && p.health < (p.maxHealth || 100)) {
        if (now - (p.lastDamageTime || 0) >= 20000) {
          const healthRegen = ((p.maxHealth || 100) * 0.01 + 1) * delta;
          const oldHealthInt = Math.floor(p.health);
          p.health = Math.min(p.maxHealth || 100, p.health + healthRegen);
          if (Math.floor(p.health) !== oldHealthInt) {
            pendingPlayerUpdates.add(id); // Send updated health to clients sparingly
          }
          numPlayersRegen++;
        }
      }
    }

    // Player updates (Global Broadcast for scalability)
    if (pendingPlayerUpdates.size > 0) {
      let totalCount = 0;
      let totalIdStrLen = 0;

      for (const id of pendingPlayerUpdates) {
        const p = players[id];
        if (p && !p.isDead) {
          totalCount++;
          totalIdStrLen += Buffer.byteLength(id, 'utf8');

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

          if (!p.packedData) p.packedData = new Float32Array(11);
          const packedData = p.packedData as Float32Array;
          packedData[0] = Math.round(p.position.x * 100) / 100;
          packedData[1] = Math.round(p.position.y * 100) / 100;
          packedData[2] = Math.round(p.position.z * 100) / 100;
          packedData[3] = Math.round(p.rotation.x * 100) / 100;
          packedData[4] = Math.round(p.rotation.y * 100) / 100;
          packedData[5] = stateMask;
          packedData[6] = Math.round((p.swingSpeed || 0) * 100) / 100;
          packedData[7] = p.heldItem || 0;
          packedData[8] = p.offHandItem || 0;
          packedData[9] = p.defense || 0;
          packedData[10] = Math.floor(p.health || 0);
        }
      }

      if (totalCount > 0) {
           const size = 2 + (totalCount * 1) + totalIdStrLen + (totalCount * 11 * 4) + (totalCount * 4);
           const buf = Buffer.allocUnsafe(size);
           let offset = 0;
           buf.writeUInt16LE(totalCount, offset); offset += 2;
           
           for (const id of pendingPlayerUpdates) {
             const p = players[id];
             if (p && !p.isDead) {
                const idLen = Buffer.byteLength(id, 'utf8');
                buf.writeUInt8(idLen, offset); offset++;
                buf.write(id, offset, idLen, 'utf8'); offset += idLen;
                
                let floatOffset = offset;
                if (floatOffset % 4 !== 0) {
                    const padding = 4 - (floatOffset % 4);
                    buf.fill(0, floatOffset, floatOffset + padding);
                    floatOffset += padding;
                }
                offset = floatOffset;
                
                const floats = p.packedData as Float32Array;
                for (let f = 0; f < 11; f++) {
                    buf.writeFloatLE(floats[f], offset);
                    offset += 4;
                }
             }
           }
           
           ioNamespace.emit("playersUpdateB", buf.subarray(0, offset));
      }

      pendingPlayerUpdates.clear();
    }

    if (pendingHits.length > 0) {
      ioNamespace.emit("batchedPlayerHits", pendingHits);
      pendingHits.length = 0;
    }
    if (pendingMobHits.length > 0) {
      ioNamespace.emit("batchedMobHits", pendingMobHits);
      pendingMobHits.length = 0;
    }
    if (pendingRespawns.length > 0) {
      for (const data of pendingRespawns) {
        ioNamespace.emit("playerRespawn", data);
      }
      pendingRespawns.length = 0;
    }

    tickMobs(ctx, delta, now, fastGetBlock);

    if (mode.onTick) {
      mode.onTick(ctx, delta, now);
    }

    // Update dayTime
    state.dayTime = (state.dayTime + delta * dayCycleSpeed) % 1;

    // Minion production
    for (const id in minions) {
      const minion = minions[id];
      if (now - minion.lastActionTime > 10000) {
        // 10 seconds
        if (minion.storage < minion.maxStorage) {
          minion.storage++;
          minion.lastActionTime = now;
          broadcastToNearby(
            "minionUpdate",
            { id, storage: minion.storage },
            minion.position.x,
            minion.position.z,
            22500
          );
        }
      }
    }
}
