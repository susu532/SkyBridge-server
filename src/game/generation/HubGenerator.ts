
import { BLOCK } from '../TextureAtlas';
import { CHUNK_HEIGHT, type Chunk } from '../Chunk';

export function generateHubTerrain(chunk: Chunk, lx: number, lz: number, wx: number, wz: number) {
    
    const distSq = wx * wx + wz * wz;
    const dist = Math.sqrt(distSq);

    // 1. Floating Island Base
    for (let y = -60; y <= 0; y++) {
      const cy = y + 60;
      const radiusAtY = Math.sqrt(y + 60) * 11;
      const noise = (Math.sin(wx * 0.1) + Math.cos(wz * 0.1)) * 4;
      
      if (dist < radiusAtY + noise) {
        let type = BLOCK.DEEPSLATE;
        if (y === 0) type = BLOCK.POLISHED_ANDESITE;
        else if (y < -45) type = BLOCK.OBSIDIAN;
        else if (y < -25) type = (Math.sin(wx * 0.5 + wz * 0.5) > 0) ? BLOCK.COBBLED_DEEPSLATE : BLOCK.OBSIDIAN;
        else type = (Math.cos(wx * 0.4 - wz * 0.4) > 0) ? BLOCK.DEEPSLATE : BLOCK.COBBLED_DEEPSLATE;
        chunk.setBlockFast(lx, cy, lz, type);
      }
    }

    // 2. Surface Decor (at Y=0, which is cy=60)
    if (dist <= 85) {
      if (dist <= 30) {
         chunk.setBlockFast(lx, 60, lz, BLOCK.STONE);
         let petals = 8;
         let angle = Math.atan2(wz, wx);
         let starMod = Math.abs(Math.sin(angle * petals));
         if (dist > 10 && dist < 10 + starMod * 15) {
            chunk.setBlockFast(lx, 60, lz, BLOCK.COBBLED_DEEPSLATE);
         } else if (Math.floor(dist) === 28) {
            chunk.setBlockFast(lx, 60, lz, BLOCK.OBSIDIAN);
         }
      }

      if ((Math.abs(wx) <= 4 && dist <= 85) || (Math.abs(wz) <= 4 && dist <= 85)) {
         chunk.setBlockFast(lx, 60, lz, BLOCK.NETHER_BRICKS);
         if (Math.abs(wx) === 5 || Math.abs(wz) === 5) {
            chunk.setBlockFast(lx, 61, lz, BLOCK.OBSIDIAN);
         }
      }

      if (dist <= 6) {
         chunk.setBlockFast(lx, 61, lz, BLOCK.OBSIDIAN);
         if (dist <= 4) chunk.setBlockFast(lx, 62, lz, BLOCK.RED_NETHER_BRICKS);
         if (dist <= 2) {
             for(let y=61; y<=64; y++) chunk.setBlockFast(lx, y, lz, BLOCK.LAVA);
             chunk.setBlockFast(lx, 65, lz, BLOCK.GLOWSTONE);
         }
      }

      buildHubCastles(chunk, lx, lz, wx, wz);

      const ringY = 115;
      const ringNoise = Math.sin(Math.atan2(wz, wx) * 6) * 15;
      if (Math.abs(dist - 85) < 1.1) {
          const cy = Math.floor(ringY + ringNoise);
          if (cy >= 0 && cy < CHUNK_HEIGHT) {
              chunk.setBlockFast(lx, cy, lz, BLOCK.GLOWSTONE);
              if (cy > 0) chunk.setBlockFast(lx, cy - 1, lz, BLOCK.GLASS_PURPLE);
              if (cy > 1) chunk.setBlockFast(lx, cy - 2, lz, BLOCK.GLASS_MAGENTA);
              if (cy > 2) chunk.setBlockFast(lx, cy - 3, lz, BLOCK.OBSIDIAN);
          }
      }

      const corners: [number, number][] = [[45,45], [-45, 45], [45, -45], [-45, -45]];
      for(const [cx, cz] of corners) {
          const dC = Math.sqrt((wx-cx)**2 + (wz-cz)**2);
          if (dC <= 6) {
              const h = 25 + Math.floor((6-dC)*12);
              for(let y=0; y<=h; y++) {
                const cy = y + 60;
                if (cy >= CHUNK_HEIGHT) break;
                let bt = BLOCK.DEEPSLATE;
                if (dC <= 1.5) bt = BLOCK.GLOWSTONE;
                else if (dC <= 2.5 && y > h - 15) bt = BLOCK.GLASS_PURPLE;
                else if (y % 20 === 0 && dC > 5.5) bt = BLOCK.GLOWSTONE;
                chunk.setBlockFast(lx, cy, lz, bt);
              }
          }
      }
    }
  }

