import { ItemType } from '../Inventory';

export function getVoidTrailBlock(x: number, y: number, z: number): number {
  if (y < -20 || y > 100) return ItemType.AIR;
  
  const fy = Math.floor(y);
  
  let baseBlock: number = ItemType.AIR;

  // Floor / Island
  const distSq = x * x + z * z;
  if (fy <= 0 && fy >= -10) {
     const maxR = 80 + fy; // Taper off (70 to 80)
     if (distSq <= maxR * maxR) {
        if (fy === 0) {
           // Paths
           if (Math.abs(x) < 5 || Math.abs(z) < 5) baseBlock = ItemType.STONE;
           else baseBlock = ItemType.GRASS;
        } else if (fy > -3) {
            baseBlock = ItemType.DIRT;
        } else {
            baseBlock = ItemType.STONE;
        }
     }
  }

  if (baseBlock === ItemType.AIR && fy >= 0) {
      // Castle Bounding Box
      if (Math.abs(x) <= 40 && Math.abs(z) <= 40) {
        const inKeep = Math.abs(x) <= 20 && Math.abs(z) <= 20;
        const isOuterWall = (Math.abs(x) >= 36 && Math.abs(x) <= 40) || (Math.abs(z) >= 36 && Math.abs(z) <= 40);

        // 4 Corner Towers
        const cx = x > 0 ? 35 : -35;
        const cz = z > 0 ? 35 : -35;
        const tdistSq = (x - cx)**2 + (z - cz)**2;
        const r1 = 6;
        const r2 = 4;

        if (tdistSq <= r1 * r1) {
          if (fy <= 30) {
            if (tdistSq >= r2 * r2) {
               if (fy > 0 && fy % 5 === 0 && (x === cx || z === cz)) baseBlock = ItemType.GLASS;
               else baseBlock = ItemType.STONE;
            } else {
               if (fy === 30) baseBlock = ItemType.STONE; // roof of tower
               else if (fy % 10 === 0) baseBlock = ItemType.PLANKS; // floors in tower
               else {
                 // Spiral staircase logic
                 const angle = Math.atan2(z - cz, x - cx);
                 const normalizedAngle = (angle + Math.PI) / (Math.PI * 2);
                 const heightMod = (fy % 10) / 10;
                 if (Math.abs(normalizedAngle - heightMod) < 0.15) {
                     baseBlock = ItemType.WOOD;
                 }
               }
            }
          } else if (fy > 30 && fy <= 45) { // Spires on towers
            const spR = 6 - (fy - 30) * 0.4;
            if (tdistSq <= spR * spR) {
              baseBlock = ItemType.BLUE_STONE;
            }
          }
        }

        // Outer Walls (excluding towers)
        if (baseBlock === ItemType.AIR && isOuterWall && tdistSq > r1 * r1) {
           const isGate = Math.abs(x) < 4 || Math.abs(z) < 4;
           if (fy <= 12) {
              if (!(isGate && fy <= 8)) baseBlock = ItemType.STONE;
           } else if (fy === 13) {
              if (!isGate && (Math.abs(x) + Math.abs(z)) % 2 === 0) baseBlock = ItemType.STONE;
           }
        }

        // Central Keep
        if (baseBlock === ItemType.AIR && inKeep) {
          const isKeepWall = Math.abs(x) === 20 || Math.abs(z) === 20;
          if (fy <= 40) {
             if (isKeepWall) {
                const isKeepGate = Math.abs(x) < 3 || Math.abs(z) < 3;
                if (!(isKeepGate && fy <= 6)) {
                   if (fy > 0 && fy % 10 === 5 && Math.abs(Math.abs(x) - 10) < 3) baseBlock = ItemType.GLASS;
                   else if (fy > 0 && fy % 10 === 5 && Math.abs(Math.abs(z) - 10) < 3) baseBlock = ItemType.GLASS;
                   else baseBlock = ItemType.BRICK;
                }
             } else if (fy > 0 && fy % 10 === 0) {
                // Leave hole for stairs
                if (!(Math.abs(x) < 4 && Math.abs(z) < 10)) baseBlock = ItemType.PLANKS;
             } else if (Math.abs(x) < 4 && Math.abs(z) < 10) { // Grand staircase
               const stairY = 10 - Math.abs(z); // slope up towards center
               if (fy % 10 === stairY) baseBlock = ItemType.WOOD;
             } else if (fy % 10 === 9 && x === 0 && z === 0) {
               // Chandeliers
               baseBlock = ItemType.GLOWSTONE;
             }
           } else if (fy > 40 && fy <= 55) { // Keep Roof (Pyramid)
             const roofScale = 20 - (fy - 40) * 1.33;
             if (Math.abs(x) <= roofScale && Math.abs(z) <= roofScale) {
               if (Math.abs(x) >= roofScale - 1 || Math.abs(z) >= roofScale - 1) {
                 baseBlock = ItemType.OBSIDIAN;
               }
             }
           } else if (Math.abs(x) <= 4 && Math.abs(z) <= 4 && fy > 40 && fy <= 80) { // Central Spire Structure
             const spireR = 4 - (fy - 55) * 0.15;
             if (Math.max(Math.abs(x), Math.abs(z)) <= spireR) {
                if ((x + z + fy) % 4 === 0) baseBlock = ItemType.GLOWSTONE;
                else baseBlock = ItemType.BLUE_STONE;
             }
           }
        }

        // Fountains in Courtyard
        if (baseBlock === ItemType.AIR && fy <= 6 && !inKeep && !isOuterWall && tdistSq > r1*r1) { 
           const cX = [28, -28];
           const cZ = [28, -28];
           for(let fX of cX) {
             for(let fZ of cZ) {
                if (Math.abs(x - fX) <= 3 && Math.abs(z - fZ) <= 3) {
                   if (fy === 0) baseBlock = ItemType.STONE;
                   else if (fy === 1) {
                      if (Math.abs(x - fX) >= 2 || Math.abs(z - fZ) >= 2) baseBlock = ItemType.SLAB_STONE;
                      else baseBlock = ItemType.WATER;
                   }
                   else if (fy <= 5 && x === fX && z === fZ) baseBlock = ItemType.STONE;
                   else if (fy === 5 && Math.abs(x - fX) <= 1 && Math.abs(z - fZ) <= 1) baseBlock = ItemType.WATER;
                }
             }
           }
        }
      }
      
      // Path lights
      if (baseBlock === ItemType.AIR && fy === 1 && Math.abs(x) < 5 && Math.abs(z) < 5 && (Math.abs(x) === 4 || Math.abs(z) === 4) && Math.abs(x+z) % 6 === 0) {
          if (Math.abs(x) > 20 || Math.abs(z) > 20) {
              baseBlock = ItemType.TORCH;
          }
      }
  }

  if (baseBlock !== ItemType.AIR) {
    if (
        baseBlock === ItemType.WATER || 
        baseBlock === ItemType.GLASS || 
        baseBlock === ItemType.GLOWSTONE || 
        baseBlock === ItemType.TORCH || 
        baseBlock === ItemType.WATER_1
    ) {
        return baseBlock;
    }

    // Determine random color
    // white: 60%, black: 5%, hotpink: 15%, purple: 10%, limegreen: 5%, magenta: 5%
    // To make it consistent per 2x2x2 block area, floor coordinates divided by 2
    const gX = Math.floor(x / 2);
    const gY = Math.floor(y / 2);
    const gZ = Math.floor(z / 2);
    const hash = Math.abs(Math.sin(gX * 12.9898 + gY * 78.233 + gZ * 37.719) * 43758.5453) % 1;
    
    if (hash < 0.60) return ItemType.CONCRETE_WHITE;
    if (hash < 0.65) return ItemType.CONCRETE_BLACK;
    if (hash < 0.80) return ItemType.CONCRETE_PINK;
    if (hash < 0.90) return ItemType.CONCRETE_PURPLE;
    if (hash < 0.95) return ItemType.CONCRETE_LIME;
    return ItemType.CONCRETE_MAGENTA;
  }

  return ItemType.AIR;
}
