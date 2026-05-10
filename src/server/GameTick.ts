
import { GameContext } from "./GameContext";
import { BLOCK, isSolidBlock } from "./constants";

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
    for (const _ in players) {
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
    if (isSkyCastlesMode && now - state.gameStartTime >= 20 * 60 * 1000) {
      if (now - state.lastOvertimeDamageTick >= 1000) {
        state.lastOvertimeDamageTick = now;
        
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

      const timeToRestart = state.resetCountdown
        ? Math.max(0, Math.floor((state.resetCountdown - now) / 1000))
        : 0;
      const syncData = {
        redHp,
        redMax,
        blueHp,
        blueMax,
        gameState: state.gameState,
        timeToRestart,
        redPlayers: redPlayersCount,
        bluePlayers: bluePlayersCount
      };
      const syncStr = JSON.stringify(syncData);
      if (syncStr !== state.lastSkyCastlesSyncJSON) {
        state.lastSkyCastlesSyncJSON = syncStr;
        ioNamespace.emit("skyCastlesSync", syncData);
      }
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
          ioNamespace.emit("minionUpdate", { id, storage: minion.storage });
        }
      }
    }
  
}
