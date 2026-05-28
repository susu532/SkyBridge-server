
import { tickMobs } from "./MobTick";
import { GameContext } from "./GameContext";
import { BLOCK, isSolidBlock, isWaterBlock } from "./constants";
import { encodePacket } from "./WSHelpers";

const memBlocks = new Map<number, number>();
const blockKey = (bx: number, by: number, bz: number) => ((bx & 0x7FF) | ((bz & 0x7FF) << 11) | ((by & 0x3FF) << 22));

const hoistedUpdatesByGrid = new Map<number, Record<string, Float32Array>>();
const hoistedHitsByGrid = new Map<number, any[]>();
const hoistedMobHitsByGrid = new Map<number, any[]>();

const SHARED_NETWORK_BUFFER = Buffer.allocUnsafe(1024 * 1024 * 2); // 2 MB buffer pool

let localBotTickCounter = 0;

export function tick(ctx: GameContext, delta: number) {
  localBotTickCounter++;
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems,
      pendingPlayerUpdates, pendingBlockUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, playerBuffers, 
      mobBuffers, spatialHash, playerHash
  } = ctx;


    const now = Date.now();

    let hasPlayersForReset = false;
    let hasHumanPlayers = false;
    for (const id in players) {
      if (!players[id].isBot) {
        hasHumanPlayers = true;
        hasPlayersForReset = true;
      }
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

    if (!hasHumanPlayers) {
      // Keep daylight / cycle ticking correctly
      state.dayTime = (state.dayTime + delta * dayCycleSpeed) % 1;
      
      // Keep clear of any stale structures or updates
      memBlocks.clear();
      pendingPlayerUpdates.clear();
      pendingBlockUpdates.length = 0;
      pendingHits.length = 0;
      pendingMobHits.length = 0;
      pendingRespawns.length = 0;
      return;
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

    const checkLineOfSight = (p1: any, p2: any) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y; // Adjust for eye height
        const dz = p2.z - p1.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist === 0) return true;
        
        const steps = Math.floor(dist * 2); // 0.5 step
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = p1.x + dx * t;
            const y = p1.y + 1.0 + dy * t; // Source from eye height
            const z = p1.z + dz * t;
            if (isSolidBlock(fastGetBlock(Math.floor(x), Math.floor(y), Math.floor(z)))) {
                return false;
            }
        }
        return true;
    };

    const isColumnLava = (bx: number, by: number, bz: number): boolean => {
      const blk = fastGetBlock(bx, by, bz);
      if (blk === BLOCK.LAVA) return true;
      const checkDepthY = Math.max(-20, by - 40);
      for (let y = by; y >= checkDepthY; y--) {
        const tempBlk = fastGetBlock(bx, y, bz);
        if (tempBlk === BLOCK.LAVA) return true;
        if (isSolidBlock(tempBlk)) break;
      }
      return false;
    };

    const hasLavaBetween = (p1: any, p2: any) => {
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist === 0) return false;
      const steps = Math.floor(dist * 2);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = p1.x + dx * t;
        const z = p1.z + dz * t;
        
        const bx = Math.floor(x);
        const bz = Math.floor(z);
        const by1 = Math.floor(p1.y);
        
        let foundLava = false;
        for (let y = by1 - 1; y <= by1 + 1; y++) {
          if (fastGetBlock(bx, y, bz) === BLOCK.LAVA) {
            foundLava = true; break;
          }
        }
        if (foundLava) return true;
        
        let foundGround = false;
        for (let y = by1 + 1; y >= by1 - 5; y--) {
           if (isSolidBlock(fastGetBlock(bx, y, bz))) {
               foundGround = true; break;
           }
        }
        if (!foundGround) return true; // Treating void like lava so they don't jump across empty space
      }
      return false;
    };

    const isSafeDestination = (bx: number, by: number, bz: number) => {
      // Must not be lava
      if (isColumnLava(bx, by, bz)) return false;
      // Must have a solid block underneath within 4 blocks (or we are in dungeondelver where floors are guaranteed mostly except lava)
      let foundGround = false;
      for (let y = by + 1; y >= by - 5; y--) {
         if (isSolidBlock(fastGetBlock(bx, y, bz))) {
             foundGround = true;
             break;
         }
      }
      return foundGround;
    };

    const steerSafe = (botPos: { x: number, y: number, z: number }, desiredX: number, desiredZ: number, testDist: number = 2.0): { x: number, z: number } => {
      if (desiredX === 0 && desiredZ === 0) return { x: 0, z: 0 };
      const mag = Math.sqrt(desiredX * desiredX + desiredZ * desiredZ);
      const ux = desiredX / mag;
      const uz = desiredZ / mag;
      
      const targetX = botPos.x + ux * testDist;
      const targetZ = botPos.z + uz * testDist;
      const targetBy = Math.floor(botPos.y);
      
      if (!isSafeDestination(Math.floor(targetX), targetBy, Math.floor(targetZ)) ||
          !isSafeDestination(Math.floor(botPos.x + desiredX), targetBy, Math.floor(botPos.z + desiredZ))) {
        const angles = [-0.785, 0.785, -1.57, 1.57, -2.35, 2.35, Math.PI];
        for (const angle of angles) {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rx = ux * cos - uz * sin;
          const rz = ux * sin + uz * cos;
          const testX = botPos.x + rx * testDist;
          const testZ = botPos.z + rz * testDist;
          if (isSafeDestination(Math.floor(testX), targetBy, Math.floor(testZ)) &&
              isSafeDestination(Math.floor(botPos.x + rx * mag), targetBy, Math.floor(botPos.z + rz * mag))) {
            return { x: rx * mag, z: rz * mag };
          }
        }
        return { x: 0, z: 0 }; // No safe direction, stop completely
      }
      return { x: desiredX, z: desiredZ };
    };

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
      if (p && p.isBot && !hasHumanPlayers) continue; // Skip bots when no humans are present
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

    // BOT SIMULATION
    if (hasHumanPlayers && (mode.name.startsWith('/dungeondelver') || mode.name.startsWith('/skycastles'))) {
      for (const id in players) {
        const p = players[id];
        if (p && p.isBot) {
          if (p.isSpectator) {
            continue;
          }
          if (!p.velocity) p.velocity = {x: 0, y: 0, z: 0};
          if (p.isDead) {
            // Respawn after ~3 seconds
            if (now - (p.lastDamageTime || 0) > 3000) {
                // If it's SkyCastles and Morvane is dead, they become spectators instead
                if (isSkyCastlesMode && ctx.morvaneDead && p.team && ctx.morvaneDead[p.team]) {
                    p.isDead = false;
                    p.isSpectator = true;
                    ctx.ioNamespace.emit("playerStatus", {
                      id: p.id,
                      isDead: false,
                      isSpectator: true,
                      health: 0,
                    });
                    continue;
                }
                
                p.health = Math.max(100, p.maxHealth || 100);
                p.isDead = false;
                (p as any).lavaStuckSince = null; // Clear stuck timer on respawn
                let pRespawnData = mode.getRespawnPosition(p.id, p, chunkManager, bakedBlocks);
                let retry = 0;
                while (isColumnLava(Math.floor(pRespawnData.x), Math.floor(pRespawnData.y - 0.1), Math.floor(pRespawnData.z)) && retry < 50) {
                    pRespawnData = mode.getRespawnPosition(p.id, p, chunkManager, bakedBlocks);
                    retry++;
                }
                p.position = { x: pRespawnData.x, y: pRespawnData.y, z: pRespawnData.z };
                if (pRespawnData.yaw !== undefined) {
                    if (p.rotation) p.rotation.y = pRespawnData.yaw;
                    else p.rotation = { x: 0, y: pRespawnData.yaw, z: 0 };
                }
                pendingRespawns.push({
                    id: p.id,
                    position: p.position,
                    team: p.team,
                    yaw: pRespawnData.yaw,
                });
            }
            continue; // Skip AI if dead
          }

          // Check if bot is stuck on/in a lava column (either standing directly on or swimming in lava)
          const currentInLavaColumn = isColumnLava(Math.floor(p.position.x), Math.floor(p.position.y - 0.1), Math.floor(p.position.z)) ||
                                     isColumnLava(Math.floor(p.position.x), Math.floor(p.position.y), Math.floor(p.position.z));
          
          if (currentInLavaColumn) {
            const timeout = mode.name.startsWith('/dungeondelver') ? 0 : 5000;
            if (!(p as any).lavaStuckSince) {
              (p as any).lavaStuckSince = now;
            }
            if (now - (p as any).lavaStuckSince >= timeout) {
              // Bot has been stuck in or on top of lava. Kill them!
              p.health = 0;
              p.isDead = true;
              p.lastDamageTime = now;
              (p as any).lavaStuckSince = null;
              
              p.deaths = (p.deaths || 0) + 1;
              ioNamespace.emit("playerStatsUpdate", { 
                id: p.id, 
                kills: p.kills || 0, 
                deaths: p.deaths,
                health: p.health
              });
              ioNamespace.emit("chatMessage", { sender: "System", message: `${p.name} dissolved in lava` });
              broadcastToNearby("playerDied", { id: p.id }, p.position.x, p.position.z, 22500, null);
              pendingPlayerUpdates.add(p.id);
              continue; // Skip the rest of bot AI execution for this tick
            }
          } else {
            (p as any).lavaStuckSince = null;
          }

          // Initialize velocity if missing
          if (!p.velocity) p.velocity = { x: 0, y: 0, z: 0 };
          
          // Find closest target (mob or player not on same team)
          const botOffset = (p.id.charCodeAt(0) || 0) + (p.id.charCodeAt(1) || 0);
          if ((localBotTickCounter + botOffset) % 15 === 0) {
            let closestDist = 1500;
            let closestItem: any = null;
            let closestType: string | null = null;
            const botCellX = Math.floor(p.position.x / PLAYER_CELL_SIZE);
            const botCellZ = Math.floor(p.position.z / PLAYER_CELL_SIZE);

            // Target mobs via spatial hashes instead of global iteration
            for (let dx = -2; dx <= 2; dx++) {
              for (let dz = -2; dz <= 2; dz++) {
                const cellKey = getCellKey(botCellX + dx, botCellZ + dz);
                const cellMobs = spatialHash.get(cellKey);
                if (cellMobs) {
                  for (const m of cellMobs) {
                    if (m.health > 0) {
                      if (m.team && p.team && m.team === p.team) continue;
                      const distSq = (m.position.x - p.position.x)**2 + (m.position.y - p.position.y)**2 + (m.position.z - p.position.z)**2;
                      if (distSq < closestDist) {
                        closestDist = distSq;
                        closestItem = m.id || m.type;
                        closestType = 'mob';
                      }
                    }
                  }
                }
                
                if (mode.allowPvP) {
                  const cellPlayers = playerHash.get(cellKey);
                  if (cellPlayers) {
                    for (const other of cellPlayers) {
                      if (other.id !== id && !other.isDead) {
                        if (other.team && p.team && other.team === p.team) continue;
                        const distSq = (other.position.x - p.position.x)**2 + (other.position.y - p.position.y)**2 + (other.position.z - p.position.z)**2;
                        if (distSq < closestDist) {
                          closestDist = distSq;
                          closestItem = other.id;
                          closestType = 'player';
                        }
                      }
                    }
                  }
                }
              }
            }
            
            if (closestItem && closestType) {
              const cand = closestType === 'player' ? players[closestItem] : mobs[closestItem];
              if (cand && checkLineOfSight(p.position, cand.position) && !hasLavaBetween(p.position, cand.position)) {
                (p as any).targetItem = closestItem;
                (p as any).targetType = closestType;
              } else {
                (p as any).targetItem = null;
                (p as any).targetType = null;
              }
            } else {
              (p as any).targetItem = null;
              (p as any).targetType = null;
            }
          }

          let target: any = null;
          if ((p as any).targetItem) {
            target = (p as any).targetType === 'player' ? players[(p as any).targetItem] : mobs[(p as any).targetItem];
            // Only re-check Line of Sight/Lava occasionally to save CPU, e.g. every 15 ticks
            if (target && target.position) {
              const isTeammate = target.team && p.team && target.team === p.team;
              let isLost = isTeammate;
              if (!isLost && (localBotTickCounter + botOffset + 7) % 15 === 0) {
                 isLost = !checkLineOfSight(p.position, target.position) || hasLavaBetween(p.position, target.position);
              }
              if (isLost) {
                (p as any).targetItem = null;
                target = null;
              }
            }
          }
          
          // Apply gravity
          const bx = Math.floor(p.position.x);
          const by = Math.floor(p.position.y - 0.1);
          const bz = Math.floor(p.position.z);
          
          const blockBelow = getBlockAt(bx, by, bz);
          const onGround = isSolidBlock(blockBelow);
          
          if (!onGround) {
            p.velocity.y -= 1.0; // gravity
          } else if (p.velocity.y <= 0) {
            p.velocity.y = 0;
            p.position.y = by + 1; // stand on ground
            
            // Safe climb/jump logic for bots
            if (p.velocity && (Math.abs(p.velocity.x) > 0.01 || Math.abs(p.velocity.z) > 0.01)) {
              const frontBx = Math.floor(p.position.x + Math.sign(p.velocity.x) * 0.8);
              const frontBz = Math.floor(p.position.z + Math.sign(p.velocity.z) * 0.8);
              const blockInFront1 = fastGetBlock(frontBx, by + 1, frontBz);
              const blockInFront2 = fastGetBlock(frontBx, by + 2, frontBz);
              
              if (isSolidBlock(blockInFront1) && !isSolidBlock(blockInFront2)) {
                const landingX = p.position.x + Math.sign(p.velocity.x) * 1.5;
                const landingZ = p.position.z + Math.sign(p.velocity.z) * 1.5;
                if (!isColumnLava(Math.floor(landingX), by + 1, Math.floor(landingZ))) {
                  p.velocity.y = 6.0; // Jump!
                }
              }
            }
          }
          
          if (mode.name.startsWith('/dungeondelver')) {
            if (p.position.y < 0) {
              p.position.y = 1;
              p.velocity.y = 0;
            }
            if (p.position.y > 6) {
               p.position.y = 5;
               p.velocity.y = 0;
            }
          } else {
            if (p.position.y < -20) {
              p.health = 0; // fall to death
            }
          }

          if (target && target.position) {
            const dx = target.position.x - p.position.x;
            const dz = target.position.z - p.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            p.rotation.y = Math.atan2(dx, dz) + Math.PI; // Look at target
            
            if (dist > 2) {
               const speed = 1.2;
               p.velocity.x -= Math.sin(p.rotation.y) * speed;
               p.velocity.z -= Math.cos(p.rotation.y) * speed;
            } else if (dist <= 3 && Math.random() < 0.2) {
               // Attack!
               if (now - (p.lastAttackTime || 0) > 500) {
                 p.isSwinging = true;
                 p.swingSpeed = 10;
                 pendingPlayerUpdates.add(p.id);
                 p.lastAttackTime = now;
                 if (target.health > 0) {
                   const damage = 15 + (p.level || 0); // bot damage
                   const attackerYaw = p.rotation.y;
                   const kbForce = 8;
                   const knockbackDir = {
                     x: -Math.sin(attackerYaw) * kbForce,
                     y: 0,
                     z: -Math.cos(attackerYaw) * kbForce
                   };
                   
                   p.velocity.x -= Math.sin(attackerYaw) * 0.1;
                   p.velocity.z -= Math.cos(attackerYaw) * 0.1;

                   if ((p as any).targetType === 'mob') { 
                      // is mob
                      target.health -= damage;
                      if (target.health <= 0) {
                        
                        if (mode.onMobDeath) {
                            mode.onMobDeath(ctx, target, p.id);
                        }

                        delete mobs[target.id || target.type];
                        if (target.id) mobBuffers.delete(target.id);
                        broadcastToNearby("mobDespawned", target.id || target.type, target.position.x, target.position.z, 22500);
                      } else {
                        target.velocity.x = knockbackDir.x;
                        target.velocity.z = knockbackDir.z;
                        target.velocity.y = 1.5;
                      }
                      pendingMobHits.push({ 
                        id: target.id || target.type, 
                        damage, 
                        knockbackDir,
                        attackerId: p.id,
                        position: { x: target.position.x, z: target.position.z }
                      });
                   } else {
                      // is player
                      const isInvulnerable = !mode.name.startsWith('/dungeondelver') && now - (target.lastRespawnTime || 0) < 5000;
                       if (!isInvulnerable) {
                      const targetDefense = target.defense || 0;
                      const reduction = targetDefense / (targetDefense + 100);
                      let actualDamage = damage * (1 - reduction);
                      if (target.isBlocking) actualDamage *= 0.5;

                      target.health -= actualDamage;
                      target.lastDamageTime = now;
                      if (target.health <= 0) {
                        target.health = 0;
                        if (!target.isDead) {
                          target.isDead = true;
                          target.deaths = (target.deaths || 0) + 1;
                          p.kills = (p.kills || 0) + 1;
                          
                          p.health = p.maxHealth || 100;

                          ioNamespace.emit("playerStatsUpdate", { 
                            id: p.id, 
                            kills: p.kills, 
                            deaths: p.deaths || 0,
                            health: p.health
                          });
                          ioNamespace.emit("playerStatsUpdate", { 
                            id: target.id, 
                            kills: target.kills || 0, 
                            deaths: target.deaths,
                            health: target.health
                          });

                          // Fake player chat occasionally when they kill a player
                          if (Math.random() < 0.4) {
                             const taunts = ["gg", "nice try", "too easy", "boom!", target.name + " got destroyed", "owned"];
                             const taunt = taunts[Math.floor(Math.random() * taunts.length)];
                             ioNamespace.emit("chatMessage", {
                                sender: p.name,
                                message: taunt,
                                team: p.team
                             });
                          }
                          ioNamespace.emit("chatMessage", { sender: "System", message: `${target.name || 'Unknown'} was slain by ${p.name || 'Unknown'}` });
                          broadcastToNearby("playerDied", { id: target.id }, target.position.x, target.position.z, 22500, null);
                        }
                      } else {
                        const force = Math.max(8.0, Math.sqrt(knockbackDir.x * knockbackDir.x + (knockbackDir.y || 0) * (knockbackDir.y || 0) + knockbackDir.z * knockbackDir.z));
                        const yLift = Math.min(8.0, 5.5 + (force - 8.0) * 0.5);
                        target.velocity.x = knockbackDir.x;
                        target.velocity.z = knockbackDir.z;
                        target.velocity.y = target.isBot ? yLift : (target.velocity.y || 0) + 0.3;
                      }
                      pendingPlayerUpdates.add(target.id); // Sync health
                      pendingHits.push({ 
                        id: target.id, 
                        damage: actualDamage, 
                        knockbackDir, 
                        attackerId: p.id,
                        position: { x: target.position.x, z: target.position.z }
                      });
                   } // end isInvulnerable
}
                 }
                 p.lastBlockTime = now;
               } else if (now - (p.lastAttackTime || 0) > 200 && p.isSwinging) {
                  p.isSwinging = false;
                  p.swingSpeed = 0;
                  pendingPlayerUpdates.add(p.id);
               }
            } else {
               p.isSwinging = false;
               p.swingSpeed = 0;
            }
          } else {
             // roam
             p.isSwinging = false;
             
             // Maintain a roam direction for ~2-3 seconds randomly
             if (!(p as any).roamTimer || (p as any).roamTimer <= 0) {
               (p as any).roamTimer = 30 + Math.random() * 60; // 30-90 ticks
               p.rotation.y += (Math.random() - 0.5) * Math.PI;
             } else {
               (p as any).roamTimer--;
             }

             if (onGround) {
                p.velocity.x -= Math.sin(p.rotation.y) * 1.0;
                p.velocity.z -= Math.cos(p.rotation.y) * 1.0;
             }
          }
          
          // Dynamic Steering Override: Prevent bots from running or falling onto/above lava
          const isKnockedBack = now - (p.lastDamageTime || 0) < 1000;
          if (!isKnockedBack && (p.velocity.x !== 0 || p.velocity.z !== 0)) {
            const botOffset = (p.id.charCodeAt(0) || 0) + (p.id.charCodeAt(1) || 0);
            if ((localBotTickCounter + botOffset) % 10 === 0 || !(p as any).steeredDir) {
                const steered = steerSafe(p.position, p.velocity.x, p.velocity.z);
                const sMag = Math.sqrt(steered.x * steered.x + steered.z * steered.z);
                if (sMag > 0.001) {
                    (p as any).steeredDir = { x: steered.x / sMag, z: steered.z / sMag };
                } else {
                    (p as any).steeredDir = { x: 0, z: 0 };
                }
            }
            if ((p as any).steeredDir) {
                const mag = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.z * p.velocity.z);
                p.velocity.x = (p as any).steeredDir.x * mag;
                p.velocity.z = (p as any).steeredDir.z * mag;
            }
          }
          
          // Apply horizontal friction
          const friction = onGround ? 0.7 : 0.92;
          p.velocity.x *= friction;
          p.velocity.z *= friction;
          
          const dt = 0.05;
          
          if (Math.abs(p.velocity.x) > 0.001) p.position.x += p.velocity.x * dt;
          if (isSolidBlock(getBlockAt(Math.floor(p.position.x), Math.floor(p.position.y), Math.floor(p.position.z)))) {
             p.position.x -= p.velocity.x * dt;
             p.velocity.x = 0;
             (p as any).roamTimer = 0;
          }

          if (Math.abs(p.velocity.y) > 0.001) p.position.y += p.velocity.y * dt;

          if (Math.abs(p.velocity.z) > 0.001) p.position.z += p.velocity.z * dt;
          if (isSolidBlock(getBlockAt(Math.floor(p.position.x), Math.floor(p.position.y), Math.floor(p.position.z)))) {
             p.position.z -= p.velocity.z * dt;
             p.velocity.z = 0;
             (p as any).roamTimer = 0;
          }

          // Always flag for update so clients see bot moving
          if (Math.abs(p.velocity.x) > 0.01 || Math.abs(p.velocity.y) > 0.01 || Math.abs(p.velocity.z) > 0.01) {
            p.isSprinting = Math.sqrt(p.velocity.x*p.velocity.x + p.velocity.z*p.velocity.z) > 0.1;
            pendingPlayerUpdates.add(id);
          }
        }
      }
    }

    // Player updates (Grid-based Broadcast for scalability)
    if (pendingPlayerUpdates.size > 0) {
      // First pack all updated players
      const hoistedPlayerUpdatesByGrid = new Map<number, Record<string, Float32Array>>();
      
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
          if (!mode.name.startsWith('/dungeondelver') && Date.now() - (p.lastRespawnTime || 0) < 5000) stateMask |= 256;

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

          const gridKey = getCellKey(Math.floor(p.position.x / PLAYER_CELL_SIZE), Math.floor(p.position.z / PLAYER_CELL_SIZE));
          let cellUpdates = hoistedPlayerUpdatesByGrid.get(gridKey);
          if (!cellUpdates) {
            cellUpdates = {};
            hoistedPlayerUpdatesByGrid.set(gridKey, cellUpdates);
          }
          cellUpdates[id] = packedData;
        }
      }

      for (const recipientId in players) {
        const recipient = players[recipientId];
        if (!recipient || recipient.isBot) continue;
        const recipientSocket = ioNamespace.sockets.get(recipientId);
        if (!recipientSocket) continue;

        const pcx = Math.floor(recipient.position.x / PLAYER_CELL_SIZE);
        const pcz = Math.floor(recipient.position.z / PLAYER_CELL_SIZE);

        let nearCount = 0;
        let nearIdStrLen = 0;
        const nearUpdates: { id: string; packed: Float32Array }[] = [];

        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const gridKey = getCellKey(pcx + dx, pcz + dz);
            const cellUpdates = hoistedPlayerUpdatesByGrid.get(gridKey);
            if (cellUpdates) {
              for (const id in cellUpdates) {
                nearUpdates.push({ id, packed: cellUpdates[id] });
                nearCount++;
                nearIdStrLen += Buffer.byteLength(id, 'utf8');
              }
            }
          }
        }

        if (nearCount > 0) {
          const size = 2 + (nearCount * 1) + nearIdStrLen + (nearCount * 11 * 4) + (nearCount * 4);
          let localOffset = 0;
          SHARED_NETWORK_BUFFER.writeUInt16LE(nearCount, localOffset); localOffset += 2;

          for (const update of nearUpdates) {
            const idLen = Buffer.byteLength(update.id, 'utf8');
            SHARED_NETWORK_BUFFER.writeUInt8(idLen, localOffset); localOffset++;
            SHARED_NETWORK_BUFFER.write(update.id, localOffset, idLen, 'utf8'); localOffset += idLen;

            let floatOffset = localOffset;
            if (floatOffset % 4 !== 0) {
              const padding = 4 - (floatOffset % 4);
              SHARED_NETWORK_BUFFER.fill(0, floatOffset, floatOffset + padding);
              floatOffset += padding;
            }
            localOffset = floatOffset;

            const floats = update.packed;
            for (let f = 0; f < 11; f++) {
              SHARED_NETWORK_BUFFER.writeFloatLE(floats[f], localOffset);
              localOffset += 4;
            }
          }

          // Must slice the buffer before sending to avoid reading trash, since ws will read the slice byteLength
          const payload = SHARED_NETWORK_BUFFER.subarray(0, localOffset);
          if (recipientSocket.ws && typeof recipientSocket.ws.send === 'function') {
            recipientSocket.ws.send(encodePacket("playersUpdateB", [payload]));
          } else {
            recipientSocket.emit("playersUpdateB", payload);
          }
        }
      }

      pendingPlayerUpdates.clear();
    }

    if (pendingHits.length > 0) {
      hoistedHitsByGrid.clear();
      for (const hit of pendingHits) {
        const gridKey = getCellKey(Math.floor(hit.position.x / PLAYER_CELL_SIZE), Math.floor(hit.position.z / PLAYER_CELL_SIZE));
        let list = hoistedHitsByGrid.get(gridKey);
        if (!list) {
          list = [];
          hoistedHitsByGrid.set(gridKey, list);
        }
        list.push(hit);
      }
    }
    if (pendingMobHits.length > 0) {
      hoistedMobHitsByGrid.clear();
      for (const hit of pendingMobHits) {
        const gridKey = getCellKey(Math.floor(hit.position.x / PLAYER_CELL_SIZE), Math.floor(hit.position.z / PLAYER_CELL_SIZE));
        let list = hoistedMobHitsByGrid.get(gridKey);
        if (!list) {
          list = [];
          hoistedMobHitsByGrid.set(gridKey, list);
        }
        list.push(hit);
      }
    }

    if (pendingHits.length > 0 || pendingMobHits.length > 0) {
      for (const recipientId in players) {
        const recipient = players[recipientId];
        if (!recipient || recipient.isBot) continue;
        const recipientSocket = ioNamespace.sockets.get(recipientId);
        if (!recipientSocket) continue;

        const pcx = Math.floor(recipient.position.x / PLAYER_CELL_SIZE);
        const pcz = Math.floor(recipient.position.z / PLAYER_CELL_SIZE);

        const nearHits: any[] = [];
        const nearMobHits: any[] = [];

        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const gridKey = getCellKey(pcx + dx, pcz + dz);
            
            const cellHits = hoistedHitsByGrid.get(gridKey);
            if (cellHits) {
              for (let i = 0; i < cellHits.length; i++) {
                nearHits.push(cellHits[i]);
              }
            }

            const cellMobHits = hoistedMobHitsByGrid.get(gridKey);
            if (cellMobHits) {
              for (let i = 0; i < cellMobHits.length; i++) {
                nearMobHits.push(cellMobHits[i]);
              }
            }
          }
        }
        
        if (nearHits.length > 0) {
          recipientSocket.emit("batchedPlayerHits", nearHits);
        }
        if (nearMobHits.length > 0) {
          recipientSocket.emit("batchedMobHits", nearMobHits);
        }
      }

      pendingHits.length = 0;
      pendingMobHits.length = 0;
    }
    if (pendingRespawns.length > 0) {
      for (const data of pendingRespawns) {
        ioNamespace.emit("playerRespawn", data);
      }
      pendingRespawns.length = 0;
    }

    if (pendingBlockUpdates.length > 0) {
      const toProcess = Math.min(pendingBlockUpdates.length, 2000);
      const batch = pendingBlockUpdates.splice(0, toProcess);
      for (const b of batch) {
        broadcastToNearby("blockChanged", b.data, b.x, b.z, 22500, b.socketId);
      }
    }

    if (hasHumanPlayers) {
      tickMobs(ctx, delta, now, fastGetBlock);
    }

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
