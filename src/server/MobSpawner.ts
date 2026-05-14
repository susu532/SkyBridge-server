import { GameContext } from "./GameContext";
import { BLOCK, isSolidBlock } from "./constants";
import { isNature } from "../game/TerrainGenerator";
import { MobTypes } from "../game/Constants";

export function spawnMobsTick(ctx: GameContext, loopFn: () => void) {
  const { state, mode, players, mobs, getBlockAt, isSkyCastlesMode, spawnMob } = ctx;

  if (state.isDestroyed) return;
  const isDay = Math.sin(state.dayTime * Math.PI * 2) > 0;
  state.spawnInterval = isDay ? 1000 : 500; // Double spawn rate at night
  state.spawnTimeout = setTimeout(loopFn, state.spawnInterval);

  if (!mode.allowMobSpawns) return;
  const playerIds = Object.keys(players);
  if (playerIds.length === 0) return;

  const maxMobs = Math.min(400, playerIds.length * 6);
  const currentMobs = Object.keys(mobs).length;
  if (currentMobs < maxMobs) {
    // Paced spawning when many players join organically
    const batchSize = Math.max(1, Math.min(3, Math.ceil(playerIds.length / 5)));

    const spawnMemBlocks: Record<string, number> = {};
    const fastSpawnGetBlock = (bx: number, by: number, bz: number) => {
      const cx = Math.floor(bx);
      const cy = Math.floor(by);
      const cz = Math.floor(bz);
      const key = `${cx},${cy},${cz}`;
      if (key in spawnMemBlocks) return spawnMemBlocks[key];
      const blk = getBlockAt(cx, cy, cz) || 0;
      spawnMemBlocks[key] = blk;
      return blk;
    };

    for (let batch = 0; batch < batchSize; batch++) {
      if (Object.keys(mobs).length >= maxMobs) break;
      const randomPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const randomPlayer = players[randomPlayerId];
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      const x = randomPlayer.position.x + Math.cos(angle) * dist;
      const z = randomPlayer.position.z + Math.sin(angle) * dist;

      if (isNature(x, z, isSkyCastlesMode)) {
        let spawnY = -1;
        // Try to find a valid ground near the player's Y level
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
          const validSpace = blockAt === BLOCK.AIR && blockAbove === BLOCK.AIR;

          if (validGround && validSpace) {
            // Valid ground found.
            if (Math.abs(y - randomPlayer.position.y) < 40) {
              validSpawnYLevels.push(y);
            }
            // Skip 2 blocks to find next potential platform faster
            y -= 2;
          }
        }

        if (validSpawnYLevels.length > 0) {
          spawnY = validSpawnYLevels[Math.floor(Math.random() * validSpawnYLevels.length)];
        }

        if (spawnY !== -1) {
          const rand = Math.random();
          let type = "";
          let level = 1;

          if (isDay) {
            if (rand > 0.8) type = MobTypes.COW;
            else if (rand > 0.6) type = MobTypes.COW;
            else if (rand > 0.4) type = MobTypes.SHEEP;
            else if (rand > 0.3) type = MobTypes.ZOMBIE;
            else if (rand > 0.2) type = MobTypes.SKELETON;
            else if (rand > 0.1) type = MobTypes.CREEPER;
            else type = MobTypes.SLIME;
          } else {
            if (rand > 0.95) type = MobTypes.COW;
            else if (rand > 0.9) type = MobTypes.COW;
            else if (rand > 0.85) type = MobTypes.SHEEP;
            else if (rand > 0.6) type = MobTypes.ZOMBIE;
            else if (rand > 0.4) type = MobTypes.SKELETON;
            else if (rand > 0.2) type = MobTypes.CREEPER;
            else type = MobTypes.SLIME;
          }

          if ([MobTypes.ZOMBIE, MobTypes.CREEPER, MobTypes.SKELETON, MobTypes.SLIME].includes(type as MobTypes)) {
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
                if (block !== BLOCK.AIR && block !== BLOCK.WATER && block !== BLOCK.GLASS) {
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
              spawnMob(type, Math.floor(x) + 0.5, spawnY, Math.floor(z) + 0.5, level);
            }
          } else {
            spawnMob(type, Math.floor(x) + 0.5, spawnY, Math.floor(z) + 0.5, level);
          }
        }
      }
    }
  }
}
