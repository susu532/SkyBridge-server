import { BLOCK } from '../TextureAtlas';

// Helper for deterministic randomness
function hashVec(x: number, y: number, z: number): number {
    return Math.abs(x * 73856093 ^ z * 19349663 ^ y * 83492791);
}

function getTierWidth(y: number, maxTiers: number): number {
    if (y < 10) return 30;
    if (y < 40) return 30;
    if (y < 90 && maxTiers >= 3) return 24;
    if (y < 140 && maxTiers >= 4) return 18;
    if (y < 180 && maxTiers >= 5) return 12;
    if (y < 210 && maxTiers >= 6) return 8;
    if (y < 230 && maxTiers >= 6) return 4;
    if (y < 240 && maxTiers >= 6) return 1;
    if (y < 250 && maxTiers >= 6) return 0;
    return -1;
}

// 1. Skyscraper generator logic
function getSkyscraperBlock(x: number, y: number, z: number, cx: number, cz: number, seed: number): number {
    const heightMod = seed % 3; 
    const isTall = heightMod === 0;
    const isMedium = heightMod === 1;
    
    const maxTiers = isTall ? 6 : (isMedium ? 4 : 3);
    const maxY = isTall ? 260 : (isMedium ? 150 : 100);

    if (x < cx - 35 || x > cx + 35 || z < cz - 35 || z > cz + 35 || y > maxY) return BLOCK.AIR;
    if (y < 1) return BLOCK.AIR;

    const lx = Math.abs(x - cx);
    const lz = Math.abs(z - cz);

    const width = getTierWidth(y, maxTiers);
    if (width === -1 || lx > width || lz > width) {
        return BLOCK.AIR;
    }

    const nextWidth = getTierWidth(y + 1, maxTiers);
    const isRoof = nextWidth === -1 || ((lx > nextWidth || lz > nextWidth) && y !== 9);
    if (isRoof) return BLOCK.SMOOTH_STONE;

    const isOuterWall = lx === width || lz === width;

    if (isOuterWall) {
        const isEntrance = y < 5 && (lx <= 3 || lz <= 3);
        if (isEntrance && (lx === width || lz === width)) {
            return BLOCK.AIR;
        }

        const isFloorLine = y >= 10 && y % 5 === 0;
        const isCorner = lx === width && lz === width;
        const isPillar = (lx % 6 === 0 && lz === width) || (lz % 6 === 0 && lx === width);

        if (isCorner) return BLOCK.STONE_BRICKS; 
        
        const pillarBlock = seed % 2 === 0 ? BLOCK.DEEPSLATE_BRICKS : BLOCK.QUARTZ_BLOCK;
        if (isPillar) return pillarBlock; 
        if (isFloorLine) return BLOCK.IRON_BLOCK; 

        if (y < 10) return BLOCK.GLASS_WHITE;

        const windowHash = hashVec(x, y, z) % 100;
        if (windowHash < 15) return BLOCK.GLOWSTONE; 
        return seed % 2 === 0 ? BLOCK.GLASS_LIGHT_BLUE : BLOCK.GLASS_WHITE; 
    } else {
        const isFloor = y >= 10 && y % 5 === 0;
        if (isFloor) {
            if (lx <= 2 && lz <= 2) return BLOCK.AIR; 
            return (x + z) % 2 === 0 ? BLOCK.POLISHED_ANDESITE : BLOCK.POLISHED_DIORITE;
        }
        
        if ((lx === 3 && lz <= 3) || (lz === 3 && lx <= 3)) {
            if (y % 5 > 0 && y % 5 < 4 && (lx === 0 || lz === 0)) return BLOCK.AIR;
            return BLOCK.CONCRETE_GRAY;
        }
        
        if (y >= 10 && y % 5 === 4) {
             if (hashVec(x, y, z) % 15 === 0) return BLOCK.GLOWSTONE;
        }

        if ((y === 1 || y === 11 || y === 21 || y === 41) && lx === 5 && lz === 5) {
            return BLOCK.CHEST;
        }
    }

    return BLOCK.AIR;
}

