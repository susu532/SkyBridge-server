import { CHUNK_SIZE, WORLD_Y_OFFSET } from "./constants";

import { chatModerator } from "./ChatModerator";
import { GameContext } from "./GameContext";
// Also need itemsData for combat damage calculation? Let's just require it here.
import itemsData from "../../data/items.json";

export function setupSocketHandlers(ctx: GameContext) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash
  } = ctx;

ctx.ioNamespace.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    if (Object.keys(players).length === 0 && isSkyCastlesMode) {
      state.gameStartTime = Date.now();
    }

    // Send current state to new player
    socket.emit("init", {
      players,
      blockChanges: chunkManager.getBlockChangesDict(),
      droppedItems,
      mobs,
      minions,
      dayTime: state.dayTime,
      gameStartTime: state.gameStartTime, // added
      npcs,
    });
    
    if (state.lastSkyCastlesSyncJSON) {
      socket.emit("skyCastlesSync", JSON.parse(state.lastSkyCastlesSyncJSON));
    }

    // Handle player join
    socket.on("join", (data) => {
      let team = null;

      if (mode.name.startsWith("/skycastles") || mode.name.startsWith("/voidtrail")) {
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

          if (state.gameState === "endgame") {
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
      if (state.gameState === "endgame") return;

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
        if (state.gameState === "endgame") {
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
            (player.isSpectator && state.gameState === "endgame")
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

      if (state.gameState === "endgame") return;

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


}
