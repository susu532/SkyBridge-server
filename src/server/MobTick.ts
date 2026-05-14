import { GameContext } from './GameContext';
import { isSolidBlock, isWaterBlock, BLOCK } from './constants';
import { MobTypes } from '../game/Constants';

const hoistedUpdatesByGrid = new Map<number, Record<string, Float32Array>>();

export function tickMobs(ctx: GameContext, delta: number, now: number, fastGetBlock: (x: number, y: number, z: number) => number) {
  const {
      ioNamespace, chunkManager, worldName, isSkyCastlesMode, isHubMode,
      bakedBlocks, npcs, players, mobs, minions, droppedItems, morvaneDead,
      pendingPlayerUpdates, pendingHits, pendingMobHits, pendingRespawns,
      state, dayCycleSpeed, CELL_SIZE, PLAYER_CELL_SIZE, hostileMobTypes,
      mode, db, getCellKey, broadcastToNearby, spawnMob, 
      isIndestructible, getBlockAt, resetRoom, handleMorvaneDeath,
      playerBuffers, mobBuffers, spatialHash, playerHash
  } = ctx;

  hoistedUpdatesByGrid.clear();
  let movedCount = 0;

  for (const mId in mobs) {
    const mob = mobs[mId];
    if (mob.health <= 0) continue;

    const isMorvane = mob.type === MobTypes.MORVANE;

    // Very simple dummy logic: gravity
    if (!isMorvane && mob.position.y > -20) {
      const bx = Math.floor(mob.position.x);
      const by = Math.floor(mob.position.y - 0.1);
      const bz = Math.floor(mob.position.z);
      if (!isSolidBlock(fastGetBlock(bx, by, bz))) {
         mob.velocity.y -= 0.05; // gravity
      } else {
         mob.velocity.y = 0;
         mob.position.y = by + 1; // stand on block
      }
    }

    if (!isMorvane && (mob.velocity.x !== 0 || mob.velocity.y !== 0 || mob.velocity.z !== 0 || mob.targetId)) {
       mob.position.x += mob.velocity.x;
       mob.position.y += mob.velocity.y;
       mob.position.z += mob.velocity.z;

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
    for (const pId in players) {
      const p = players[pId];
      if (!p) continue;
      const pcx = Math.floor(p.position.x / PLAYER_CELL_SIZE);
      const pcz = Math.floor(p.position.z / PLAYER_CELL_SIZE);
      
      let totalCount = 0;
      let totalIdStrLen = 0;
      
      const cellKeysToCheck = [
          getCellKey(pcx, pcz),
          getCellKey(pcx - 1, pcz), getCellKey(pcx + 1, pcz),
          getCellKey(pcx, pcz - 1), getCellKey(pcx, pcz + 1),
          getCellKey(pcx - 1, pcz - 1), getCellKey(pcx + 1, pcz - 1),
          getCellKey(pcx - 1, pcz + 1), getCellKey(pcx + 1, pcz + 1),
      ];

      for (const key of cellKeysToCheck) {
          const cellUpdates = hoistedUpdatesByGrid.get(key);
          if (cellUpdates) {
             for (const mId in cellUpdates) {
                 totalCount++;
                 totalIdStrLen += Buffer.byteLength(mId, 'utf8');
             }
          }
      }
      
      if (totalCount > 0) {
         const size = 2 + (totalCount * 1) + totalIdStrLen + (totalCount * 4 * 4) + (totalCount * 4);
         const buf = Buffer.allocUnsafe(size);
         let offset = 0;
         buf.writeUInt16LE(totalCount, offset); offset += 2;
         
         for (const key of cellKeysToCheck) {
            const cellUpdates = hoistedUpdatesByGrid.get(key);
            if (cellUpdates) {
               for (const mId in cellUpdates) {
                  const idLen = Buffer.byteLength(mId, 'utf8');
                  buf.writeUInt8(idLen, offset); offset++;
                  buf.write(mId, offset, idLen, 'utf8'); offset += idLen;
                  
                  let floatOffset = offset;
                  if (floatOffset % 4 !== 0) {
                      const padding = 4 - (floatOffset % 4);
                      buf.fill(0, floatOffset, floatOffset + padding);
                      floatOffset += padding;
                  }
                  offset = floatOffset;
                  
                  const floats = cellUpdates[mId];
                  for (let f = 0; f < 4; f++) {
                      buf.writeFloatLE(floats[f], offset);
                      offset += 4;
                  }
               }
            }
         }
         const sock = ioNamespace.sockets.get(pId);
         if (sock) sock.volatile.emit("mobsUpdateB", buf.subarray(0, offset));
      }
    }
  }
}

