import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BLOCK } from './TextureAtlas';

// Seeded random for consistent terrain between client and server
function createPRNG(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function() {
    h = (Math.imul(1597334677, h) + 1) | 0;
    return (h >>> 0) / 0xffffffff;
  };
}

export const prng = createPRNG('skyBridge-seed-v1');
export const noise2D = createNoise2D(prng);
export const noise3D = createNoise3D(prng);

export const biomes = {
  SNOWY_TUNDRA: { height: 10, scale: 0.015, topBlock: BLOCK.SNOW, subBlock: BLOCK.DIRT, treeChance: 0.02, plantChance: 0.05, treeType: 'SPRUCE' },
  TAIGA: { height: 20, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.05, treeType: 'SPRUCE' },
  SAVANNA: { height: 8, scale: 0.008, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.02, plantChance: 0.15, treeType: 'OAK' },
  PLAINS: { height: 5, scale: 0.01, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.01, plantChance: 0.2, treeType: 'OAK' },
  FOREST: { height: 15, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.1, treeType: 'BIRCH' },
  JUNGLE: { height: 25, scale: 0.025, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.3, plantChance: 0.3, treeType: 'JUNGLE' },
  SWAMP: { height: 2, scale: 0.015, topBlock: BLOCK.MUD, subBlock: BLOCK.DIRT, treeChance: 0.08, plantChance: 0.15, treeType: 'OAK' },
  BADLANDS: { height: 25, scale: 0.01, topBlock: BLOCK.RED_SAND, subBlock: BLOCK.TERRACOTTA, treeChance: 0.001, plantChance: 0.02, treeType: 'CACTUS' },
  VOLCANIC: { height: 30, scale: 0.02, topBlock: BLOCK.OBSIDIAN, subBlock: BLOCK.STONE, treeChance: 0, plantChance: 0, treeType: 'NONE' },
  DESERT: { height: 8, scale: 0.01, topBlock: BLOCK.SAND, subBlock: BLOCK.SANDSTONE, treeChance: 0.005, plantChance: 0.05, treeType: 'CACTUS' },
  ICE_SPIKES: { height: 15, scale: 0.02, topBlock: BLOCK.SNOW, subBlock: BLOCK.SNOW, treeChance: 0.05, plantChance: 0.01, treeType: 'ICE_SPIKE' },
  CHERRY_GROVE: { height: 35, scale: 0.015, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.15, plantChance: 0.4, treeType: 'CHERRY' },
  MUSHROOM_ISLAND: { height: 10, scale: 0.015, topBlock: BLOCK.MYCELIUM, subBlock: BLOCK.DIRT, treeChance: 0.05, plantChance: 0.1, treeType: 'GIANT_MUSHROOM' },
  MOUNTAINS: { height: 60, scale: 0.005, topBlock: BLOCK.STONE, subBlock: BLOCK.STONE, treeChance: 0.01, plantChance: 0.01, treeType: 'SPRUCE' },
  OCEAN: { height: -20, scale: 0.01, topBlock: BLOCK.SAND, subBlock: BLOCK.SAND, treeChance: 0, plantChance: 0, treeType: 'NONE' },
  DARK_FOREST: { height: 15, scale: 0.02, topBlock: BLOCK.GRASS, subBlock: BLOCK.DIRT, treeChance: 0.4, plantChance: 0.2, treeType: 'DARK_OAK' }
};

function getDistToProtected(wx: number, wz: number, isSkyCastles: boolean) {
  const shelterStart = isSkyCastles ? 70 : 61;
  const shelterEnd = isSkyCastles ? 405 : 110;
  let mountainWidth = isSkyCastles ? 95 : 50;
  
  if (isSkyCastles && Math.abs(wz) >= 300) {
    return 1000;
  }

  if (isSkyCastles && Math.abs(wz) > shelterEnd) return 1000;

  const dxBlue = Math.max(0, Math.abs(wx) - mountainWidth);
  const dzBlue = Math.max(0, shelterStart - wz, wz - shelterEnd);
  const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

  const dxRed = Math.max(0, Math.abs(wx) - mountainWidth);
  const dzRed = Math.max(0, -shelterEnd - wz, wz - -shelterStart);
  const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

  return Math.min(distBlue, distRed);
}

