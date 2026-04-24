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

export function getTerrainData(wx: number, wz: number, isSkyCastles: boolean = false, isHub: boolean = false, worldSize: number = 800) {
  if (isHub) {
    const distSq = wx * wx + wz * wz;
    if (distSq <= 900) {
      return { height: 60, biome: biomes.PLAINS, isProtected: true };
    }
    return { height: -100, biome: biomes.OCEAN, isProtected: false };
  }

  const shelterEnd = isSkyCastles ? 300 : 180;

  const dxBlue = Math.max(0, Math.abs(wx) - 50);
  const dzBlue = Math.max(0, 70 - wz, wz - shelterEnd);
  const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

  const dxRed = Math.max(0, Math.abs(wx) - 50);
  const dzRed = Math.max(0, -shelterEnd - wz, wz - -70);
  const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

  let distToProtected = Math.min(distBlue, distRed);

  if (isSkyCastles) {
    if (distToProtected > 15) {
      return { height: -100, biome: biomes.PLAINS, isProtected: false };
    }
    return { height: 64, biome: biomes.PLAINS, isProtected: distToProtected === 0 };
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
  
  return { height: finalHeight, biome, isProtected: distToProtected === 0 };
}

export function getTerrainHeight(wx_raw: number, wz_raw: number, isSkyCastles: boolean = false) {
  const data = getTerrainData(Math.floor(wx_raw), Math.floor(wz_raw), isSkyCastles, false, 800);
  return data.height - 60; // Convert to world Y (WORLD_Y_OFFSET is -60)
}

export function isNature(wx_raw: number, wz_raw: number, isSkyCastles: boolean = false) {
  const wx = Math.floor(wx_raw);
  const wz = Math.floor(wz_raw);
  
  const isBlueSide = wz >= 70;
  const isRedSide = wz <= -70;
  if (!isBlueSide && !isRedSide) return false;

  const shelterEnd = isSkyCastles ? 300 : 180;

  const dxBlue = Math.max(0, Math.abs(wx) - 50);
  const dzBlue = Math.max(0, 70 - wz, wz - shelterEnd);
  const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

  const dxRed = Math.max(0, Math.abs(wx) - 50);
  const dzRed = Math.max(0, -shelterEnd - wz, wz - -70);
  const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

  const distToProtected = Math.min(distBlue, distRed);
  
  if (isSkyCastles) {
    return distToProtected > 0 && distToProtected <= 15;
  }

  if (distToProtected <= 10) return false;

  const groundY = getTerrainHeight(wx, wz, isSkyCastles);
  if (groundY < 3) return false; 
  
  return true;
}
