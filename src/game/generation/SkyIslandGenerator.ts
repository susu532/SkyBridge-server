import { BLOCK } from '../TextureAtlas';
import { CHUNK_HEIGHT, WORLD_Y_OFFSET, type Chunk } from '../Chunk';
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export function generateSkyIslandTerrain(chunk: Chunk, lx: number, lz: number, wx: number, wz: number) {
    const distSq = wx * wx + wz * wz;
    const dist = Math.sqrt(distSq);

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const worldY = y + WORLD_Y_OFFSET;

        // Island 1 from radius 0 to 40
        if (dist < 40) {
           const baseHeight = 65;
           const depth = Math.max(1, 15 - dist * 0.35 + noise2D(wx * 0.1, wz * 0.1) * 3);
           
           if (worldY === baseHeight) {
               chunk.setBlockFast(lx, y, lz, BLOCK.GRASS);
           } else if (worldY < baseHeight && worldY > baseHeight - depth) {
               chunk.setBlockFast(lx, y, lz, worldY > baseHeight - 3 ? BLOCK.DIRT : BLOCK.STONE);
           } else if (worldY === baseHeight + 1 && dist < 35 && noise2D(wx * 12.3, wz * 12.3) > 0.9) {
               chunk.setBlockFast(lx, y, lz, BLOCK.WOOD);
           } else if (worldY > baseHeight && worldY <= baseHeight + 2 && noise2D(wx * 12.3, wz * 12.3) > 0.95) {
               chunk.setBlockFast(lx, y, lz, BLOCK.TALL_GRASS);
           }
        }

        // Island 2
        const wx2 = wx - 50;
        const wz2 = wz;
        const distSq2 = wx2 * wx2 + wz2 * wz2;
        const dist2 = Math.sqrt(distSq2);

        if (dist2 < 40) {
           const baseHeight2 = 115;
           const depth2 = Math.max(1, 15 - dist2 * 0.35 + noise2D(wx2 * 0.1, wz2 * 0.1) * 3);
           
           if (worldY === baseHeight2) {
               chunk.setBlockFast(lx, y, lz, BLOCK.GRASS);
           } else if (worldY < baseHeight2 && worldY > baseHeight2 - depth2) {
               chunk.setBlockFast(lx, y, lz, worldY > baseHeight2 - 3 ? BLOCK.DIRT : BLOCK.STONE);
           } else if (worldY === baseHeight2 + 1 && dist2 < 35 && noise2D(wx2 * 12.3, wz2 * 12.3) > 0.9) {
               chunk.setBlockFast(lx, y, lz, BLOCK.WOOD);
           } else if (worldY > baseHeight2 && worldY <= baseHeight2 + 2 && noise2D(wx2 * 12.3, wz2 * 12.3) > 0.95) {
               chunk.setBlockFast(lx, y, lz, BLOCK.TALL_GRASS);
           }
        }
    }
}