// 2. Apartment building logic
function getApartmentBlock(x: number, y: number, z: number, cx: number, cz: number, seed: number): number {
    const height = 40 + (seed % 40);
    if (y < 1 || y > height + 1 || x < cx - 30 || x > cx + 30 || z < cz - 20 || z > cz + 20) return BLOCK.AIR;
    const lx = Math.abs(x - cx);
    const lz = Math.abs(z - cz);

    const width = 25;
    const length = 15;

    if (lx > width || lz > length) return BLOCK.AIR;

    const isRoof = y === height || y === height + 1;
    if (isRoof) return BLOCK.STONE_BRICKS;

    const isOuterWall = lx === width || lz === length;
    const wallColor = seed % 3 === 0 ? BLOCK.BRICK : (seed % 3 === 1 ? BLOCK.TERRACOTTA_WHITE : BLOCK.TERRACOTTA_CYAN);

    if (isOuterWall) {
        if (y < 4 && lx < 3 && lz === length) return BLOCK.AIR;

        const isFloorLine = y >= 5 && y % 5 === 0;
        if (isFloorLine) return BLOCK.POLISHED_ANDESITE;

        if (y >= 5 && y % 5 > 1 && y % 5 < 4) {
             const isWindowX = lx < width && lx % 4 > 0 && lx % 4 < 3; 
             const isWindowZ = lz < length && lz % 4 > 0 && lz % 4 < 3;
             if ((lx === width && isWindowZ) || (lz === length && isWindowX)) {
                 const h = hashVec(x, y, z) % 100;
                 return h > 70 ? BLOCK.GLOWSTONE : (h > 40 ? BLOCK.GLASS_WHITE : BLOCK.AIR); 
             }
        }
        return wallColor;
    } else {
        if (y % 5 === 0) return BLOCK.PLANKS;
        if (lx <= 2 && lz <= 2) return BLOCK.QUARTZ_BLOCK;
        if ((y === 1 || y === 6 || y === 16) && lx === 8 && lz === 8) return BLOCK.CHEST;
    }
    return BLOCK.AIR;
}

// 3. Warehouse logic
function getWarehouseBlock(x: number, y: number, z: number, cx: number, cz: number, seed: number): number {
    if (y < 1 || y > 20 || x < cx - 40 || x > cx + 40 || z < cz - 25 || z > cz + 25) return BLOCK.AIR;
    const lx = Math.abs(x - cx);
    const lz = Math.abs(z - cz);

    const width = 35;
    const length = 20;

    if (lx > width || lz > length) return BLOCK.AIR;

    const isOuterWall = lx === width || lz === length;

    const roofHeight = 10 + Math.floor((width - lx) * 0.15);
    if (y === roofHeight || (y === 10 && !isOuterWall)) {
         return BLOCK.IRON_BLOCK;
    }
    if (y > roofHeight) return BLOCK.AIR;

    const wallColor = seed % 2 === 0 ? BLOCK.TERRACOTTA_LIGHT_GRAY : BLOCK.TERRACOTTA_BROWN;

    if (isOuterWall) {
        if (y < 6 && (lx === width - 10 || lx === width - 25) && lz === length) return BLOCK.AIR;
        if (y === 8 && lx % 8 < 5) return BLOCK.GLASS_WHITE;
        if (y < 3) return BLOCK.STONE_BRICKS;

        return wallColor;
    } else {
        if (y < 5) {
            const h = hashVec(x, Math.floor(y/2)*2, z) % 100; 
            if (h < 5 && y % 2 === 1) return BLOCK.WOOD;
            if (h < 15 && y % 2 === 1) return BLOCK.PLANKS;
        }
        if (lx % 10 === 0 && lz === 0) return BLOCK.DEEPSLATE_BRICKS;
        
        if (y === 1 && (lx === 15 && lz === 5)) return BLOCK.CHEST;
        if (y === 1 && (lx === 5 && lz === 15)) return BLOCK.CHEST;
    }

    return BLOCK.AIR;
}

