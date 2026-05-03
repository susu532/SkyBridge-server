
import { BLOCK } from '../TextureAtlas';

export function getVillageBlock(wx: number, wy: number, wz: number, isBlue: boolean, isSkyCastles: boolean): number {
    
    const blueVillageStart = isSkyCastles ? 300 : 61;
    const localZ = isBlue ? wz - blueVillageStart : wz - (-blueVillageStart); // localZ from 0 to 49
    const absLocalZ = Math.abs(localZ);
    
    // 1. Village Fence
    const isFenceX = (wx === -50 || wx === 50) && absLocalZ >= 0 && absLocalZ <= 49;
    const isFenceZ = (localZ === 0 || localZ === (isBlue ? 49 : -49)) && wx >= -50 && wx <= 50;
    
    if (isFenceX || isFenceZ) {
      if (wy <= 8) {
        // Double doors in the fence (front and back)
        const isFrontDoor = localZ === 0;
        const isBackDoor = localZ === (isBlue ? 49 : -49);
        if ((isFrontDoor || isBackDoor) && wx >= -4 && wx <= 4 && wy <= 10) {
          // Open door effect: just air in the middle
          if (Math.abs(wx) < 3) return BLOCK.AIR;
          // Door posts/frames
          return BLOCK.WOOD;
        }
        
        // Fence style: stone base, wood top
        if (wy <= 3) return BLOCK.STONE;
        if (wy === 8 && wx % 2 === 0) return BLOCK.AIR; // Battlements for fence
        return BLOCK.WOOD;
      }
    }

    // 2. Custom Buildings
    const drawTavern = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
        const isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
        
        if (wy >= 5 && wy <= 14) {
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            if (isCorner) return BLOCK.WOOD;
            if (wy === 10) return BLOCK.WOOD;
            
            // Door
            if (dz === 0 && dx >= Math.floor(width/2) - 1 && dx <= Math.floor(width/2) + 1 && wy <= 7) return BLOCK.AIR;
            
            // Windows
            if ((wy === 7 || wy === 8 || wy === 12 || wy === 13) && !isCorner && (dx % 4 === 2 || dz % 4 === 2)) return BLOCK.GLASS;
            
            return BLOCK.PLANKS;
          } else {
            if (wy === 5 || wy === 10) return BLOCK.PLANKS; // Floors
            return BLOCK.AIR;
          }
        }
        
        // Pitched Roof
        if (wy >= 15 && wy <= 19) {
          const roofLayer = wy - 15;
          if (dx >= roofLayer - 1 && dx <= width - roofLayer && dz >= -1 && dz <= depth) {
            return BLOCK.WOOD;
          }
        }
      }
      return -1;
    };

    const drawBlacksmith = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const isRoom = dx < 8;
        
        if (wy >= 5 && wy <= 10) {
          if (isRoom) {
            const isWall = dx === 0 || dx === 7 || dz === 0 || dz === depth - 1;
            if (wy === 10) return BLOCK.STONE; // Flat roof
            if (isWall) {
              // Door
              if (dx === 7 && dz === Math.floor(depth/2) && wy <= 7) return BLOCK.AIR;
              // Window
              if (dx === 0 && dz === Math.floor(depth/2) && wy === 7) return BLOCK.GLASS;
              return BLOCK.STONE;
            } else {
              if (wy === 5) return BLOCK.STONE; // Floor
              return BLOCK.AIR;
            }
          } else {
            // Forge Area
            if (wy === 10) return BLOCK.WOOD; // Awning
            if (wy === 5) return BLOCK.STONE; // Floor
            
            // Pillars
            if ((dx === width - 1 && dz === 0) || (dx === width - 1 && dz === depth - 1)) return BLOCK.WOOD;
            
            // Chimney & Forge
            if (dx >= 9 && dx <= 11 && dz >= 2 && dz <= 4) {
              if (dx === 10 && dz === 3) return BLOCK.BRICK; // Chimney core
              if (wy <= 7) return BLOCK.BRICK; // Forge base
            }
            
            // Water Trough
            if (dx >= 10 && dx <= 11 && dz >= 7 && dz <= 9) {
              if (wy === 6) {
                if (dx === 10 && dz === 8) return BLOCK.WATER;
                return BLOCK.STONE;
              }
            }
            
            return BLOCK.AIR;
          }
        }
        
        // Chimney top
        if (wy > 10 && wy <= 14 && dx === 10 && dz === 3) return BLOCK.BRICK;
      }
      return -1;
    };

    const drawWatchtower = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        // Base tower
        if (wy >= 5 && wy <= 16) {
          if (dx >= 1 && dx <= width - 2 && dz >= 1 && dz <= depth - 2) {
            const isWall = dx === 1 || dx === width - 2 || dz === 1 || dz === depth - 2;
            if (isWall) {
              // Door
              if (dz === 1 && dx === Math.floor(width/2) && wy <= 7) return BLOCK.AIR;
              // Slit windows
              if (wy % 4 === 0 && dx === Math.floor(width/2)) return BLOCK.AIR;
              return BLOCK.STONE;
            } else {
              // Ladder
              if (dx === 2 && dz === 2) return BLOCK.WOOD;
              if (wy === 5 || wy === 16) return BLOCK.PLANKS;
              return BLOCK.AIR;
            }
          }
        }
        
        // Platform
        if (wy === 17) return BLOCK.PLANKS;
        
        // Battlements
        if (wy === 18) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall && (dx % 2 === 0 || dz % 2 === 0)) return BLOCK.WOOD;
          return BLOCK.AIR;
        }
        
        // Roof
        if (wy === 19 && dx >= 1 && dx <= width - 2 && dz >= 1 && dz <= depth - 2) return BLOCK.WOOD;
        if (wy === 20 && dx >= 2 && dx <= width - 3 && dz >= 2 && dz <= depth - 3) return BLOCK.WOOD;
      }
      return -1;
    };

    const drawFarm = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy === 5 || wy === 6) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            // Gate
            if (dz === 0 && dx === Math.floor(width/2)) return BLOCK.AIR;
            if (wy === 5) return BLOCK.WOOD;
            if (wy === 6 && (dx % 3 === 0 || dz % 3 === 0)) return BLOCK.WOOD; // Fence posts
            return BLOCK.AIR;
          } else if (wy === 5) {
            // Crops and water
            if (dx % 4 === 2) return BLOCK.WATER;
            return BLOCK.LEAVES; // Represents crops
          }
        }
      }
      return -1;
    };

    const drawLibrary = (hx: number, hz: number, width: number, depth: number, isBlue: boolean) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy >= 5 && wy <= 18) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            // Door facing vertical path
            if (dx === 0 && dz >= Math.floor(depth/2) - 1 && dz <= Math.floor(depth/2) + 1 && wy <= 7) return BLOCK.AIR;
            // Windows
            if (wy >= 8 && wy <= 12 && (dx % 3 === 0 || dz % 3 === 0)) return BLOCK.GLASS;
            return BLOCK.BRICK;
          } else {
            if (wy === 5 || wy === 12) return BLOCK.PLANKS; // Floors
            // Bookshelves
            if (wy >= 6 && wy <= 10 && (dx === 2 || dx === width - 3) && dz >= 2 && dz <= depth - 3) return BLOCK.WOOD;
            return BLOCK.AIR;
          }
        }
        // Roof
        if (wy >= 19 && wy <= 23) {
          const step = wy - 19;
          if (dx >= step && dx < width - step && dz >= step && dz < depth - step) {
            return isBlue ? BLOCK.BLUE_STONE : BLOCK.RED_STONE;
          }
        }
      }
      return -1;
    };

    const drawBakery = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy >= 5 && wy <= 12) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            // Door facing vertical path
            if (dx === width - 1 && dz >= Math.floor(depth/2) - 1 && dz <= Math.floor(depth/2) + 1 && wy <= 7) return BLOCK.AIR;
            // Windows
            if (wy === 7 && (dx === 2 || dz === 2 || dz === depth - 3)) return BLOCK.GLASS;
            return BLOCK.PLANKS;
          } else {
            if (wy === 5) return BLOCK.STONE; // Floor
            // Oven
            if (dx >= 2 && dx <= 5 && dz >= 2 && dz <= 4) {
              if (wy <= 8) {
                if (dx === 5 && dz === 3 && wy === 6) return BLOCK.AIR; // Oven opening
                return BLOCK.BRICK;
              }
            }
            // Counter
            if (dx >= 7 && dx <= 10 && dz === 6 && wy <= 6) return BLOCK.WOOD;
            return BLOCK.AIR;
          }
        }
        // Roof
        if (wy >= 13 && wy <= 16) {
          const step = wy - 13;
          if (dx >= step && dx < width - step && dz >= -1 && dz <= depth) {
            return BLOCK.WOOD;
          }
        }
        // Chimney
        if (wy >= 9 && wy <= 18 && dx === 4 && dz === 3) return BLOCK.BRICK;
      }
      return -1;
    };

    const drawTownHall = (hx: number, hz: number, width: number, depth: number, isBlue: boolean) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy >= 5 && wy <= 18) {
          const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
          if (isWall) {
            if (wy === 5) return BLOCK.STONE;
            // Grand Entrance
            if (dz === 0 && dx >= Math.floor(width/2) - 1 && dx <= Math.floor(width/2) + 1 && wy <= 9) return BLOCK.AIR;
            // Large Windows
            if (wy >= 8 && wy <= 14 && (dx % 4 === 1 || dz % 4 === 1)) return BLOCK.GLASS;
            return BLOCK.STONE;
          } else {
            if (wy === 5 || wy === 12) return BLOCK.PLANKS; // Floors
            // Meeting Table
            if (wy === 6 && dx >= 3 && dx <= width - 4 && dz >= 4 && dz <= depth - 4) return BLOCK.WOOD;
            return BLOCK.AIR;
          }
        }
        // Roof
        if (wy >= 19 && wy <= 23) {
          const step = wy - 19;
          if (dx >= step && dx < width - step && dz >= step && dz < depth - step) {
            return BLOCK.WOOD;
          }
        }
        // Clock Tower
        if (wy > 23 && wy <= 30 && dx >= Math.floor(width/2) - 2 && dx <= Math.floor(width/2) + 2 && dz >= 2 && dz <= 6) {
           if (wy === 27 && dx === Math.floor(width/2) && dz === 2) return BLOCK.GLASS; // Clock face
           return BLOCK.STONE;
        }
      }
      return -1;
    };

    const drawMarket = (hx: number, hz: number, width: number, depth: number) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        if (wy === 5) return BLOCK.STONE; // Paved floor
        // Stalls
        if (wy >= 6 && wy <= 9) {
          const isStall = (dx >= 2 && dx <= 4 && dz >= 2 && dz <= 4) || 
                          (dx >= width - 5 && dx <= width - 3 && dz >= 2 && dz <= 4) ||
                          (dx >= 2 && dx <= 4 && dz >= depth - 5 && dz <= depth - 3) ||
                          (dx >= width - 5 && dx <= width - 3 && dz >= depth - 5 && dz <= depth - 3);
          if (isStall) {
            if (wy === 6) return BLOCK.WOOD; // Counter
            if (wy === 9) return BLOCK.PLANKS; // Awning
            // Poles
            if (wy > 6 && wy < 9 && ((dx===2||dx===4||dx===width-5||dx===width-3) && (dz===2||dz===4||dz===depth-5||dz===depth-3))) return BLOCK.WOOD;
          }
        }
      }
      return -1;
    };

    const drawMageTower = (hx: number, hz: number, width: number, depth: number, isBlue: boolean) => {
      const dx = wx - hx;
      const dz = wz - hz;
      if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
        const cx = Math.floor(width/2);
        const cz = Math.floor(depth/2);
        const distSq = (dx - cx) * (dx - cx) + (dz - cz) * (dz - cz);
        const radiusSq = (width/2) * (width/2);
        
        if (distSq <= radiusSq) {
          if (wy >= 5 && wy <= 28) {
            const isWall = distSq >= radiusSq - 3;
            if (isWall) {
              // Door
              if (dz === 0 && dx === cx && wy <= 7) return BLOCK.AIR;
              // Spiral Windows
              if ((wy + dx + dz) % 6 === 0) return BLOCK.GLASS;
              return BLOCK.BRICK;
            } else {
              // Floors every 6 blocks
              if (wy % 6 === 5) return BLOCK.PLANKS;
              // Spiral staircase
              if ((wy + dx) % 4 === 0 && distSq >= radiusSq - 6) return BLOCK.WOOD;
              return BLOCK.AIR;
            }
          }
          // Pointy Roof
          if (wy > 28 && wy <= 35) {
            const roofRadiusSq = Math.max(0, radiusSq - (wy - 28) * 2);
            if (distSq <= roofRadiusSq) return isBlue ? BLOCK.BLUE_STONE : BLOCK.RED_STONE;
          }
        }
      }
      return -1;
    };

    // Place buildings
    const buildings = isBlue ? [
      { type: 'tavern', x: -44, z: 137, w: 16, d: 14 },
      { type: 'blacksmith', x: 24, z: 137, w: 14, d: 12 },
      { type: 'farm', x: -44, z: 162, w: 16, d: 16 },
      { type: 'watchtower', x: 32, z: 167, w: 8, d: 8 },
      { type: 'library', x: 8, z: 137, w: 10, d: 10 },
      { type: 'bakery', x: -22, z: 162, w: 12, d: 12 },
      { type: 'townhall', x: -22, z: 137, w: 14, d: 14 },
      { type: 'market', x: 8, z: 162, w: 14, d: 14 },
      { type: 'magetower', x: 38, z: 147, w: 8, d: 8 },
    ] : [
      { type: 'tavern', x: -44, z: -151, w: 16, d: 14 },
      { type: 'blacksmith', x: 24, z: -149, w: 14, d: 12 },
      { type: 'farm', x: -44, z: -178, w: 16, d: 16 },
      { type: 'watchtower', x: 32, z: -175, w: 8, d: 8 },
      { type: 'library', x: 8, z: -147, w: 10, d: 10 },
      { type: 'bakery', x: -22, z: -174, w: 12, d: 12 },
      { type: 'townhall', x: -22, z: -151, w: 14, d: 14 },
      { type: 'market', x: 8, z: -176, w: 14, d: 14 },
      { type: 'magetower', x: 38, z: -155, w: 8, d: 8 },
    ];

    const villageOffset = isSkyCastles ? 169 : -70;
    for (const b of buildings) {
      const bZ = isBlue ? b.z + villageOffset : b.z - villageOffset;
      let res = -1;
      if (b.type === 'tavern') res = drawTavern(b.x, bZ, b.w, b.d);
      else if (b.type === 'blacksmith') res = drawBlacksmith(b.x, bZ, b.w, b.d);
      else if (b.type === 'farm') res = drawFarm(b.x, bZ, b.w, b.d);
      else if (b.type === 'watchtower') res = drawWatchtower(b.x, bZ, b.w, b.d);
      else if (b.type === 'library') res = drawLibrary(b.x, bZ, b.w, b.d, isBlue);
      else if (b.type === 'bakery') res = drawBakery(b.x, bZ, b.w, b.d);
      else if (b.type === 'townhall') res = drawTownHall(b.x, bZ, b.w, b.d, isBlue);
      else if (b.type === 'market') res = drawMarket(b.x, bZ, b.w, b.d);
      else if (b.type === 'magetower') res = drawMageTower(b.x, bZ, b.w, b.d, isBlue);
      
      if (res !== -1) return res;
    }

    // 3. Fountain in the middle
    const fountainZ = isBlue ? 155 + villageOffset : -(155 + villageOffset);
    const dx = wx - 0;
    const dz = wz - fountainZ;
    const distSq = dx * dx + dz * dz;
    if (distSq <= 16) {
      if (wy <= 4) return BLOCK.STONE;
      if (wy === 5) {
        if (distSq <= 4) return BLOCK.WATER;
        return BLOCK.STONE;
      }
      if (wy === 6) {
        if (distSq <= 1) return BLOCK.STONE; // Center pillar
        if (distSq >= 9) return BLOCK.STONE; // Rim
        return BLOCK.WATER;
      }
      if (wy >= 7 && wy <= 9 && distSq <= 1) return BLOCK.STONE; // Spout
    }

    return BLOCK.AIR;
  }