export function getTerrainData(wx: number, wz: number, isSkyCastles: boolean = false, isHub: boolean = false, worldSize: number = 800) {
  if (isHub) {
    const distSq = wx * wx + wz * wz;
    if (distSq <= 900) {
      return { height: 60, biome: biomes.PLAINS, isProtected: true, minHeight: 0 };
    }
    return { height: -100, biome: biomes.OCEAN, isProtected: false, minHeight: 0 };
  }

  let distToProtected = getDistToProtected(wx, wz, isSkyCastles);

  if (isSkyCastles) {
    if (Math.abs(wx) > 95 || distToProtected > 30) {
      return { height: -100, biome: biomes.PLAINS, isProtected: false, minHeight: 0 };
    }
    
    let baseH = 64;
    const absZ = Math.abs(wz);
    
    // Mountain generation for Skycastles
    if (absZ >= 70 && absZ <= 405) {
      const absX = Math.abs(wx);
      
      // Strict terrain removal around the ship area (Z >= 320)
      if (absZ >= 290) { // Keep some buffer
        if (absZ >= 320) {
           return { height: -100, biome: biomes.PLAINS, isProtected: false, minHeight: 0 };
        }
      }

      const xSlopeStart = 40; 
      const xSlopeEnd = 100;
      let xFactor = 1.0;
      if (absX > xSlopeStart) {
        xFactor = 1.0 - Math.min(1.0, (absX - xSlopeStart) / (xSlopeEnd - xSlopeStart));
        xFactor = xFactor * xFactor * (3 - 2 * xFactor); // Smoothstep
      }

      if (absZ >= 170 && absZ <= 230) {
         // Peak of the mountain (Castle sits here)
         baseH = 124; 
         
         // Add peak noise to make it less flat
         const peakNoise = noise2D(wx * 0.04, wz * 0.04);
         const edgeDist = Math.min(absZ - 170, 230 - absZ, 100 - Math.abs(wx));
         const peakFactor = Math.max(0, Math.min(1, edgeDist / 20));
         
         // Base height is 124, but let's vary it
         baseH = 118 + Math.floor(peakNoise * 12);
         
         // Add sharp ridges
         const ridgeNoise = Math.abs(noise2D(wx * 0.06, wz * 0.01)) * 10;
         const ridgeNoise2 = Math.abs(noise2D(wx * 0.01, wz * 0.06)) * 10;
         baseH += Math.floor(Math.max(ridgeNoise, ridgeNoise2) * (1 - peakFactor * 0.4));

         // Add crags
         if (Math.abs(wx) > 20 || absZ < 180 || absZ > 220) {
             const crag = noise2D(wx * 0.12, wz * 0.12);
             if (crag > 0.3) baseH += 6;
             if (crag > 0.6) baseH += 6;
             if (crag > 0.8) baseH += 10;
         }

         // Slope down on X
         baseH = 64 + Math.floor((baseH - 64) * xFactor);

         // Level out perfectly for the castle footprint
         // Castle area is defined as worldX [-20, 20] and absZ [180, 220]
         if (Math.abs(wx) <= 22 && absZ >= 178 && absZ <= 222) {
             baseH = 124;
         }
      } else if (absZ >= 70 && absZ < 170) {
         // Slope up from bridge
         const t = (absZ - 70) / 100;
         
         if (Math.abs(wx) <= 5) {
             // Majestic Stairs path
             const stepIndex = Math.floor((absZ - 70) / 1.66); // 60 height over 100 blocks
             baseH = 64 + stepIndex;
         } else {
             // Rugged mountain side
             const smooth_t = t * t * (3 - 2 * t);
             baseH = 64 + Math.floor(smooth_t * 60);
             // Add a bit of natural noise to the slopes
             const ruggedness = noise2D(wx * 0.08, wz * 0.08) * 8 * smooth_t;
             const microDetail = noise3D(wx * 0.2, baseH * 0.1, wz * 0.2) * 2;
             baseH += Math.floor(ruggedness + microDetail);

             // Slope down on X
             baseH = 64 + Math.floor((baseH - 64) * xFactor);
         }
      } else if (absZ > 230 && absZ <= 300) {
         // Slope down to village
         const t = 1 - ((absZ - 230) / 70);
         
         if (Math.abs(wx) <= 5) {
             // Majestic Stairs down
             const stepIndex = Math.floor((absZ - 230) / 1.16) * 1; // 60 height over 70 blocks 
             baseH = 124 - stepIndex;
         } else {
             const smooth_t = t * t * (3 - 2 * t);
             baseH = 64 + Math.floor(smooth_t * 60);
             const ruggedness = noise2D(wx * 0.08, wz * 0.08) * 8 * smooth_t;
             const microDetail = noise3D(wx * 0.2, baseH * 0.1, wz * 0.2) * 2;
             baseH += Math.floor(ruggedness + microDetail);

             // Slope down on X
             baseH = 64 + Math.floor((baseH - 64) * xFactor);
         }
      }
    }
    const res = { height: baseH, biome: biomes.PLAINS, isProtected: distToProtected === 0, minHeight: 0 };
    if (isSkyCastles) {
      const absX = Math.abs(wx);
      const absZ = Math.abs(wz);
      const dx = 95 - absX;
      const dz1 = absZ - 70;
      const dz2 = 320 - absZ;
      const dVal = Math.min(dx, dz1, dz2);
      
      const hullDepth = Math.pow(Math.max(0, dVal + noise2D(wx * 0.1, wz * 0.1) * 2), 0.75) * 4.5;
      let minH = Math.max(20, baseH - hullDepth);
      
      const jagNoise = noise3D(wx * 0.08, minH * 0.1, wz * 0.08);
      if (jagNoise > 0.3) minH += (jagNoise - 0.3) * 15;
      res.minHeight = minH;
    }
    return res;
  }

  const baseHeight = 64;
  
  const tempNoise = noise2D(wx * 0.002, wz * 0.002);
  const moistNoise = noise2D(wx * 0.002 + 1000, wz * 0.002 + 1000);
  
  let biome = biomes.PLAINS;
  
  if (tempNoise < -0.6) {
    biome = biomes.ICE_SPIKES;
  } else if (tempNoise < -0.3) {
    biome = moistNoise < 0 ? biomes.SNOWY_TUNDRA : biomes.TAIGA;
  } else if (tempNoise < 0.0) {
    if (moistNoise < -0.3) biome = biomes.CHERRY_GROVE;
    else if (moistNoise < 0.3) biome = biomes.FOREST;
    else biome = biomes.DARK_FOREST;
  } else if (tempNoise < 0.3) {
    if (moistNoise < -0.3) biome = biomes.SAVANNA;
    else if (moistNoise < 0.3) biome = biomes.PLAINS;
    else biome = biomes.SWAMP;
  } else if (tempNoise < 0.6) {
    if (moistNoise < -0.4) biome = biomes.BADLANDS;
    else if (moistNoise < 0.4) biome = biomes.DESERT;
    else biome = biomes.JUNGLE;
  } else {
    if (moistNoise < -0.4) biome = biomes.VOLCANIC;
    else if (moistNoise < 0.4) biome = biomes.MUSHROOM_ISLAND;
    else biome = biomes.JUNGLE;
  }
  
  const elevationNoise = noise2D(wx * 0.001, wz * 0.001);
  if (elevationNoise > 0.6) biome = biomes.MOUNTAINS;

  const n1 = noise2D(wx * biome.scale, wz * biome.scale);
  const n2 = noise2D(wx * biome.scale * 4, wz * biome.scale * 4) * 0.5;
  const n3 = noise2D(wx * biome.scale * 16, wz * biome.scale * 16) * 0.25;
  
  let mountainHeight = (n1 + n2 + n3) * biome.height;
  
  const distFromCenter = Math.sqrt(wx * wx + wz * wz);
  if (distFromCenter > worldSize - 100) {
    const edgeFactor = Math.min(1, (distFromCenter - (worldSize - 100)) / 100);
    mountainHeight = mountainHeight * (1 - edgeFactor) - 100 * edgeFactor;
  }

  const targetHeight = baseHeight + mountainHeight;

  const blendDist = 30;
  let blendFactor = distToProtected / blendDist;
  if (blendFactor > 1) blendFactor = 1;
  if (blendFactor < 0) blendFactor = 0;

  blendFactor = blendFactor * blendFactor * (3 - 2 * blendFactor);

  const finalHeight = Math.floor(baseHeight * (1 - blendFactor) + targetHeight * blendFactor);
  
  const res = { height: finalHeight, biome, isProtected: distToProtected === 0, minHeight: 0 };
  if (isSkyCastles) {
    const absX = Math.abs(wx);
    const absZ = Math.abs(wz);
    const dx = 95 - absX;
    const dz1 = absZ - 70;
    const dz2 = 320 - absZ;
    const dVal = Math.min(dx, dz1, dz2);
    
    const hullDepth = Math.pow(Math.max(0, dVal + noise2D(wx * 0.1, wz * 0.1) * 2), 0.75) * 4.5;
    let minH = Math.max(20, finalHeight - hullDepth);
    
    const jagNoise = noise3D(wx * 0.08, minH * 0.1, wz * 0.08);
    if (jagNoise > 0.3) minH += (jagNoise - 0.3) * 15;
    res.minHeight = minH;
  }
  return res;
}

