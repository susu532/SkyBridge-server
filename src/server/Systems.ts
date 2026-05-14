import { GameContext } from "./GameContext";
import { MobTypes } from "../game/Constants";

export function tickItemDespawn(ctx: GameContext) {
  const { droppedItems, broadcastToNearby } = ctx;
  const now = Date.now();
  const expiryTime = 5 * 60 * 1000; // 5 minutes
  let despawned = 0;

  for (const id in droppedItems) {
    const item = droppedItems[id];
    if (now - item.timestamp > expiryTime) {
      const pos = item.position;
      delete droppedItems[id];
      broadcastToNearby("itemDespawned", id, pos.x, pos.z, 22500, null);
      despawned++;
    }
    if (despawned > 50) break; // Limit despawns per tick
  }
}

export function tickMobDespawn(ctx: GameContext) {
  const { mobs, players, state, broadcastToNearby, mobBuffers } = ctx;
  let hasPlayers = false;

  for (const id in players) {
    hasPlayers = true;
    break;
  }

  const isDay = Math.sin(state.dayTime * Math.PI * 2) > 0;

  if (!hasPlayers) {
    for (const id in mobs) {
      const mob = mobs[id];
      if (mob.type === MobTypes.MORVANE) continue;
      const mx = mob.position.x;
      const mz = mob.position.z;
      
      delete mobs[id];
      ctx.releaseMobToPool(mob);
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
        MobTypes.ZOMBIE,
        MobTypes.CREEPER,
        MobTypes.SKELETON,
        MobTypes.SLIME,
        MobTypes.MORVANE,
      ].includes(mob.type as MobTypes);

      if (
        mob.type !== MobTypes.MORVANE &&
        (Math.sqrt(minPlayerDistSq) > 120 || (isDay && isHostile))
      ) {
        const mx = mob.position.x;
        const mz = mob.position.z;
        
        delete mobs[id];
        ctx.releaseMobToPool(mob);
        mobBuffers.delete(id);
        broadcastToNearby("mobDespawned", id, mx, mz, 22500, null);
      }
    }
  }
}