// 4. Hospital logic
function getHospitalBlock(x: number, y: number, z: number, cx: number, cz: number, seed: number): number {
    if (y < 1 || y > 35 || x < cx - 35 || x > cx + 35 || z < cz - 25 || z > cz + 25) return BLOCK.AIR;
    const lx = Math.abs(x - cx);
    const lz = Math.abs(z - cz);

    const width = 30;
    const length = 20;

    if (lx > width || lz > length) return BLOCK.AIR;

    const isRoof = y === 34 || y === 35;
    if (isRoof) {
        // Helipad base
        if (lx < 8 && lz < 8) return BLOCK.CONCRETE_GRAY;
        // Helipad cross
        if (y === 35) {
            if ((lx < 5 && lz === 0) || (lz < 5 && lx === 0)) return BLOCK.CONCRETE_WHITE;
            if (lx === 4 && lz === 4) return BLOCK.CONCRETE_RED;
        }
        return BLOCK.SMOOTH_STONE;
    }

    const isOuterWall = lx === width || lz === length;

    if (isOuterWall) {
        // Red cross on the facade
        if (y >= 20 && y <= 26 && lz === length && lx < 4) {
            if ((y >= 22 && y <= 24 && lx < 4) || (lx < 2 && y >= 20 && y <= 26)) {
                return BLOCK.CONCRETE_RED;
            }
            return BLOCK.CONCRETE_WHITE;
        }

        // Main entrance
        if (y < 4 && lx < 4 && lz === length) return BLOCK.AIR;

        // Windows
        const isFloorLine = y % 5 === 0;
        if (isFloorLine) return BLOCK.QUARTZ_BLOCK;

        if (y % 5 > 1 && y % 5 < 4) {
             const isWindowX = lx < width && lx % 4 > 0 && lx % 4 < 3; 
             const isWindowZ = lz < length && lz % 4 > 0 && lz % 4 < 3;
             if ((lx === width && isWindowZ) || (lz === length && isWindowX)) {
                 const h = hashVec(x, y, z) % 100;
                 return h > 50 ? BLOCK.GLOWSTONE : (h > 20 ? BLOCK.GLASS_LIGHT_BLUE : BLOCK.AIR); 
             }
        }
        return BLOCK.CONCRETE_WHITE;
    } else {
        // Interior floor
        if (y % 5 === 0) return BLOCK.POLISHED_DIORITE;
        // Central corridor / core
        if (lx <= 3 && lz <= 3) return BLOCK.IRON_BLOCK;

        // Chest representing medical supplies
        if (y === 1 && (lx === 10 && lz === 10)) return BLOCK.CHEST;
        if (y === 6 && (lx === 15 && lz === 5)) return BLOCK.CHEST;
    }
    return BLOCK.AIR;
}

// 5. Mall logic
function getMallBlock(x: number, y: number, z: number, cx: number, cz: number, seed: number): number {
    if (y < 1 || y > 15 || x < cx - 40 || x > cx + 40 || z < cz - 40 || z > cz + 40) return BLOCK.AIR;
    const lx = Math.abs(x - cx);
    const lz = Math.abs(z - cz);

    const width = 38;
    const length = 38;

    if (lx > width || lz > length) return BLOCK.AIR;

    // A large, low, wide structure with a central glass dome
    if (y > 10) {
        if (lx < 10 && lz < 10) {
            // Glass dome
            const distSq = lx*lx + lz*lz;
            const radiusSq = (15 - (y - 10)) * (15 - (y - 10));
            if (distSq <= radiusSq && distSq > radiusSq - 20) return BLOCK.GLASS_WHITE;
            return BLOCK.AIR;
        }
        return BLOCK.AIR;
    }

    if (y === 10) {
        if (lx < 10 && lz < 10) return BLOCK.AIR;
        return BLOCK.SMOOTH_STONE; // Flat roof
    }

    const isOuterWall = lx === width || lz === length;
    if (isOuterWall) {
        // Main Entrances
        if (y < 4 && (lx < 6 || lz < 6)) return BLOCK.AIR;

        if (y >= 4 && y < 8 && (lx % 8 < 6 || lz % 8 < 6)) return BLOCK.GLASS_WHITE;

        if (y === 9) return BLOCK.QUARTZ_BLOCK; // trim
        return BLOCK.CONCRETE_LIGHT_GRAY;
    } else {
        if (y === 5) {
            // Second floor walkway
            if (lx > 10 || lz > 10) return BLOCK.POLISHED_DIORITE; // walkways around central atrium
            return BLOCK.AIR; // Atrium open
        }

        if (y % 5 !== 0 && y < 10) {
            // Pillars
             if (lx % 12 === 0 && lz % 12 === 0) return BLOCK.QUARTZ_PILLAR;
        }

        if (y === 1 && lx === 20 && lz === 20) return BLOCK.CHEST;
        if (y === 6 && lx === 20 && lz === 20) return BLOCK.CHEST;
    }
    return BLOCK.AIR;
}