export function buildHubCastles(chunk: Chunk, lx: number, lz: number, wx: number, wz: number) {
    
      const centers: [number, number, number][] = [[0, 35, 0], [35, 0, 1], [0, -35, 2], [-35, 0, 3]];
      for(const [cx, cz, rot] of centers) {
         let lx_c, lz_c;
         if (rot === 0) { lx_c = wx - cx; lz_c = wz - cz; }
         else if (rot === 1) { lx_c = -(wz - cz); lz_c = wx - cx; }
         else if (rot === 2) { lx_c = -(wx - cx); lz_c = -(wz - cz); }
         else { lx_c = wz - cz; lz_c = -(wx - cx); }

         const width = 16;
         const length = 28;

         if (lx_c >= -width && lx_c <= width && lz_c >= 0 && lz_c <= length) {
             const isBorder = (Math.abs(lx_c) === width || lz_c === 0 || lz_c === length);
             if (isBorder && !(lz_c === 0 && Math.abs(lx_c) <= 3)) {
                 for(let y=1; y<=25; y++) {
                     let bt = BLOCK.DEEPSLATE;
                     if (y >= 5 && y <= 20 && lz_c > 3 && lz_c < length - 3 && lz_c % 5 === 0) bt = BLOCK.GLASS_WHITE;
                     chunk.setBlockFast(lx, y + 60, lz, bt);
                 }
             } else if (!isBorder) {
                 chunk.setBlockFast(lx, 60, lz, BLOCK.STONE_BRICKS);
                 const archH = 25 + (width - Math.abs(lx_c)) * 0.9;
                 chunk.setBlockFast(lx, Math.floor(archH) + 60, lz, BLOCK.COBBLED_DEEPSLATE);
                 if (lz_c % 10 === 0 && lz_c > 2 && lz_c < length - 2 && Math.abs(lx_c) === width - 4) {
                     chunk.setBlockFast(lx, 61, lz, BLOCK.NETHER_BRICKS);
                     chunk.setBlockFast(lx, 62, lz, BLOCK.NETHER_BRICKS);
                     chunk.setBlockFast(lx, 63, lz, BLOCK.GLOWSTONE);
                 }
             }
         }

         if (lz_c === 0 && Math.abs(lx_c) <= width) {
             for(let y=25; y<=45; y++) {
                 if (Math.abs(lx_c) <= (45 - y) * 0.8) {
                     let bt = BLOCK.DEEPSLATE;
                     if (y >= 30 && y <= 38 && Math.abs(lx_c) <= 3) bt = BLOCK.GLASS_WHITE;
                     else if (y >= 26 && y <= 28 && lx_c === 0) bt = BLOCK.GLOWSTONE;
                     chunk.setBlockFast(lx, y + 60, lz, bt);
                 }
             }
         }

         const towers: [number, number, number][] = [[width, 0, 55], [-width, 0, 55], [width, length, 40], [-width, length, 40]];
         for(const [tx, tz, th] of towers) {
             const dt = Math.max(Math.abs(lx_c - tx), Math.abs(lz_c - tz));
             if (dt <= 3) {
                 for(let y=1; y<=th; y++) {
                     let bt = (y % 15 === 0) ? BLOCK.OBSIDIAN : BLOCK.NETHER_BRICKS;
                     if (dt < 3) bt = BLOCK.AIR;
                     if (y === 1 && dt < 3) bt = BLOCK.NETHER_BRICKS;
                     if (bt !== BLOCK.AIR) chunk.setBlockFast(lx, y + 60, lz, bt);
                 }
                 for (let y = 1; y <= 20; y++) {
                     const sr = Math.max(0, 3 - Math.floor(y/6));
                     if (dt <= sr) chunk.setBlockFast(lx, th + y + 60, lz, BLOCK.OBSIDIAN);
                 }
             }
         }
      }
   
}
