
import { BLOCK } from '../TextureAtlas';

// Removed 'private' from signature
export function getGiantMythicalShipBlock(wx: number, wy: number, wz: number, isBlue: boolean): number {
    
    const shipCenterZ = 450;
        const centerZ = isBlue ? shipCenterZ : -shipCenterZ;
    
        const localX = wx;
        let localZ = wz - centerZ;
        if (!isBlue) {
            localZ = -localZ; 
        }
        const localY = wy - 100;
    
        // Early bounds checks
        if (localY < 30 || localY > 180) return BLOCK.AIR;      
    const absX = Math.abs(localX);

    // Ship limits: localZ from -130 (front bowsprit) to 75 (back)
    if (localZ < -130 || localZ > 75) return BLOCK.AIR;

    // Width curve
    let currentMaxWidth = 0;
    if (localZ < -30) { // Bow taper (sharp)
        currentMaxWidth = Math.max(0, 22 - Math.floor(Math.pow(localZ + 30, 2) / 160));
    } else if (localZ < 30) { // Mid body (belly)
        currentMaxWidth = 22 + Math.floor(Math.sin((localZ + 30) / 60 * Math.PI) * 4);
    } else { // Stern taper (blunt)
        currentMaxWidth = Math.max(0, 22 - Math.floor(Math.pow(localZ - 30, 2) / 100));
    }
    
    if (localZ > 65) currentMaxWidth = Math.max(0, 10 - Math.floor((localZ - 65) * 2)); // Flat-ish back

    if (currentMaxWidth < 0) return BLOCK.AIR;

    const baseDeckY = 72;
    const bottomY = 32;
    const primaryColor = isBlue ? BLOCK.LAPIS_BLOCK : BLOCK.REDSTONE_BLOCK; 
    const accentColor = BLOCK.GOLD_BLOCK;
    const secondaryColor = BLOCK.OBSIDIAN;
    const hullWood = BLOCK.DARK_OAK_PLANKS;
    const deckWood = BLOCK.SPRUCE_PLANKS;
    const brightColor = isBlue ? BLOCK.DIAMOND_BLOCK : BLOCK.REDSTONE_BLOCK; 
    const glassColor = isBlue ? BLOCK.GLASS_BLUE : BLOCK.GLASS_RED;

    let b = BLOCK.AIR;

    // --- HULL ---
    let effBottomY = bottomY;
    if (localZ < -30) {
        // Keel slopes up towards the bow to create a curved, realistic front profile
        effBottomY += Math.floor(Math.pow(Math.abs(localZ + 30) / 9.5, 2));
    }

    if (localY >= effBottomY && localY <= baseDeckY) {
        const depth = baseDeckY - localY;
        const taper = Math.floor(depth / 2.5);
        const curveTaper = Math.floor(Math.pow(depth / (baseDeckY - effBottomY + 1), 2) * 8); 
        const w = currentMaxWidth - taper - curveTaper - (localZ > 50 ? 1 : 0);

        if (w >= 0 && absX <= w) {
            const isDeck = localY === baseDeckY;
            const isOuter = absX === w || absX === w - 1; 
            const isFloor = localY === bottomY || localY === 45 || localY === 58; 

            if (absX >= w) {
                if (localY === baseDeckY || localY === baseDeckY - 1) b = secondaryColor; 
                else if (localY === 55 || localY === 56) b = primaryColor; 
                else if (localY % 10 === 0) b = accentColor; 
                else b = hullWood;

                if ((localY === 59 || localY === 46 || localY === 68) && localZ > -40 && localZ < 50 && localZ % 8 === 0) {
                    b = BLOCK.AIR;
                }
            } else if (isDeck) {
                if (absX === w - 1) b = accentColor;
                else b = deckWood;
            } else if (isOuter) {
                b = hullWood;
            } else if (isFloor) {
                b = deckWood;
            } else {
                if (localY === 58 + 1 && absX === 0 && localZ % 10 === 0) b = BLOCK.GLOWSTONE; 
                if (localZ === -30 || localZ === 30) {
                    if (absX < w - 2) {
                        if (absX < 2 && localY <= 65) b = BLOCK.AIR; 
                        else b = hullWood;
                    }
                }
            }
        }
        
        if (localY === 40 && absX === w + 1 && localZ % 15 === 0) {
            return brightColor;
        }

        if ((localY === 59 || localY === 46 || localY === 68) && absX === w + 1 && localZ > -40 && localZ < 50 && localZ % 8 === 0) {
            return BLOCK.IRON_BLOCK;
        }
        if ((localY === 59 || localY === 46 || localY === 68) && absX === w + 2 && localZ > -40 && localZ < 50 && localZ % 8 === 0) {
            return BLOCK.OBSIDIAN;
        }
        
        if (localY >= 60 && localY <= 65 && localZ > -20 && localZ < 20) {
            const finWidth = w + Math.floor(Math.sin((localZ + 20) / 40 * Math.PI) * 12);
            if (absX > w && absX <= finWidth) {
                if (absX === finWidth) return accentColor;
                if ((localZ + localX + localY) % 3 === 0) {
                    return glassColor || BLOCK.GLASS;
                }
                return primaryColor;
            }
        }
        
        if (b !== BLOCK.AIR) return b;
    }

    // --- UPPE DECK ARCHITECTURE ---
    
    const foreDeckY = baseDeckY + 6;
    if (localZ <= -70 && localY > baseDeckY && localY <= foreDeckY) {
        const fw = currentMaxWidth - Math.floor((localY - baseDeckY) / 2);
        if (fw >= 0 && absX <= fw) {
            
            // Stairs to the foredeck
            if (localZ >= -75 && localZ <= -70 && absX <= 2) {
                const step = -70 - localZ; // 0 to 5
                if (localY <= baseDeckY + step + 1) {
                    if (localY === baseDeckY + step + 1) return deckWood;
                    return BLOCK.AIR; 
                }
            }

            if (localY === foreDeckY) return deckWood;
            if (absX === fw || absX === fw - 1) return hullWood;
            if (localZ === -70) return hullWood; // Close the wall behind stairs 
        }
    }
    if (localZ <= -70 && localY === foreDeckY + 1) {
        const fw = currentMaxWidth - 3;
        if (absX === fw || localZ === -70) {
            if (absX % 3 === 0) return accentColor;
            return secondaryColor;
        }
    }

    const aftBaseZ = 35;
    const aftDeck1Y = baseDeckY + 10;
    const aftDeck2Y = baseDeckY + 20;

    // Stairs up to Aft Deck 1
    if (localZ >= aftBaseZ - 10 && localZ < aftBaseZ && absX <= 2 && localY > baseDeckY && localY <= aftDeck1Y) {
        const step = localZ - (aftBaseZ - 10); // 0 to 9
        if (localY <= baseDeckY + step + 1) {
            if (localY === baseDeckY + step + 1) return deckWood;
            return BLOCK.AIR;
        }
    }

    if (localZ >= aftBaseZ && localY > baseDeckY) {
        let cw = currentMaxWidth - 2;
        
        if (localY <= aftDeck1Y) {
            cw = currentMaxWidth - 1;
        } else if (localY <= aftDeck2Y && localZ >= aftBaseZ + 10) {
            cw = currentMaxWidth - 3;
        } else {
            cw = -1; 
        }

        if (cw >= 0 && absX <= cw) {
            const isDeck1 = localY === aftDeck1Y;
            const isDeck2 = localY === aftDeck2Y;
            const isWall = absX === cw || localZ === aftBaseZ || (localY > aftDeck1Y ? localZ === aftBaseZ + 10 : false) || localZ > 70;

            if (isWall && localY < aftDeck2Y) {
                if (localY >= baseDeckY + 3 && localY <= baseDeckY + 7 && (absX === cw || localZ > 70) && localZ % 4 !== 0 && absX % 4 !== 0) {
                    return brightColor; 
                }
                if (localY >= aftDeck1Y + 3 && localY <= aftDeck1Y + 7 && (absX === cw || localZ > 70) && localZ % 4 !== 0 && absX % 4 !== 0) {
                    return brightColor;
                }
                
                if (localY % 5 === 0) return primaryColor;
                return secondaryColor;
            } else if (isDeck1 || isDeck2) {
                if (absX === cw) return accentColor;
                return deckWood;
            } else {
                return BLOCK.AIR; 
            }
        }
        
        if (localY === aftDeck1Y + 1 && localZ >= aftBaseZ && localZ < aftBaseZ + 10) {
            if (absX === currentMaxWidth - 2 || localZ === aftBaseZ) return secondaryColor;
        }
        if (localY === aftDeck2Y + 1 && localZ >= aftBaseZ + 10) {
            if (absX === currentMaxWidth - 4 || localZ === aftBaseZ + 10) return secondaryColor;
        }
    }

    // --- DETAILS ---

    if (localZ < -80 && localZ > -125) {
        // Angled bowsprit pole projecting off the front of the ship
        const poleY = baseDeckY + 6 + Math.floor((-80 - localZ) / 2.0);
        if (localY === poleY && absX <= 1) return secondaryColor; 
        if (localY === poleY - 1 && absX <= 1) return accentColor; 
        if (localY === poleY - 2 && absX === 0) return brightColor;
        
        // Front Figurehead and support straps
        if (localZ === -90 || localZ === -100) { 
            if (localY >= poleY && localY <= poleY + 3 && absX <= 2) return primaryColor;
            if (localY === poleY + 4 && absX <= 2) return accentColor;
            if (localY === poleY + 5 && absX === 0) return BLOCK.GOLD_BLOCK;
        }
    }

    const mastPositions = [
        { z: -35, height: 60, crowsNestY: 45 }, 
        { z: 0, height: 75, crowsNestY: 55 },   
        { z: 35, height: 50, crowsNestY: 35 }   
    ];

    for (const mast of mastPositions) {
        const yTop = baseDeckY + mast.height;
        
        if (localZ >= mast.z - 2 && localZ <= mast.z + 2 && absX <= 2 && localY > baseDeckY && localY <= yTop) {
            const mastThickness = localY > baseDeckY + 30 ? 1 : 2;
            if (localZ >= mast.z - mastThickness && localZ <= mast.z + mastThickness && absX <= mastThickness) {
                return secondaryColor;
            }
        }
        
        const cnY = baseDeckY + mast.crowsNestY;
        if (localY >= cnY && localY <= cnY + 2 && localZ >= mast.z - 4 && localZ <= mast.z + 4 && absX <= 4) {
            if (localY === cnY) return deckWood; 
            if (absX === 4 || localZ === mast.z - 4 || localZ === mast.z + 4) return secondaryColor; 
            return BLOCK.AIR;
        }

        if (localY > yTop && localY <= yTop + 3 && localZ >= mast.z && localZ <= mast.z + 8 && absX === 0) {
            if (localZ === mast.z) return secondaryColor; 
            if ((localY + localZ) % 3 === 0) return accentColor;
            return primaryColor;
        }

        const sailTiers = [
            { sy: baseDeckY + 10, syTop: baseDeckY + Math.min(30, mast.height - 15), maxW: 24 },
            { sy: baseDeckY + 35, syTop: baseDeckY + Math.min(50, mast.height - 5), maxW: 18 },
            { sy: baseDeckY + 55, syTop: baseDeckY + Math.min(65, mast.height - 2), maxW: 12 }
        ];

        for (const tier of sailTiers) {
            if (localY >= tier.sy && localY <= tier.syTop && mast.height > (tier.sy - baseDeckY)) {
                
                if (localY === tier.syTop && localZ === mast.z + 1 && absX <= tier.maxW + 2) {
                    return hullWood;
                }
                if (localY === tier.syTop - 1 && localZ === mast.z + 1 && (absX === tier.maxW || absX === Math.floor(tier.maxW / 2))) {
                    return BLOCK.GLOWSTONE;
                }

                const midY = (tier.sy + tier.syTop) / 2;
                const hBillow = Math.sin((localY - tier.sy) / (tier.syTop - tier.sy) * Math.PI); 
                const sailZ = mast.z + 1 - Math.floor(hBillow * 8); 
                
                const sailWidth = Math.floor(tier.maxW * (1 - Math.abs(localY - midY) / ((tier.syTop - tier.sy) * 1.5)));

                if (localZ >= sailZ - 1 && localZ <= sailZ + 1 && absX <= sailWidth) {
                    if (absX === sailWidth || localY === tier.sy || localY === tier.syTop) return accentColor;
                    
                    if (absX % 7 === 0 || (localY - baseDeckY) % 6 === 0) {
                        return brightColor;
                    }

                    return glassColor || BLOCK.GLASS;
                }
            }
        }
    }
    
    if (localY === aftDeck2Y + 1 && localZ === aftBaseZ + 15 && absX <= 1) return BLOCK.DARK_OAK_LOG;
    if (localY === aftDeck2Y + 2 && localZ === aftBaseZ + 15 && localX === 0) return accentColor;

    if (localY === baseDeckY + 1 && (absX === currentMaxWidth || absX === currentMaxWidth - 1) && localZ % 5 === 0 && localZ > -40 && localZ < 30) {
        return brightColor;
    }

    return BLOCK.AIR;
  
}