// 6. Library logic
function getLibraryBlock(x: number, y: number, z: number, cx: number, cz: number, seed: number): number {
    if (y < 1 || y > 25 || x < cx - 25 || x > cx + 25 || z < cz - 25 || z > cz + 25) return BLOCK.AIR;
    const lx = Math.abs(x - cx);
    const lz = Math.abs(z - cz);

    const width = 20;
    const length = 20;

    if (lx > width || lz > length) return BLOCK.AIR;

    // Classic architecture: pillars, steps, pediment
    if (y === 24 || y === 25) {
        const pedimentLength = width - (25 - y) * 2;
        if (lz <= pedimentLength && lx <= pedimentLength) return BLOCK.QUARTZ_BLOCK;
        return BLOCK.AIR;
    }

    if (y === 23) return BLOCK.QUARTZ_BRICKS;

    const isOuterWall = lx === width || lz === length;
    if (isOuterWall) {
        if (y < 4 && lx < 4 && lz === length) return BLOCK.AIR; // Entrance

        // Tall classic pillars on the outside
        if (lx % 4 === 0 || lz % 4 === 0) return BLOCK.QUARTZ_PILLAR;
        if (y % 6 === 0) return BLOCK.QUARTZ_BLOCK;
        
        return BLOCK.GLASS_BLACK; // Dark tinted windows between pillars
    } else {
        // Interior floor
        if (y % 6 === 0) return BLOCK.SPRUCE_LOG; // Wooden floors
        
        // Bookshelves (represented by wood or custom if we had it, using wood for now)
        if (y % 6 > 0 && y % 6 < 4) {
            if (lx % 5 === 0 && lz > 4 && lz < length - 4) return BLOCK.PLANKS; // rows of shelves
        }
        
        if (y === 1 && lx === 10 && lz === 10) return BLOCK.CHEST;
        if (y === 7 && lx === 10 && lz === 10) return BLOCK.CHEST;
    }
    return BLOCK.AIR;
}

