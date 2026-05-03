
import * as THREE from 'three';
import { BLOCK } from '../TextureAtlas';

export function getCastleBlock(wx: number, wy: number, wz: number, zOffset: number, accentBlock: number, isSkyCastles: boolean = false, queuedMobs: { type: string, pos: THREE.Vector3 }[] | null = null): number {
    
    const localZ = wz - zOffset;

    // 1. Towers at corners (+-30, +-30)
    const isTower = (cx: number, cz: number) => {
      const dx = wx - cx;
      const dz = localZ - cz;
      const distSq = dx * dx + dz * dz;
      
      if (distSq <= 25 && wy <= 30) {
        if (distSq >= 16) {
          // Arrow slits
          if (wy > 10 && wy < 25 && wy % 5 >= 2 && wy % 5 <= 3 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1)) {
            return BLOCK.AIR;
          }
          // Tower battlements
          if (wy === 30 && ((wx + localZ) % 2 !== 0)) return BLOCK.AIR;
          return wy >= 28 ? accentBlock : BLOCK.STONE;
        }
        if (wy % 10 === 0 && wy > 5) return BLOCK.WOOD;
        return BLOCK.AIR;
      }
      
      // Pointed Roof
      if (wy > 30 && wy <= 45) {
        const roofRadiusSq = 25 - (wy - 30) * 1.8;
        if (distSq <= roofRadiusSq) {
          return accentBlock;
        }
      }
      return -1;
    };

    const t1 = isTower(-30, -30); if (t1 !== -1) return t1;
    const t2 = isTower(-30, 30);  if (t2 !== -1) return t2;
    const t3 = isTower(30, -30);  if (t3 !== -1) return t3;
    const t4 = isTower(30, 30);   if (t4 !== -1) return t4;

    // 2. Outer Walls and Details (x = +-31, z = +-31)
    if (wx >= -31 && wx <= 31 && localZ >= -31 && localZ <= 31) {
      const isWallX = (wx === -30 || wx === 30) && localZ >= -30 && localZ <= 30;
      const isWallZ = (localZ === -30 || localZ === 30) && wx >= -30 && wx <= 30;
      const isOuterEdgeX = (wx === -31 || wx === 31) && localZ > -30 && localZ < 30;
      const isOuterEdgeZ = (localZ === -31 || localZ === 31) && wx > -30 && wx < 30;
      
      if (isWallX || isWallZ) {
        if (wy <= 15) {
          // Gatehouse holes (Front and Back)
          const frontGateZ = zOffset > 0 ? -30 : 30;
          const backGateZ = zOffset > 0 ? 30 : -30;
          if ((localZ === frontGateZ || localZ === backGateZ) && wx >= -4 && wx <= 4 && wy <= 10) {
            // Add iron bars (glass) at the top of the gate
            if (wy >= 8 && wy <= 10 && wx % 2 === 0) return BLOCK.GLASS;
            return BLOCK.AIR;
          }
          
          // Battlements
          if (wy === 15) {
            if (isWallZ && wx % 2 !== 0) return BLOCK.AIR;
            if (isWallX && localZ % 2 !== 0) return BLOCK.AIR;
            return accentBlock;
          }
          
          if ((wx + wy + localZ) % 11 === 0) return BLOCK.BRICK;
          return BLOCK.STONE;
        }
      }
      
      // Buttresses and Banners on the outside
      if (isOuterEdgeX || isOuterEdgeZ) {
        if (wy <= 14) {
          const isFrontOrBack = (localZ === (zOffset > 0 ? -31 : 31));
          if (isFrontOrBack && wx >= -6 && wx <= 6) return -1;
          
          // Buttresses
          if ((isOuterEdgeX && localZ % 6 === 0) || (isOuterEdgeZ && wx % 6 === 0)) {
            return BLOCK.STONE;
          }
          
          // Banners
          if (wy >= 8 && wy <= 13) {
            if ((isOuterEdgeX && localZ % 10 === 5) || (isOuterEdgeZ && wx % 10 === 5)) {
              return accentBlock;
            }
          }
        }
      }
    }

    // 3. The Keep (Center building)
    if (wx >= -14 && wx <= 14 && localZ >= -14 && localZ <= 14) {
      // Keep Corner Turrets
      const isKeepTurret = (cx: number, cz: number) => {
        const dx = wx - cx;
        const dz = localZ - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq <= 9 && wy >= 20 && wy <= 45) {
          if (wy > 40) {
             const roofRadiusSq = 9 - (wy - 40) * 2;
             if (distSq <= roofRadiusSq) return accentBlock;
             return -1;
          }
          if (distSq >= 4) {
             if (wy === 40 && ((wx + localZ) % 2 !== 0)) return BLOCK.AIR;
             return BLOCK.STONE;
          }
          return BLOCK.AIR;
        }
        return -1;
      };
      
      const kt1 = isKeepTurret(-12, -12); if (kt1 !== -1) return kt1;
      const kt2 = isKeepTurret(-12, 12);  if (kt2 !== -1) return kt2;
      const kt3 = isKeepTurret(12, -12);  if (kt3 !== -1) return kt3;
      const kt4 = isKeepTurret(12, 12);   if (kt4 !== -1) return kt4;

      if (wx >= -12 && wx <= 12 && localZ >= -12 && localZ <= 12) {
        const isKeepWall = wx === -12 || wx === 12 || localZ === -12 || localZ === 12;
        const dx = wx;
        const dz = localZ;
        const distSq = dx * dx + dz * dz;

        // Main Keep Body
        if (wy <= 40) {
          if (isKeepWall) {
            // Keep Entrance
            const keepGateZ = zOffset > 0 ? -12 : 12;
            if (localZ === keepGateZ && wx >= -3 && wx <= 3 && wy <= 10) return BLOCK.AIR;
            
            // Grand Windows
            if (wy > 10 && wy % 10 >= 3 && wy % 10 <= 7 && (wx % 4 === 0 || localZ % 4 === 0)) {
              if (wy % 10 === 7) return accentBlock;
              return BLOCK.GLASS;
            }
            
            if ((wx + wy + localZ) % 7 === 0) return BLOCK.BRICK;
            return BLOCK.STONE;
          } else {
            // Inside the keep
            
            // Roof of the keep
            if (wy === 40) {
               const stairAngle = Math.atan2(dz, dx);
               let normalizedStairAngle = stairAngle >= 0 ? stairAngle : stairAngle + Math.PI * 2;
               const stepIndex = Math.floor((normalizedStairAngle / (Math.PI * 2)) * 20);
               if (distSq > 4 && distSq <= 49 && (stepIndex >= 18 || stepIndex <= 0)) {
                 // Let it fall through
               } else {
                 return BLOCK.STONE;
               }
            }

            // Floors
            if (wy > 5 && wy % 10 === 0 && wy < 40) {
              if (distSq > 49) return BLOCK.WOOD; 
            }

            // Central Pillar
            if (distSq <= 4) return BLOCK.STONE;

              // Spiral Stairs (Radius 3 to 7) - Slab ordered for faster climb
              if (distSq > 4 && distSq <= 49) {
                const stairAngle = Math.atan2(dz, dx);
                let normalizedStairAngle = stairAngle >= 0 ? stairAngle : stairAngle + Math.PI * 2;
                // 40 steps per rotation (20 full blocks height)
                const stepIndex = Math.floor((normalizedStairAngle / (Math.PI * 2)) * 40);
                const relativeHeight2 = (wy - 5) * 2; // Start from ground floor (wy=5)
                
                // Use modulo to repeat the spiral all the way up
                if (relativeHeight2 % 40 === stepIndex) {
                  return BLOCK.SLAB_WOOD;
                }
                if ((relativeHeight2 + 1) % 40 === stepIndex) {
                  return BLOCK.PLANKS;
                }
              }

            return BLOCK.AIR;
          }
        }
        
        // Keep Battlements and Top Room
        if (wy > 40 && wy <= 60) {
          if (isKeepWall && wy === 41) {
            // Keep battlements
            if ((localZ === -12 || localZ === 12) && wx % 2 !== 0) return BLOCK.AIR;
            if ((wx === -12 || wx === 12) && localZ % 2 !== 0) return BLOCK.AIR;
            return accentBlock;
          }

          // Circular tower
          if (distSq <= 100) {
            const isTowerWall = distSq >= 81;
            
            if (wy <= 55) {
              if (isTowerWall) {
                // Door to battlements
                if (wy >= 41 && wy <= 43 && dz >= 8 && Math.abs(dx) <= 1) return BLOCK.AIR;
                
                // Windows
                if (wy >= 44 && wy <= 48 && (Math.abs(dx) <= 1 || Math.abs(dz) <= 1)) return BLOCK.GLASS;
                return BLOCK.STONE;
              } else {
                // Inside Top Room
                // Pedestal
                if (wy === 41 && distSq <= 9) return BLOCK.STONE;
                
                // Dragon Egg / Morvane Guardian
                const dy = wy - 45;
                if (distSq + (dy * 0.8) * (dy * 0.8) <= 12) {
                  if (isSkyCastles) {
                    // Trigger spawn at the center of the egg area
                    if (wx === 0 && localZ === 0 && wy === 44 && queuedMobs) {
                      const worldY = wy + 60;
                      queuedMobs.push({ type: 'Morvane', pos: new THREE.Vector3(wx + 0.5, worldY, wz + 0.5) });
                    }
                    return BLOCK.AIR;
                  }
                  return (wy + dx + dz) % 3 === 0 ? BLOCK.GLASS : accentBlock;
                }
                
                return BLOCK.AIR;
              }
            } else {
              // Dome Roof
              const roofRadiusSq = 100 - (wy - 55) * 10;
              if (distSq <= roofRadiusSq) {
                return accentBlock;
              }
            }
          }
        }
      }
    }

    // 4. Fountain in the courtyard
    const fountainZ = zOffset > 0 ? -18 : 18;
    const dxF = wx;
    const dzF = localZ - fountainZ;
    const distSqF = dxF * dxF + dzF * dzF;

    if (distSqF <= 16 && wy >= 5 && wy <= 12) {
      if (wy <= 6) return BLOCK.STONE; // Base
      if (wy === 7) {
        if (distSqF <= 1) return BLOCK.STONE; // Center pillar
        if (distSqF >= 9) return BLOCK.STONE; // Rim
        return BLOCK.WATER;
      }
      if (wy >= 8 && wy <= 10 && distSqF <= 1) return BLOCK.STONE; // Spout
      if (wy === 11 && distSqF <= 4) return BLOCK.STONE; // Top basin
      if (wy === 12 && distSqF <= 1) return BLOCK.WATER; // Water source
    }

    // 5. Courtyard Paths and Details
    if (wy === 5 || wy === 6) {
      // Path from gate to keep
      const gateZ = zOffset > 0 ? -30 : 30;
      const keepGateZ = zOffset > 0 ? -12 : 12;
      const minZ = Math.min(gateZ, keepGateZ);
      const maxZ = Math.max(gateZ, keepGateZ);
      
      if (wx >= -4 && wx <= 4 && localZ >= minZ && localZ <= maxZ) {
        if (wy === 5) return (wx + localZ) % 2 === 0 ? BLOCK.STONE : BLOCK.BRICK;
        return BLOCK.AIR;
      }
      
      // Random decorative bushes
      if (Math.abs(wx) > 5 && Math.abs(localZ) > 15 && Math.abs(wx) < 25 && Math.abs(localZ) < 25) {
         if ((wx * 13 + localZ * 7) % 100 > 95) return BLOCK.LEAVES;
         if (wy === 5 && (wx * 17 + localZ * 11) % 100 > 98) return BLOCK.WOOD; // Small tree trunks
      }
    }

    return BLOCK.AIR;
  
}