export function getTerrainHeight(wx_raw: number, wz_raw: number, isSkyCastles: boolean = false) {
  const data = getTerrainData(Math.floor(wx_raw), Math.floor(wz_raw), isSkyCastles, false, 800);
  return data.height - 60; // Convert to world Y (WORLD_Y_OFFSET is -60)
}

export function getTerrainMinHeight(wx_raw: number, wz_raw: number, isSkyCastles: boolean = false) {
  const data = getTerrainData(Math.floor(wx_raw), Math.floor(wz_raw), isSkyCastles, false, 800);
  return data.minHeight - 60; // Convert to world Y
}

export function isNature(wx_raw: number, wz_raw: number, isSkyCastles: boolean = false) {
  const wx = Math.floor(wx_raw);
  const wz = Math.floor(wz_raw);
  
  const isBlueSide = isSkyCastles ? wz >= 70 : wz >= 0;
  const isRedSide = isSkyCastles ? wz <= -70 : wz < 0;
  if (!isBlueSide && !isRedSide) return false;

  const distToProtected = getDistToProtected(wx, wz, isSkyCastles);
  
  if (isSkyCastles) {
    return distToProtected > 0 && distToProtected <= 15;
  }

  if (distToProtected <= 10) return false;

  const groundY = getTerrainHeight(wx, wz, isSkyCastles);
  if (groundY < 3) return false; 
  
  return true;
}
