import { GameContext } from './GameContext';
import { isSolidBlock, isWaterBlock, BLOCK } from './constants';
import { MobTypes } from '../game/Constants';
import { encodePacket } from './WSHelpers';

const hoistedUpdatesByGrid = new Map<number, Record<string, Float32Array>>();

let localMobTickCounter = 0;

export function tickMobs(ctx: GameContext, delta: number, now: number, fastGetBlock: (x: number, y: number, z: number) => number) {
  localMobTickCounter++;
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, playerBuffers, 
      mobBuffers, spatialHash, playerHash
  } = ctx;

  hoistedUpdatesByGrid.clear();
  let movedCount = 0;

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

  const steerSafe = (mobPos: { x: number, y: number, z: number }, desiredX: number, desiredZ: number, testDist: number = 1.5): { x: number, z: number } => {
    if (desiredX === 0 && desiredZ === 0) return { x: 0, z: 0 };
    const mag = Math.sqrt(desiredX * desiredX + desiredZ * desiredZ);
    const ux = desiredX / mag;
    const uz = desiredZ / mag;
    
    const targetX = mobPos.x + ux * testDist;
    const targetZ = mobPos.z + uz * testDist;
    const targetBy = Math.floor(mobPos.y);
    
    if (isColumnLava(Math.floor(targetX), targetBy, Math.floor(targetZ)) ||
        isColumnLava(Math.floor(mobPos.x + desiredX), targetBy, Math.floor(mobPos.z + desiredZ))) {
      const angles = [-0.785, 0.785, -1.57, 1.57, -2.35, 2.35];
      for (const angle of angles) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rx = ux * cos - uz * sin;
        const rz = ux * sin + uz * cos;
        const testX = mobPos.x + rx * testDist;
        const testZ = mobPos.z + rz * testDist;
        if (!isColumnLava(Math.floor(testX), targetBy, Math.floor(testZ)) &&
            !isColumnLava(Math.floor(mobPos.x + rx * mag), targetBy, Math.floor(mobPos.z + rz * mag))) {
          return { x: rx * mag, z: rz * mag };
        }
      }
      return { x: 0, z: 0 }; // No safe direction, stop completely
    }
    return { x: desiredX, z: desiredZ };
  };

  for (const mId in mobs) {
    const mob = mobs[mId];
    if (mob.health <= 0) continue;

    const isMorvane = mob.type === MobTypes.MORVANE;

    if (mob.knockbackTimer && mob.knockbackTimer > 0) {
      mob.knockbackTimer -= delta;
    }

    const isKnockedBack = (mob.knockbackTimer || 0) > 0;

    const checkLineOfSight = (p1: any, p2: any) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y; 
        const dz = p2.z - p1.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist === 0) return true;
        
        const steps = Math.floor(dist * 2); 
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = p1.x + dx * t;
            const y = p1.y + 1.0 + dy * t; 
            const z = p1.z + dz * t;
            if (isSolidBlock(fastGetBlock(Math.floor(x), Math.floor(y), Math.floor(z)))) {
                return false;
            }
        }
        return true;
    };

    // AI Logic for Dungeon Delver bots
    if (mode.name.startsWith('/dungeondelver') && !isMorvane && !isKnockedBack) {
      const mobOffset = (mob.id.charCodeAt(0) || 0) + (mob.id.charCodeAt(mob.id.length - 1) || 0);
      // Find closest player occasionally to set target
      if ((localMobTickCounter + mobOffset) % 15 === 0 || !mob.targetId) {
        let closestDist = 2000;
        let closestPlayerId = null;
        for (const pId in players) {
          const p = players[pId];
          if (p.health > 0) {
            const dx = p.position.x - mob.position.x;
            const dy = p.position.y - mob.position.y;
            const dz = p.position.z - mob.position.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq < closestDist) {
              closestDist = distSq;
              closestPlayerId = pId;
            }
          }
        }
        if (closestPlayerId && checkLineOfSight(mob.position, players[closestPlayerId].position)) {
          mob.targetId = closestPlayerId;
        } else {
          mob.targetId = undefined;
        }
      }

      if (mob.targetId && players[mob.targetId]) {
        const target = players[mob.targetId];
        if ((localMobTickCounter + mobOffset + 7) % 15 === 0 && !checkLineOfSight(mob.position, target.position)) {
            mob.targetId = undefined;
            continue;
        }

        const dx = target.position.x - mob.position.x;
        const dy = target.position.y - mob.position.y;
        const dz = target.position.z - mob.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const dist3D = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Base speed calculation
        const speed = (0.05 + ((mob.level || 1) * 0.005)) * 1.5;
        const isLowHealth = mob.health < ((mob.level || 1) * 10 + 20) * 0.3; // Roughly < 30% hp

        if (dist > 2.8) {
          if (isLowHealth && dist < 10) {
            // Retreat behavior like a player running away
            mob.velocity.x -= (dx / dist) * speed * 1.2;
            mob.velocity.z -= (dz / dist) * speed * 1.2;
            
            // Randomly jump while running away
            if (Math.random() < 0.1 && Math.abs(mob.velocity.y) < 0.1) {
              mob.velocity.y = 0.45;
            }
          } else if (dist < 8) {
            // Combat strafing / circling behavior
            const time = Date.now();
            const seed = (mId.charCodeAt(0) || 0) + (mId.charCodeAt(mId.length - 1) || 0);
            
            // Change strafe direction every few seconds
            const strafePhase = Math.sin((time + seed * 1000) / 600);
            const isAggressive = Math.cos((time + seed * 500) / 1000) > 0;
            
            const nx = -dz / dist;
            const nz = dx / dist;
            
            let forwardWeight = isAggressive ? 1.2 : 0.6; // Push forward or hover back
            let strafeWeight = 1.0;
            
            // If they are somewhat far, push forward more. If close, circle more.
            if (dist > 5) {
              forwardWeight = 1.5;
              strafeWeight = 0.5;
            }

            mob.velocity.x += ((dx / dist) * forwardWeight + nx * strafePhase * strafeWeight) * speed;
            mob.velocity.z += ((dz / dist) * forwardWeight + nz * strafePhase * strafeWeight) * speed;

            // Jump-hit PvP behavior
            if (dist < 4 && Math.random() < 0.08 && Math.abs(mob.velocity.y) < 0.1) {
              mob.velocity.y = 0.5;
            }
          } else {
            // Chase logic from far away
            mob.velocity.x += (dx / dist) * speed;
            mob.velocity.z += (dz / dist) * speed;

            // Sprint jumping to catch up
            if (Math.random() < 0.05 && Math.abs(mob.velocity.y) < 0.1) {
               mob.velocity.y = 0.4;
               mob.velocity.x *= 1.2;
               mob.velocity.z *= 1.2;
            }
          }
        } else {
            // Very close, barely move to stay on target
            mob.velocity.x += (dx / dist) * speed * 0.5;
            mob.velocity.z += (dz / dist) * speed * 0.5;
        }

        if (dist3D <= 3.5 && Math.random() < 0.25) { // Increased hit chance
          // Attack player
          const targetDefense = target.defense || 0;
          const reduction = targetDefense / (targetDefense + 100);
          let rawDamage = 5 + (mob.level || 0);
          let actualDamage = rawDamage * (1 - reduction);
          if (target.isBlocking) actualDamage *= 0.5;

          target.health -= actualDamage;
          target.lastDamageTime = Date.now();
          
          if (target.health <= 0) {
             target.health = 0;
             if (!target.isDead) {
               target.isDead = true;
               target.deaths = (target.deaths || 0) + 1;
               broadcastToNearby("playerDied", { id: target.id }, target.position.x, target.position.z, 22500, null);
             }
          } else {
             // Knockback player
             target.velocity = target.velocity || {x:0, y:0, z:0};
             target.velocity.x += (dx / dist) * 0.5;
             target.velocity.z += (dz / dist) * 0.5;
             target.velocity.y += 1.6;
          }
          pendingPlayerUpdates.add(mob.targetId);
          pendingHits.push({ 
            id: mob.targetId, 
            damage: actualDamage, 
            knockbackDir: { x: (dx/dist)*8, y:14.0, z: (dz/dist)*8 },
            attackerId: mId,
             position: { x: target.position.x, z: target.position.z }
          });
          
          // Self knockback for visual impact, simulating sword knockback
          mob.velocity.x -= (dx / dist) * 0.3;
          mob.velocity.z -= (dz / dist) * 0.3;
          
          // Often jump when attacking like a crit in Minecraft
          if (Math.random() < 0.5 && Math.abs(mob.velocity.y) < 0.1) {
            mob.velocity.y = 0.4;
          }
        }
      }
    }

    const bx = Math.floor(mob.position.x);
    const by = Math.floor(mob.position.y - 0.1);
    const bz = Math.floor(mob.position.z);

    const currentBlock = fastGetBlock(bx, Math.floor(mob.position.y), bz);
    const isCurrentlyInLava = (currentBlock === BLOCK.LAVA) || (fastGetBlock(bx, Math.floor(mob.position.y + 0.5), bz) === BLOCK.LAVA);
    const inLavaColumn = isColumnLava(bx, Math.floor(mob.position.y), bz);

    // Dynamic Steering Override: Prevent bots from running onto lava (if they are not already in it!)
    if (!isMorvane && !isKnockedBack && !inLavaColumn && (mob.velocity.x !== 0 || mob.velocity.z !== 0)) {
      const mobOffset = (mob.id.charCodeAt(0) || 0) + (mob.id.charCodeAt(mob.id.length - 1) || 0);
      if ((localMobTickCounter + mobOffset) % 10 === 0 || !(mob as any).steeredDir) {
          const steered = steerSafe(mob.position, mob.velocity.x, mob.velocity.z);
          const sMag = Math.sqrt(steered.x * steered.x + steered.z * steered.z);
          if (sMag > 0.001) {
              (mob as any).steeredDir = { x: steered.x / sMag, z: steered.z / sMag };
          } else {
              (mob as any).steeredDir = { x: 0, z: 0 };
          }
      }
      if ((mob as any).steeredDir) {
          const mag = Math.sqrt(mob.velocity.x * mob.velocity.x + mob.velocity.z * mob.velocity.z);
          mob.velocity.x = (mob as any).steeredDir.x * mag;
          mob.velocity.z = (mob as any).steeredDir.z * mag;
      }
    }

    // Very simple dummy logic: gravity and aquatic buoyancy
    if (!isMorvane && mob.position.y <= -20) {
       mob.health = 0;
       // Die instantly
    } else if (!isMorvane && mob.position.y > -20) {
      const frontBx = Math.floor(mob.position.x + Math.sign(mob.velocity.x) * 0.8);
      const frontBz = Math.floor(mob.position.z + Math.sign(mob.velocity.z) * 0.8);

      const blkBelow = fastGetBlock(bx, by, bz);
      
      if (isCurrentlyInLava) {
         // Liquid buoyancy & swimming mechanics for lava
         if (mob.velocity.y < 0) {
           mob.velocity.y *= 0.5; // Dampen fall in liquid
         }
         // Lift upwards to float/swim
         mob.velocity.y += 0.03;
         if (mob.velocity.y > 0.15) {
           mob.velocity.y = 0.15;
         }

         // Lookahead mini-jump to climb onto solid shore blocks
         const checkDist = 0.6; // closer lookahead for shore climbing
         const frontBxShore = Math.floor(mob.position.x + Math.sign(mob.velocity.x || (Math.random() - 0.5)) * checkDist);
         const frontBzShore = Math.floor(mob.position.z + Math.sign(mob.velocity.z || (Math.random() - 0.5)) * checkDist);
         const frontByShore = Math.floor(mob.position.y);
         const blockInFrontShore = fastGetBlock(frontBxShore, frontByShore, frontBzShore);
         const blockInFrontUpShore = fastGetBlock(frontBxShore, frontByShore + 1, frontBzShore);
         if (isSolidBlock(blockInFrontShore) || isSolidBlock(blockInFrontUpShore)) {
           mob.velocity.y = 0.35; // Jump boost to climb out of the pool!
         }
      } else if (!isSolidBlock(blkBelow)) {
         if (mob.velocity.y === 0 && Math.abs(mob.position.y - Math.round(mob.position.y)) < 0.05 && isSolidBlock(fastGetBlock(bx, by - 1, bz))) {
            mob.position.y = by; // Step down 1 block seamlessly
            mob.velocity.y = 0;
         } else {
            mob.velocity.y -= 0.05; // gravity
         }
      } else if (mob.velocity.y <= 0) {
         mob.velocity.y = 0;
         mob.position.y = by + 1; // stand on block
         
         // Jump if obstacle in front or trying to climb
         if (Math.abs(mob.velocity.x) > 0.01 || Math.abs(mob.velocity.z) > 0.01) {
           const blockInFront1 = fastGetBlock(frontBx, by + 1, frontBz);
           const blockInFront2 = fastGetBlock(frontBx, by + 2, frontBz);
           
           const isObstacle1 = isSolidBlock(blockInFront1);
           const isObstacle2 = isSolidBlock(blockInFront2);

           if (isObstacle1 && !isObstacle2) {
             mob.velocity.y = 0.5; // jump up 1 block
           } else if (!isObstacle1) {
             // Block in front is a gap/air, potentially jump if targeted
             if (mob.targetId && Math.random() < 0.3) {
               // Only jump if there is no danger of landing in/on lava
               if (!isColumnLava(frontBx, by, frontBz)) {
                 mob.velocity.y = 0.6; // jump over gap
                 mob.velocity.x *= 1.5;
                 mob.velocity.z *= 1.5;
               }
             }
           }
         }
      }
      
      if (mode.name.startsWith('/dungeondelver')) {
        if (mob.position.y < 0) {
          mob.position.y = 1;
          mob.velocity.y = 0;
        }
        if (mob.position.y > 6) {
          mob.position.y = 5;
          mob.velocity.y = 0;
        }
      }
    }

    if (!isMorvane && (mob.velocity.x !== 0 || mob.velocity.y !== 0 || mob.velocity.z !== 0 || mob.targetId)) {
       const nBy = Math.floor(mob.position.y);
       const isWallOrLava = (bx: number, by: number, bz: number) => {
         const blk = fastGetBlock(bx, by, bz);
         if (isSolidBlock(blk)) return true;
         if (blk === BLOCK.LAVA) {
           const currentInLavaColumn = isColumnLava(Math.floor(mob.position.x), nBy, Math.floor(mob.position.z));
           if (!currentInLavaColumn) return true;
         }
         // Prevent stepping onto/above any block in a lava column
         if (isColumnLava(bx, by, bz)) {
           const currentInLavaColumn = isColumnLava(Math.floor(mob.position.x), nBy, Math.floor(mob.position.z));
           if (!currentInLavaColumn) return true;
         }
         return false;
       };
       
       const radius = 0.3;

       let nextX = mob.position.x + mob.velocity.x * 0.05;
       const edgeX = nextX + (mob.velocity.x > 0 ? radius : -radius);
       const minZ = Math.floor(mob.position.z - radius);
       const maxZ = Math.floor(mob.position.z + radius);
       
       let hitX = isWallOrLava(Math.floor(edgeX), nBy, minZ) || 
                  isWallOrLava(Math.floor(edgeX), nBy + 1, minZ) ||
                  isWallOrLava(Math.floor(edgeX), nBy, maxZ) || 
                  isWallOrLava(Math.floor(edgeX), nBy + 1, maxZ);
       
       let nextZ = mob.position.z + mob.velocity.z * 0.05;
       const edgeZ = nextZ + (mob.velocity.z > 0 ? radius : -radius);
       const minX = Math.floor(mob.position.x - radius);
       const maxX = Math.floor(mob.position.x + radius);

       let hitZ = isWallOrLava(minX, nBy, Math.floor(edgeZ)) || 
                  isWallOrLava(minX, nBy + 1, Math.floor(edgeZ)) ||
                  isWallOrLava(maxX, nBy, Math.floor(edgeZ)) || 
                  isWallOrLava(maxX, nBy + 1, Math.floor(edgeZ));

       if (!hitX && !hitZ) {
          const hitCorner = isWallOrLava(Math.floor(edgeX), nBy, Math.floor(edgeZ)) ||
                            isWallOrLava(Math.floor(edgeX), nBy + 1, Math.floor(edgeZ));
          if (hitCorner) {
             if (Math.abs(mob.velocity.x) > Math.abs(mob.velocity.z)) {
                 hitX = true;
             } else {
                 hitZ = true;
             }
          }
       }

       let stepUpY = 0;
       
       if ((hitX || hitZ) && mob.velocity.y <= 0) {
           const currentHeadClear = !isWallOrLava(Math.floor(mob.position.x), nBy + 2, Math.floor(mob.position.z));
           
           if (currentHeadClear) {
              let canStepX = false;
              let canStepZ = false;
              
              if (hitX) {
                 canStepX = !isWallOrLava(Math.floor(edgeX), nBy + 1, minZ) &&
                            !isWallOrLava(Math.floor(edgeX), nBy + 2, minZ) &&
                            !isWallOrLava(Math.floor(edgeX), nBy + 1, maxZ) &&
                            !isWallOrLava(Math.floor(edgeX), nBy + 2, maxZ);
              }
              
              if (hitZ) {
                 canStepZ = !isWallOrLava(minX, nBy + 1, Math.floor(edgeZ)) &&
                            !isWallOrLava(minX, nBy + 2, Math.floor(edgeZ)) &&
                            !isWallOrLava(maxX, nBy + 1, Math.floor(edgeZ)) &&
                            !isWallOrLava(maxX, nBy + 2, Math.floor(edgeZ));
              }

              if (hitX && hitZ) {
                 if (canStepX && canStepZ) {
                     const cornerClear = !isWallOrLava(Math.floor(edgeX), nBy + 1, Math.floor(edgeZ)) &&
                                         !isWallOrLava(Math.floor(edgeX), nBy + 2, Math.floor(edgeZ));
                     if (cornerClear) {
                         stepUpY = 1.05;
                         hitX = false;
                         hitZ = false;
                     } else {
                         if (Math.abs(mob.velocity.x) > Math.abs(mob.velocity.z)) { hitX = false; stepUpY = 1.05; }
                         else { hitZ = false; stepUpY = 1.05; }
                     }
                 } else if (canStepX) {
                     hitX = false;
                     stepUpY = 1.05;
                 } else if (canStepZ) {
                     hitZ = false;
                     stepUpY = 1.05;
                 }
              } else if (hitX && canStepX) {
                 hitX = false;
                 stepUpY = 1.05;
              } else if (hitZ && canStepZ) {
                 hitZ = false;
                 stepUpY = 1.05;
              }
           }
       }

       const isStuck = isWallOrLava(Math.floor(mob.position.x), nBy, Math.floor(mob.position.z));

       if (isStuck) {
           mob.position.y += 0.5;
       }
       
       if (stepUpY > 0) {
           mob.position.y += stepUpY;
       }

       if (!hitX) {
         mob.position.x = nextX;
       } else if (Math.abs(mob.velocity.x) > 2) {
         mob.velocity.x *= -0.2; // Bounce off if knocked back fast
       }

       if (!hitZ) {
         mob.position.z = nextZ;
       } else if (Math.abs(mob.velocity.z) > 2) {
         mob.velocity.z *= -0.2;
       }

       mob.position.y += mob.velocity.y * 0.05;

       mob.velocity.x *= 0.8;
       mob.velocity.z *= 0.8;
    }

    // Always broadcast Morvane to ensure health sync, or only when health drops?
    // Actually, sending it if it moved or if it's Morvane and being attacked is better.
    // Let's rely on health changes. Track lastHealth.
    if (!isMorvane && Math.abs(mob.velocity.x) < 0.01) mob.velocity.x = 0;
    if (!isMorvane && Math.abs(mob.velocity.y) < 0.01) mob.velocity.y = 0;
    if (!isMorvane && Math.abs(mob.velocity.z) < 0.01) mob.velocity.z = 0;

    let shouldUpdate = false;
    if (isMorvane) {
       if (mob.health !== mob.lastSyncHealth) {
           shouldUpdate = true;
           mob.lastSyncHealth = mob.health;
       }
    } else if (mob.velocity.x !== 0 || mob.velocity.y !== 0 || mob.velocity.z !== 0 || mob.targetId) {
       shouldUpdate = true;
    }

    if (shouldUpdate) {
       if (!mob.packedData) mob.packedData = new Float32Array(4);
       const packedData = mob.packedData as Float32Array;
       packedData[0] = Math.round(mob.position.x * 100) / 100;
       packedData[1] = Math.round(mob.position.y * 100) / 100;
       packedData[2] = Math.round(mob.position.z * 100) / 100;
       packedData[3] = Math.floor(mob.health || 0);

       const { x, z } = mob.position;
       const gridKey = getCellKey(Math.floor(x / PLAYER_CELL_SIZE), Math.floor(z / PLAYER_CELL_SIZE));
       let cellUpdates = hoistedUpdatesByGrid.get(gridKey);
       if (!cellUpdates) {
         cellUpdates = {};
         hoistedUpdatesByGrid.set(gridKey, cellUpdates);
       }
       cellUpdates[mId] = packedData;
       movedCount++;
    }
  }

  if (movedCount > 0) {
    for (const recipientId in players) {
      const recipient = players[recipientId];
      if (!recipient || recipient.isBot) continue;
      const recipientSocket = ioNamespace.sockets.get(recipientId);
      if (!recipientSocket) continue;

      const pcx = Math.floor(recipient.position.x / PLAYER_CELL_SIZE);
      const pcz = Math.floor(recipient.position.z / PLAYER_CELL_SIZE);

      let nearMobCount = 0;
      let nearMobIdStrLen = 0;
      const nearMobUpdates: { mId: string; packed: Float32Array }[] = [];

      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const gridKey = getCellKey(pcx + dx, pcz + dz);
          const cellUpdates = hoistedUpdatesByGrid.get(gridKey);
          if (cellUpdates) {
            for (const mId in cellUpdates) {
              nearMobUpdates.push({ mId, packed: cellUpdates[mId] });
              nearMobCount++;
              nearMobIdStrLen += Buffer.byteLength(mId, 'utf8');
            }
          }
        }
      }

      if (nearMobCount > 0) {
        const size = 2 + (nearMobCount * 1) + nearMobIdStrLen + (nearMobCount * 4 * 4) + (nearMobCount * 4);
        const localBuf = Buffer.allocUnsafe(size);
        let localOffset = 0;
        localBuf.writeUInt16LE(nearMobCount, localOffset); localOffset += 2;

        for (const update of nearMobUpdates) {
          const idLen = Buffer.byteLength(update.mId, 'utf8');
          localBuf.writeUInt8(idLen, localOffset); localOffset++;
          localBuf.write(update.mId, localOffset, idLen, 'utf8'); localOffset += idLen;

          let floatOffset = localOffset;
          if (floatOffset % 4 !== 0) {
            const padding = 4 - (floatOffset % 4);
            localBuf.fill(0, floatOffset, floatOffset + padding);
            floatOffset += padding;
          }
          localOffset = floatOffset;

          const floats = update.packed;
          for (let f = 0; f < 4; f++) {
            localBuf.writeFloatLE(floats[f], localOffset);
            localOffset += 4;
          }
        }

        const payload = localBuf.subarray(0, localOffset);
        if (recipientSocket.ws && typeof recipientSocket.ws.send === 'function') {
          recipientSocket.ws.send(encodePacket("mobsUpdateB", [payload]));
        } else {
          recipientSocket.emit("mobsUpdateB", payload);
        }
      }
    }
  }
}