function getCityBlock(x: number, y: number, z: number): number | null {
    const gridSpacing = 100;
    const halfRoad = 8;
    const sidewalkWidth = 4;
    
    // Shift the coordinates so road centers are at 0, 100, etc.
    const gridX = Math.floor(x / gridSpacing);
    const gridZ = Math.floor(z / gridSpacing);
    
    // The road center for this grid cell's "origin" corner
    // Wait, if gridX = 0 (x from 0 to 99), the roads are at 0 and 100.
    const cx = gridX * gridSpacing;
    const cz = gridZ * gridSpacing;
    
    const dx = Math.abs(x - cx);
    const dz = Math.abs(z - cz);

    // Since cx is the center of the crossroad, dx and dz are distance to intersection center.
    // Road runs along dx=0 and dz=0? 
    // Ah, wait. If cx is the multiple: x is near cx means it's road.
    const distToRoadX = ((x % gridSpacing) + gridSpacing + gridSpacing/2) % gridSpacing - gridSpacing/2;
    const dRoadX = Math.abs(distToRoadX);
    
    const distToRoadZ = ((z % gridSpacing) + gridSpacing + gridSpacing/2) % gridSpacing - gridSpacing/2;
    const dRoadZ = Math.abs(distToRoadZ);

    const isRoad = dRoadX <= halfRoad || dRoadZ <= halfRoad;
    const isSidewalk = dRoadX <= halfRoad + sidewalkWidth || dRoadZ <= halfRoad + sidewalkWidth;

    if (y === 0) {
        if (isRoad) {
            if (dRoadX === 0 && dRoadZ > halfRoad) {
                return (z % 4 === 0) ? BLOCK.CONCRETE_YELLOW : BLOCK.CONCRETE_GRAY;
            }
            if (dRoadZ === 0 && dRoadX > halfRoad) {
                return (x % 4 === 0) ? BLOCK.CONCRETE_YELLOW : BLOCK.CONCRETE_GRAY;
            }
            return BLOCK.CONCRETE_GRAY;
        }
        if (isSidewalk) {
            return ((x + z) % 2 === 0) ? BLOCK.SMOOTH_STONE : BLOCK.STONE_BRICKS;
        }
    }

    if (isRoad || isSidewalk) {
        if (y > 0 && y < 6) {
           if (dRoadX === halfRoad + sidewalkWidth && dRoadZ === halfRoad + sidewalkWidth) {
               if (y < 5) return BLOCK.IRON_BLOCK;
               if (y === 5) return BLOCK.GLOWSTONE;
           }
        }
        return BLOCK.AIR;
    }

    const plotHash = hashVec(gridX, 0, gridZ) % 100;
    
    // We only want exactly 3 hospitals on the entire map.
    // The map is from roughly -400 to 400. Grid size 100.
    // Grid coords are roughly -4 to 3.
    const isHospital = 
        (gridX === -2 && gridZ === -2) || 
        (gridX === 2 && gridZ === -1) || 
        (gridX === 0 && gridZ === 3);

    let plotType = 'PARK';
    if (isHospital) {
         plotType = 'HOSPITAL';
    } else {
         plotType = plotHash < 20 ? 'PARK' : 
                    plotHash < 45 ? 'SKYSCRAPER' : 
                    plotHash < 70 ? 'APARTMENT' : 
                    plotHash < 85 ? 'WAREHOUSE' : 
                    plotHash < 93 ? 'MALL' : 'LIBRARY';
    }

    if (y === 0) {
        if (plotType === 'PARK') {
            const px = Math.abs((x % gridSpacing) + gridSpacing) % gridSpacing - gridSpacing/2;
            const pz = Math.abs((z % gridSpacing) + gridSpacing) % gridSpacing - gridSpacing/2;
            const distToCenter = Math.sqrt(px*px + pz*pz);
            // Pond in center
            if (distToCenter < 12) return BLOCK.WATER;
            if (distToCenter < 15) return BLOCK.SAND;
            // Winding paths
            if (Math.sin(x * 0.1) * Math.cos(z * 0.1) > 0.5) return BLOCK.DIRT;
            return BLOCK.GRASS;
        }
        return BLOCK.CONCRETE_GRAY;
    }

    const plotCx = cx + gridSpacing / 2;
    const plotCz = cz + gridSpacing / 2;

    if (plotType === 'PARK') {
        const lx = Math.abs(x - plotCx);
        const lz = Math.abs(z - plotCz);
        const px = Math.abs((x % gridSpacing) + gridSpacing) % gridSpacing - gridSpacing/2;
        const pz = Math.abs((z % gridSpacing) + gridSpacing) % gridSpacing - gridSpacing/2;
        const distToCenter = Math.sqrt(px*px + pz*pz);

        // Water level
        if (y < 0 && distToCenter < 12) return BLOCK.WATER;
        if (y < 0) return BLOCK.DIRT;

        // Trees scattered around, away from pond and paths
        const isPath = Math.sin(x * 0.1) * Math.cos(z * 0.1) > 0.5;
        if (!isPath && distToCenter > 18) {
             const treeHash = hashVec(Math.floor(x/10), 0, Math.floor(z/10)) % 100;
             if (treeHash < 20) {
                 // Local coordinates relative to tree center
                 const tx = ((x % 10) + 10) % 10 - 5;
                 const tz = ((z % 10) + 10) % 10 - 5;
                 const tdist = Math.sqrt(tx*tx + tz*tz);
                 
                 const treeHeight = 5 + (treeHash % 4);
                 if (tdist === 0 && y < treeHeight) return BLOCK.BIRCH_LOG;
                 if (y >= treeHeight - 2 && y <= treeHeight + 2 && tdist < 3) {
                     if (hashVec(x, y, z) % 100 > 30) return BLOCK.BIRCH_LEAVES;
                 }
             }
             // Bushes
             if (hashVec(x, 0, z) % 100 < 5 && y === 1) return BLOCK.LEAVES;
        }

        // Chests hidden in bushes
        if (y === 1 && hashVec(x, 0, z) % 1000 === 0 && distToCenter > 20) return BLOCK.CHEST;

        return BLOCK.AIR;
    }

    if (plotType === 'SKYSCRAPER') {
        return getSkyscraperBlock(x, y, z, plotCx, plotCz, plotHash);
    } else if (plotType === 'APARTMENT') {
        return getApartmentBlock(x, y, z, plotCx, plotCz, plotHash);
    } else if (plotType === 'WAREHOUSE') {
        return getWarehouseBlock(x, y, z, plotCx, plotCz, plotHash);
    } else if (plotType === 'HOSPITAL') {
        return getHospitalBlock(x, y, z, plotCx, plotCz, plotHash);
    } else if (plotType === 'MALL') {
        return getMallBlock(x, y, z, plotCx, plotCz, plotHash);
    } else if (plotType === 'LIBRARY') {
        return getLibraryBlock(x, y, z, plotCx, plotCz, plotHash);
    }

    return BLOCK.AIR;
}

/**
 * Battle Royale World Generator
 * Features:
 * - Massive detailed realistic city layout
 * - Roads, intersections, sidewalks, parks
 * - Diverse skyscrapers, apartments, warehouses
 */
export function getBattleRoyaleBlock(x: number, y: number, z: number): number {
    const mapRadius = 400;
    const distSq = x * x + z * z;
    const dist = Math.sqrt(distSq);

    // WORLD BOUNDS
    if (dist > mapRadius) {
        return BLOCK.AIR;
    }

    // Ground platform boundaries
    if (y === 0 || y === -1) {
        if (dist > mapRadius - 2 && dist <= mapRadius) {
            return BLOCK.OBSIDIAN;
        }
    }
    
    // City block takes precedence
    const cityBlock = getCityBlock(x, y, z);
    if (cityBlock !== null && cityBlock !== BLOCK.AIR) {
        return cityBlock;
    }
    
    // Foundation below city blocks
    if (y < 0 && y >= -2) {
        return BLOCK.STONE;
    }

    return BLOCK.AIR;
}
