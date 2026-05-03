import * as THREE from 'three';
import { ITEM_COLORS } from './Constants';

import { ItemType } from './Inventory';
export const BLOCK = ItemType as any;

export const ATLAS_TILES = 32;

export const isWater = (blockType: number) => {
  return blockType === BLOCK.WATER || (blockType >= BLOCK.WATER_1 && blockType <= BLOCK.WATER_7);
};

export const isLava = (blockType: number) => {
  return blockType === BLOCK.LAVA;
};

// Generate a simple texture atlas
export function createTextureAtlas(): THREE.Texture {
  const canvas = document.createElement('canvas');
  const size = 16;
  const tiles = ATLAS_TILES; // 8x8 atlas
  canvas.width = size * tiles;
  canvas.height = size * tiles;
  const ctx = canvas.getContext('2d')!;

  // Helper to draw a tile
  const drawTile = (x: number, y: number, color: string, noiseColor: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);
    
    // Add more noise for a detailed look
    ctx.fillStyle = noiseColor;
    for (let i = 0; i < 40; i++) {
      const nx = x * size + Math.random() * size;
      const ny = y * size + Math.random() * size;
      ctx.fillRect(nx, ny, 1, 1);
    }
  };

  // 0,0: Dirt
  drawTile(0, 0, (ITEM_COLORS[BLOCK.DIRT] || '#5c4033'), '#3d2b22');
  // 1,0: Grass top (Refined with clovers and pebbles)
  drawTile(1, 0, (ITEM_COLORS[BLOCK.GRASS] || '#41980a'), '#2d6a07');
  ctx.fillStyle = '#4fa81a'; // Lighter spots
  for(let i=0; i<5; i++) ctx.fillRect(1 * size + Math.random()*14, Math.random()*14, 2, 2);
  ctx.fillStyle = '#ffffff66'; // Tiny white flowers/pebbles
  for(let i=0; i<3; i++) ctx.fillRect(1 * size + Math.random()*15, Math.random()*15, 1, 1);
  ctx.fillStyle = '#2d6a0766'; // Occasional clover shape
  for(let i=0; i<2; i++) {
     const cx = 1 * size + 4 + Math.random()*8;
     const cy = 4 + Math.random()*8;
     ctx.fillRect(cx, cy, 2, 1); ctx.fillRect(cx + 0.5, cy - 0.5, 1, 2);
  }
  // 2,0: Grass side
  drawTile(2, 0, (ITEM_COLORS[BLOCK.DIRT] || '#5c4033'), '#3d2b22');
  ctx.fillStyle = (ITEM_COLORS[BLOCK.GRASS] || '#41980a');
  ctx.fillRect(2 * size, 0, size, size * 0.3); // Grass on top
  // 3,0: Stone
  drawTile(3, 0, (ITEM_COLORS[BLOCK.FURNACE] || '#7d7d7d'), '#5a5a5a');
  
  // 0,1: Wood side
  drawTile(0, 1, (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'), '#4a3318');
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811');
  ctx.fillRect(0 * size + 4, 1 * size, 2, size);
  ctx.fillRect(0 * size + 10, 1 * size, 2, size);
  // 1,1: Wood top
  drawTile(1, 1, (ITEM_COLORS[BLOCK.CRAFTING_TABLE] || '#8f6b42'), (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'));
  ctx.strokeStyle = '#4a3318';
  ctx.beginPath(); ctx.arc(1.5*size, 1.5*size, 4, 0, Math.PI*2); ctx.stroke();
  
  // 2,1: Leaves
  drawTile(2, 1, (ITEM_COLORS[BLOCK.LEAVES] || '#2d6a14'), '#1e4a0d');
  
  // 3,1: Sand
  drawTile(3, 1, '#dbca98', '#c9b784');

  // 0,2: Water
  ctx.fillStyle = 'rgba(63, 118, 228, 0.75)'; 
  ctx.fillRect(0 * size, 2 * size, size, size);
  
  // 1,2: Glass
  ctx.clearRect(1 * size, 2 * size, size, size);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(1 * size, 2 * size, size, size);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.strokeRect(1 * size + 1, 2 * size + 1, size - 2, size - 2);
  ctx.beginPath();
  ctx.moveTo(1*size + 4, 2*size + 4); ctx.lineTo(1*size + 6, 2*size + 6);
  ctx.moveTo(1*size + 10, 2*size + 10); ctx.lineTo(1*size + 12, 2*size + 12);
  ctx.stroke();

  // 2,2: Brick
  drawTile(2, 2, '#964b00', '#7a3d00');
  ctx.fillStyle = '#ffffff33';
  ctx.fillRect(2 * size, 2 * size + 7, size, 1);
  ctx.fillRect(2 * size + 7, 2 * size, 1, size);

  // 0,3: Blue Stone (Mithril-like)
  drawTile(0, 3, '#4facfe', '#00f2fe');
  // 1,3: Red Stone (Ruby-like)
  drawTile(1, 3, '#ff0844', '#ffb199');
  // 2,3: Planks
  drawTile(2, 3, '#9c7c5c', '#7c5c3c');
  ctx.fillStyle = '#00000022';
  for(let i=0; i<4; i++) ctx.fillRect(2 * size, 3 * size + i*4, size, 1);
  ctx.fillRect(2 * size + 8, 3 * size, 1, size);
  // 3,2: Snow
  drawTile(3, 2, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#e0e0e0');

  // 3,3: Stick (Item only)
  ctx.clearRect(3 * size, 3 * size, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
  for (let i = 2; i < 14; i++) ctx.fillRect(3 * size + i, 3 * size + 15 - i, 2, 2);

  // --- NEW BLOCKS ---
  // 4,0: Tall Grass (Refined Blade approach)
  ctx.clearRect(4 * size, 0, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.GRASS] || '#41980a');
  for(let i=0; i<12; i++) {
    const rx = 1 + (i * 1.2) % 14;
    const rh = 6 + (Math.sin(i * 1.5) * 4) + 6;
    ctx.fillStyle = i % 2 === 0 ? (ITEM_COLORS[BLOCK.GRASS] || '#41980a') : '#2d6a07'; // Shaded blades
    ctx.fillRect(4 * size + rx, size - rh, 2, rh);
  }

  // 5,0: Flower Red (Refined Petals)
  ctx.clearRect(5 * size, 0, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.LEAVES] || '#2d6a14'); // Stem
  ctx.fillRect(5 * size + 7, 10, 2, 6);
  ctx.fillStyle = '#990000'; // Darker petal base
  ctx.fillRect(5 * size + 4, 6, 8, 4);
  ctx.fillRect(5 * size + 6, 4, 4, 8);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'); // Bright Petals
  ctx.fillRect(5 * size + 5, 5, 6, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.FLOWER_YELLOW] || '#ffcc00'); // Yellow center
  ctx.fillRect(5 * size + 7, 7, 2, 2);

  // 6,0: Flower Yellow (Refined Dandelion)
  ctx.clearRect(6 * size, 0, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.LEAVES] || '#2d6a14');
  ctx.fillRect(6 * size + 7, 10, 2, 6);
  ctx.fillStyle = '#ccaa00'; // Shaded petals
  ctx.beginPath(); ctx.arc(6 * size + 8, 7, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffdf00'; // Bright Petals
  ctx.beginPath(); ctx.arc(6 * size + 8, 7, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff88'; // Highlights
  ctx.fillRect(6 * size + 6, 5, 1, 1);
  ctx.fillRect(6 * size + 9, 6, 1, 1);

  // 7,0: Tall Dark Green Grass (Refined long blades)
  ctx.clearRect(7 * size, 0, size, size);
  ctx.fillStyle = '#1a3a1a';
  for(let i=0; i<10; i++) {
    const xOff = 2 + (i * 1.3) % 12;
    const h = 12 + Math.sin(i * 0.7) * 4;
    ctx.fillStyle = i % 2 === 0 ? '#1a3a1a' : '#2d4a2d';
    ctx.fillRect(7 * size + xOff, size - h, 2, h);
  }

  // 4,1: Birch Log Side
  drawTile(4, 1, (ITEM_COLORS[BLOCK.BIRCH_LOG] || '#d7d7d7'), '#b0b0b0');
  ctx.fillStyle = '#333333';
  for(let i=0; i<5; i++) ctx.fillRect(4 * size + Math.random()*12, 1 * size + Math.random()*16, 3, 1);

  // 5,1: Birch Log Top
  drawTile(5, 1, (ITEM_COLORS[BLOCK.IRON_SHOVEL] || '#e8e8e8'), (ITEM_COLORS[BLOCK.BIRCH_LOG] || '#d7d7d7'));
  ctx.strokeStyle = '#b0b0b0';
  ctx.beginPath(); ctx.arc(5.5*size, 1.5*size, 4, 0, Math.PI*2); ctx.stroke();

  // 6,1: Birch Leaves
  drawTile(6, 1, (ITEM_COLORS[BLOCK.BIRCH_LEAVES] || '#507d2a'), '#3a5a1e');

  // 4,2: Spruce Log Side
  drawTile(4, 2, (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811'), '#2a1b0b');
  // 5,2: Spruce Log Top
  drawTile(5, 2, '#4d3318', (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811'));
  // 6,2: Spruce Leaves
  drawTile(6, 2, (ITEM_COLORS[BLOCK.SPRUCE_LEAVES] || '#1a360e'), '#0d1d07');

  // 7,1: Cactus Side (Refined)
  drawTile(7, 1, (ITEM_COLORS[BLOCK.CACTUS] || '#007700'), '#005500');
  ctx.fillStyle = '#0a440a'; // Ridges
  ctx.fillRect(7 * size + 3, 1 * size, 2, size);
  ctx.fillRect(7 * size + 11, 1 * size, 2, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // Prickles
  for(let i=0; i<8; i++) {
    ctx.fillRect(7 * size + 2, 1 * size + i*2, 1, 1);
    ctx.fillRect(7 * size + 14, 1 * size + i*2 + 1, 1, 1);
    ctx.fillRect(7 * size + 8, 1 * size + i*2, 1, 1);
  }

  // 7,2: Cactus Top (Refined)
  drawTile(7, 2, '#009900', (ITEM_COLORS[BLOCK.CACTUS] || '#007700'));
  ctx.fillStyle = '#005500';
  ctx.beginPath(); ctx.arc(7.5*size, 2.5*size, 6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#004400';
  ctx.beginPath(); ctx.moveTo(7.5*size - 6, 2.5*size); ctx.lineTo(7.5*size + 6, 2.5*size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7.5*size, 2.5*size - 6); ctx.lineTo(7.5*size, 2.5*size + 6); ctx.stroke();

  // --- MUSHROOMS ---
  // 5,7: Red Mushroom
  ctx.clearRect(5 * size, 7 * size, size, size);
  ctx.fillStyle = '#990000'; // Cap edge
  ctx.fillRect(5 * size + 2, 7 * size + 4, 12, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'); // Cap center
  ctx.fillRect(5 * size + 3, 7 * size + 3, 10, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // White spots
  ctx.fillRect(5 * size + 5, 7 * size + 4, 2, 2);
  ctx.fillRect(5 * size + 10, 7 * size + 6, 2, 2);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'); // Stem
  ctx.fillRect(5 * size + 7, 7 * size + 10, 2, 6);

  // 6,7: Brown Mushroom
  ctx.clearRect(6 * size, 7 * size, size, size);
  ctx.fillStyle = '#4a3318'; // Dark Brown Cap
  ctx.fillRect(6 * size + 2, 7 * size + 6, 12, 4);
  ctx.fillRect(6 * size + 4, 7 * size + 4, 8, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'); // Lighter Brown highlight
  ctx.fillRect(6 * size + 5, 7 * size + 5, 6, 2);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'); // Stem
  ctx.fillRect(6 * size + 7, 7 * size + 10, 2, 6);

  // 7,3: Dead Bush (Refined)
  ctx.clearRect(7 * size, 3 * size, size, size);
  ctx.strokeStyle = (ITEM_COLORS[BLOCK.STICK] || '#8b6240');
  ctx.lineWidth = 1;
  // Tangled branches
  ctx.beginPath();
  ctx.moveTo(7*size + 8, 3*size + 16); ctx.lineTo(7*size + 8, 3*size + 10);
  ctx.lineTo(7*size + 4, 3*size + 6); ctx.moveTo(7*size + 8, 3*size + 10);
  ctx.lineTo(7*size + 12, 3*size + 7); ctx.moveTo(7*size + 6, 3*size + 8);
  ctx.lineTo(7*size + 10, 3*size + 4); ctx.stroke();
  ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
  ctx.fillRect(7 * size + 7, 3 * size + 12, 2, 4); // Main stem base

  // 6,3: Ice
  ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
  ctx.fillRect(6 * size, 3 * size, size, size);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(6 * size + 2, 3 * size + 2, 4, 1);
  ctx.fillRect(6 * size + 10, 3 * size + 12, 3, 1);

  // 5,3: Sandstone
  drawTile(5, 3, (ITEM_COLORS[BLOCK.SAND] || '#d2b48c'), '#c2a47c');
  ctx.fillStyle = '#b89b74';
  ctx.fillRect(5 * size, 3 * size + 14, size, 2);

  // --- BEG_GEN ---

  // --- TOOLS & WEAPONS ---
  const drawTool = (x: number, y: number, isPickaxe: boolean, matColor: string, tier: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Palette generation based on matColor
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(matColor);
    const highlight = rgbToHex(base.r + 50, base.g + 50, base.b + 50);
    const shadow = rgbToHex(base.r - 50, base.g - 50, base.b - 50);
    const outline = rgbToHex(base.r - 100, base.g - 100, base.b - 100);
    
    const handleDark = (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811');
    const handleMid = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    const handleLight = (ITEM_COLORS[BLOCK.CRAFTING_TABLE] || '#8f6b42');
    const handleOutline = '#1a1108';

    // 1. Draw Stick (Handle)
    // Detailed stick with diagonal banding
    for (let i = 0; i < 9; i++) {
        const px = x * size + i + 1;
        const py = y * size + 14 - i;
        
        ctx.fillStyle = handleOutline;
        ctx.fillRect(px, py + 1, 2, 2); // shadow/outline
        
        ctx.fillStyle = (i % 3 === 0) ? handleDark : (i % 3 === 1) ? handleMid : handleLight;
        ctx.fillRect(px, py, 1, 1);
        
        // Grip wrap for higher tiers
        if (tier >= 2 && i > 2 && i < 6) {
           ctx.fillStyle = tier === 4 ? (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1') : (tier === 3 ? (ITEM_COLORS[BLOCK.SKYCOIN] || '#ffd700') : '#111111');
           ctx.fillRect(px, py, 1, 1);
        }
    }

    if (isPickaxe) {
        // --- PICKAXE HEAD ---
        // Curved head shape
        const drawPixel = (dx: number, dy: number, color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * size + dx, y * size + dy, 1, 1);
        };

        // Head coordinates
        const headPixels = [
            [8,4], [7,4], [6,5], [5,5], [4,6], [3,7], [2,8], [2,9], // Left arm
            [9,4], [10,4], [11,5], [12,5], [13,6], [14,7], [15,8], [15,9] // Right arm
        ];

        // Outline
        ctx.fillStyle = outline;
        headPixels.forEach(([px, py]) => {
            ctx.fillRect(x*size + px - 1, y*size + py - 1, 3, 3);
        });

        // Main body
        ctx.fillStyle = matColor;
        headPixels.forEach(([px, py]) => {
            ctx.fillRect(x*size + px, y*size + py, 1, 1);
        });
        
        // Highlights
        ctx.fillStyle = highlight;
        ctx.fillRect(x*size + 6, y*size + 5, 3, 1);
        ctx.fillRect(x*size + 9, y*size + 5, 3, 1);
        ctx.fillRect(x*size + 14, y*size + 7, 1, 1);
        ctx.fillRect(x*size + 3, y*size + 7, 1, 1);

        // Center hub
        ctx.fillStyle = outline;
        ctx.fillRect(x*size + 7, y*size + 3, 3, 3);
        ctx.fillStyle = matColor;
        ctx.fillRect(x*size + 8, y*size + 4, 1, 1);
        
        // Shiny spark for high tiers
        if (tier >= 3) {
            ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
            ctx.fillRect(x*size + 8, y*size + 4, 1, 1);
            ctx.fillRect(x*size + 4, y*size + 6, 1, 1);
            ctx.fillRect(x*size + 13, y*size + 6, 1, 1);
        }

    } else {
        // --- SWORD ---
        // Guard (Hilt)
        const guardOutline = [
            [3,10], [4,10], [5,10], [6,10], [7,10], [8,10], [9,10], [10,10],
            [9,9], [8,8], [7,7], [6,6], // handle connection
        ];
        
        ctx.fillStyle = handleOutline;
        // Draw a proper crossguard
        ctx.fillRect(x*size + 3, y*size + 9, 8, 3);
        
        // Guard color
        ctx.fillStyle = (tier === 0) ? (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b') : (tier === 1) ? (ITEM_COLORS[BLOCK.STONE] || '#888888') : (tier === 2) ? (ITEM_COLORS[BLOCK.IRON_PICKAXE] || '#e5e4e2') : (tier === 3) ? (ITEM_COLORS[BLOCK.SKYCOIN] || '#ffd700') : (ITEM_COLORS[BLOCK.DIAMOND_PICKAXE] || '#b9f2ff');
        ctx.fillRect(x*size + 4, y*size + 10, 6, 1);
        
        // Blade (Diagonal)
        const bladeLength = tier >= 3 ? 11 : 9;
        for (let i = 0; i < bladeLength; i++) {
            const bx = x * size + 6 + i;
            const by = y * size + 8 - i;
            
            // Blade Outline - thicker at base
            ctx.fillStyle = outline;
            ctx.fillRect(bx - 1, by - 1, (i < 2 ? 4 : 3), (i < 2 ? 4 : 3));
        }
        for (let i = 0; i < bladeLength; i++) {
            const bx = x * size + 6 + i;
            const by = y * size + 8 - i;
            
            // Blade core
            ctx.fillStyle = matColor;
            ctx.fillRect(bx, by, 2, 2);
            
            // Inner fuller (blood groove) for higher tiers
            if (tier >= 2 && i > 1 && i < bladeLength - 1) {
                ctx.fillStyle = shadow;
                ctx.fillRect(bx, by, 1, 1);
            }
            
            // Highlight edge
            ctx.fillStyle = highlight;
            ctx.fillRect(bx, by, 1, 1);
            
            // Shadow under-edge
            if (i < bladeLength - 1) {
                ctx.fillStyle = shadow;
                ctx.fillRect(bx + 1, by + 1, 1, 1);
            }
        }
        
        // Tip
        ctx.fillStyle = highlight;
        ctx.fillRect(x*size + 6 + bladeLength, y*size + 8 - bladeLength, 1, 1);
        
        // Handle Pommel
        ctx.fillStyle = outline;
        ctx.fillRect(x*size - 1, y*size + 14, 4, 4);
        ctx.fillStyle = (tier >= 3) ? matColor : handleDark;
        ctx.fillRect(x*size, y*size + 15, 2, 2);
    }
  };

  const drawShovel = (x: number, y: number, color: string, tier: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    const matColor = color;
    
    // Palette generation based on matColor
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(matColor);
    const highlight = rgbToHex(base.r + 50, base.g + 50, base.b + 50);
    const shadow = rgbToHex(base.r - 50, base.g - 50, base.b - 50);
    const outline = rgbToHex(base.r - 100, base.g - 100, base.b - 100);
    
    const handleOutline = '#1a1108';
    const handleMid = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');

    // Handle
    ctx.fillStyle = handleMid;
    for(let i=0; i<12; i++) {
        const px = x*size + i;
        const py = y*size + 15 - i;
        ctx.fillStyle = handleOutline;
        ctx.fillRect(px, py + 1, 2, 2);
        ctx.fillStyle = handleMid;
        ctx.fillRect(px, py, 1, 1);
    }
    
    // Head outline
    ctx.fillStyle = outline;
    ctx.fillRect(x*size + 10, y*size + 2, 4, 6);
    ctx.fillRect(x*size + 9, y*size + 3, 6, 4);
    
    // Head main
    ctx.fillStyle = matColor;
    ctx.fillRect(x*size + 11, y*size + 3, 2, 4);
    ctx.fillRect(x*size + 10, y*size + 4, 4, 2);
    
    // Highlight
    ctx.fillStyle = highlight;
    ctx.fillRect(x*size + 10, y*size + 3, 1, 1);
  };

  const drawAxe = (x: number, y: number, color: string, tier: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    const matColor = color;
    
    // Palette generation based on matColor
    const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(matColor);
    const highlight = rgbToHex(base.r + 50, base.g + 50, base.b + 50);
    const shadow = rgbToHex(base.r - 50, base.g - 50, base.b - 50);
    const outline = rgbToHex(base.r - 100, base.g - 100, base.b - 100);
    
    const handleOutline = '#1a1108';
    const handleMid = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    
    // Handle
    for(let i=0; i<14; i++) {
        const px = x*size + i;
        const py = y*size + 15 - i;
        ctx.fillStyle = handleOutline;
        ctx.fillRect(px, py + 1, 2, 2);
        ctx.fillStyle = handleMid;
        ctx.fillRect(px, py, 1, 1);
    }
    
    // Head outline
    ctx.fillStyle = outline;
    ctx.fillRect(x*size + 7, y*size + 1, 7, 7);
    
    // Head main
    ctx.fillStyle = matColor;
    ctx.fillRect(x*size + 8, y*size + 2, 5, 5);
    ctx.fillRect(x*size + 13, y*size + 3, 1, 3); // Beard/tip
    
    // Highlights
    ctx.fillStyle = highlight;
    ctx.fillRect(x*size + 8, y*size + 2, 1, 1);
    ctx.fillRect(x*size + 12, y*size + 3, 1, 1);
    
    // Shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(x*size + 8, y*size + 6, 5, 1);
  };

  const drawFood = (x: number, y: number, color: string, isApple: boolean) => {
    ctx.clearRect(x * size, y * size, size, size);
    if(isApple) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x*size + 8, y*size + 9, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4a2b00'; // Stem
      ctx.fillRect(x*size + 7, y*size + 2, 2, 3);
      ctx.fillStyle = '#ffffff66'; // Shine
      ctx.fillRect(x*size + 10, y*size + 6, 2, 2);
    } else {
      // Steak shape
      ctx.fillStyle = color;
      ctx.fillRect(x*size + 4, y*size + 4, 8, 8);
      ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // Bone
      ctx.fillRect(x*size + 2, y*size + 6, 4, 2);
      ctx.fillStyle = '#00000022'; // Grill marks
      ctx.fillRect(x*size + 5, y*size + 6, 6, 1);
      ctx.fillRect(x*size + 5, y*size + 9, 6, 1);
    }
  };

  drawTool(0, 28, true, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0); // Wood Pick
  drawTool(1, 28, true, '#9a9a9a', 1); // Stone Pick
  drawTool(2, 28, true, '#e6e6e6', 2); // Iron Pick
  drawTool(3, 28, true, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3); // Gold Pick
  drawTool(4, 28, true, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4); // Diamond Pick

  drawTool(0, 29, false, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0); // Wood Sword
  drawTool(1, 29, false, '#9a9a9a', 1); // Stone Sword
  drawTool(2, 29, false, '#e6e6e6', 2); // Iron Sword
  drawTool(3, 29, false, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3); // Gold Sword
  drawTool(4, 29, false, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4); // Diamond Sword

  drawShovel(0, 30, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0);
  drawShovel(1, 30, '#9a9a9a', 1);
  drawShovel(2, 30, '#e6e6e6', 2);
  drawShovel(3, 30, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3);
  drawShovel(4, 30, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4);

  drawAxe(2, 31, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0);
  drawAxe(3, 31, '#9a9a9a', 1);
  drawAxe(4, 31, '#e6e6e6', 2);
  drawAxe(5, 31, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3);
  drawAxe(6, 31, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4);

  drawFood(7, 31, (ITEM_COLORS[BLOCK.APPLE] || '#ff4d4d'), true); // Apple
  drawFood(8, 31, (ITEM_COLORS[BLOCK.SKYCOIN] || '#ffd700'), true); // Golden Apple
  drawFood(9, 31, (ITEM_COLORS[BLOCK.COOKED_BEEF] || '#6b3e26'), false); // Steak
  drawFood(10, 31, (ITEM_COLORS[BLOCK.RAW_BEEF] || '#ff7070'), false); // Raw Beef

  const drawRod = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    for(let i=0; i<14; i++) ctx.fillRect(x*size + i, y*size + 15 - i, 2, 2);
    ctx.strokeStyle = '#aaaaaa';
    ctx.beginPath(); ctx.moveTo(x*size+13, y*size+2); ctx.lineTo(x*size+13, y*size+14); ctx.stroke();
  };

  const drawBow = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.strokeStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x*size + 4, y*size + 8, 6, -Math.PI/2, Math.PI/2); ctx.stroke();
    ctx.strokeStyle = '#eeeeee';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x*size+4, y*size+2); ctx.lineTo(x*size+4, y*size+14); ctx.stroke();
  };

  const drawArrow = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd');
    for(let i=0; i<12; i++) ctx.fillRect(x*size + i, y*size + 15 - i, 1, 1);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'); // Shaft
    ctx.fillStyle = '#444444'; // Tip
    ctx.fillRect(x*size + 11, y*size + 3, 2, 2);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // Feather
    ctx.fillRect(x*size + 1, y*size + 13, 2, 2);
  };

  drawRod(11, 31);
  drawBow(12, 31);
  drawArrow(13, 31);

  const drawBucket = (x: number, y: number, liquidColor?: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.BUCKET] || '#cccccc');
    ctx.fillRect(x*size + 5, y*size + 5, 6, 8);
    ctx.fillRect(x*size + 4, y*size + 4, 8, 2);
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(x*size + 5, y*size + 12, 6, 1);
    
    if(liquidColor) {
      ctx.fillStyle = liquidColor;
      ctx.fillRect(x*size + 5, y*size + 6, 6, 4);
    }
  };

  drawBucket(14, 31);
  drawBucket(15, 31, (ITEM_COLORS[BLOCK.WATER] || '#3f76e4')); // Water
  drawBucket(16, 31, (ITEM_COLORS[BLOCK.CONCRETE_ORANGE] || '#f07613')); // Lava

  const drawLump = (x: number, y: number, color: string, high: string, dark: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = '#111111';
    ctx.fillRect(x * size + 4, y * size + 4, 8, 8);
    ctx.fillRect(x * size + 5, y * size + 3, 6, 10);
    ctx.fillRect(x * size + 3, y * size + 5, 10, 6);
    
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 5, y * size + 4, 6, 8);
    ctx.fillRect(x * size + 4, y * size + 5, 8, 6);
    
    ctx.fillStyle = high;
    ctx.fillRect(x * size + 5, y * size + 4, 2, 2);
    ctx.fillRect(x * size + 4, y * size + 6, 1, 1);

    ctx.fillStyle = dark;
    ctx.fillRect(x * size + 9, y * size + 8, 2, 2);
    ctx.fillRect(x * size + 11, y * size + 7, 1, 1);
  };

  const drawPearl = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = (ITEM_COLORS[BLOCK.ENDER_PEARL] || '#0b4c42');
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#177b6d';
    ctx.fillRect(x*size + 6, y*size + 6, 2, 2);
  };

  const drawBone = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.BONE] || '#ebebeb');
    for(let i=0; i<12; i++) ctx.fillRect(x*size + i + 2, y*size + 13 - i, 2, 2);
    ctx.fillRect(x*size + 2, y*size + 12, 3, 3);
    ctx.fillRect(x*size + 11, y*size + 3, 3, 3);
  };

  const drawFeather = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
    for(let i=0; i<12; i++) {
        ctx.fillRect(x*size + i + 2, y*size + 13 - i, 1, 1);
        ctx.fillRect(x*size + i + 1, y*size + 13 - i, 2, 2);
    }
  };

  drawPearl(17, 31);
  drawBone(18, 31);
  drawLump(19, 31, (ITEM_COLORS[BLOCK.GUNPOWDER] || '#545454'), '#777777', '#333333'); // Gunpowder
  drawLump(20, 31, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), (ITEM_COLORS[BLOCK.ARROW] || '#dddddd')); // String (bundle)
  drawFeather(21, 31);

  const drawBread = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.BREAD] || '#d19e59');
    ctx.fillRect(x*size + 3, y*size + 6, 10, 6);
    ctx.fillRect(x*size + 4, y*size + 5, 8, 8);
    ctx.fillStyle = '#b07f40';
    ctx.fillRect(x*size + 5, y*size + 7, 2, 1);
    ctx.fillRect(x*size + 8, y*size + 7, 2, 1);
    ctx.fillRect(x*size + 11, y*size + 7, 1, 1);
  };

  const drawSeeds = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SEEDS] || '#4a5d23');
    ctx.fillRect(x*size + 6, y*size + 6, 1, 1);
    ctx.fillRect(x*size + 9, y*size + 8, 1, 1);
    ctx.fillRect(x*size + 7, y*size + 10, 1, 1);
    ctx.fillStyle = '#6b8a32';
    ctx.fillRect(x*size + 8, y*size + 6, 1, 1);
    ctx.fillRect(x*size + 6, y*size + 9, 1, 1);
  };

  drawBread(22, 31);
  drawSeeds(23, 31);

  // --- INGOTS & GEMS ---
  const drawIngot = (x: number, y: number, baseMap: string, highlightMap: string, shadowMap: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Outline
    ctx.fillStyle = '#111111';
    ctx.fillRect(x*size + 2, y*size + 6, 12, 6);
    ctx.fillRect(x*size + 3, y*size + 4, 10, 8);

    // Body
    ctx.fillStyle = baseMap;
    ctx.fillRect(x*size + 3, y*size + 5, 10, 6);
    
    // Shading
    ctx.fillStyle = shadowMap;
    ctx.fillRect(x*size + 3, y*size + 10, 10, 1);
    ctx.fillRect(x*size + 12, y*size + 6, 1, 5);
    
    // Highlight
    ctx.fillStyle = highlightMap;
    ctx.fillRect(x*size + 3, y*size + 5, 9, 1);
    ctx.fillRect(x*size + 3, y*size + 5, 1, 4);
    
    // Extra shine
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
    ctx.fillRect(x*size + 4, y*size + 6, 1, 1);
  };
  
  const drawGem = (x: number, y: number, baseC: string, highC: string, shadowC: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Outline
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(x*size + 8, y*size + 2);
    ctx.lineTo(x*size + 13, y*size + 7);
    ctx.lineTo(x*size + 8, y*size + 14);
    ctx.lineTo(x*size + 3, y*size + 7);
    ctx.closePath();
    ctx.fill();
    
    // Inner
    ctx.fillStyle = baseC;
    ctx.fillRect(x*size + 5, y*size + 4, 6, 8);
    ctx.fillRect(x*size + 4, y*size + 6, 8, 4);
    
    // Facets
    ctx.fillStyle = highC;
    ctx.fillRect(x*size + 5, y*size + 4, 3, 3);
    ctx.fillStyle = shadowC;
    ctx.fillRect(x*size + 8, y*size + 9, 3, 3);
    
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
    ctx.fillRect(x*size + 6, y*size + 5, 1, 1);
  };

  const drawCoin = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Outer rim
    ctx.fillStyle = '#1a1a00';
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 6.5, 0, Math.PI*2); ctx.fill();
    
    // Gold base
    const grad = ctx.createRadialGradient(x*size + 6, y*size + 6, 1, x*size + 8, y*size + 8, 6);
    grad.addColorStop(0, '#fff5b1');
    grad.addColorStop(0.5, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'));
    grad.addColorStop(1, '#bfa51c');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 5.5, 0, Math.PI*2); ctx.fill();
    
    // Inner detail (S)
    ctx.fillStyle = '#bfa51c';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('$', x*size + 8, y*size + 11);
  };

  drawIngot(5, 28, '#e6e6e6', (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#aaaaaa'); // Iron
  drawIngot(6, 28, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), '#fff5b1', '#bfa51c'); // Gold
  drawGem(7, 28, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), (ITEM_COLORS[BLOCK.DIAMOND_PICKAXE] || '#b9f2ff'), '#14897f'); // Diamond
  drawCoin(8, 28); // Skycoin
  drawLump(9, 28, '#333333', '#555555', '#111111'); // Coal
  drawGem(10, 28, (ITEM_COLORS[BLOCK.EMERALD_ORE] || '#17dd62'), '#5fff9d', '#0d8a3d'); // Emerald
  drawLump(11, 28, (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'), '#ff5555', '#aa0000'); // Redstone
  drawLump(12, 28, (ITEM_COLORS[BLOCK.LAPIS_ORE] || '#1034bd'), '#4466ee', '#081a5e'); // Lapis
  drawIngot(13, 28, (ITEM_COLORS[BLOCK.COPPER_INGOT] || '#e39452'), '#f6b889', '#b36a2d'); // Copper Ingot

  drawTile(0, 9, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#E4E4E4');
  drawTile(1, 9, (ITEM_COLORS[BLOCK.CONCRETE_ORANGE] || '#f07613'), '#E06704');
  drawTile(2, 9, (ITEM_COLORS[BLOCK.CONCRETE_MAGENTA] || '#bd44b3'), '#A4349A');
  drawTile(3, 9, (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_BLUE] || '#3aafd9'), '#2798C1');
  drawTile(4, 9, (ITEM_COLORS[BLOCK.CONCRETE_YELLOW] || '#f8c627'), '#E8B415');
  drawTile(5, 9, (ITEM_COLORS[BLOCK.CONCRETE_LIME] || '#70b919'), '#5EA111');
  drawTile(6, 9, (ITEM_COLORS[BLOCK.CONCRETE_PINK] || '#ed8dac'), '#D97796');
  drawTile(7, 9, (ITEM_COLORS[BLOCK.CONCRETE_GRAY] || '#3e4447'), '#2E3436');
  drawTile(8, 9, (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_GRAY] || '#8e8e86'), '#7A7A71');
  drawTile(9, 9, (ITEM_COLORS[BLOCK.CONCRETE_CYAN] || '#158991'), '#117178');
  drawTile(10, 9, (ITEM_COLORS[BLOCK.CONCRETE_PURPLE] || '#792aac'), '#641C8F');
  drawTile(11, 9, (ITEM_COLORS[BLOCK.CONCRETE_BLUE] || '#35399d'), '#2B2E8A');
  drawTile(12, 9, (ITEM_COLORS[BLOCK.CONCRETE_BROWN] || '#724728'), '#59361C');
  drawTile(13, 9, (ITEM_COLORS[BLOCK.CONCRETE_GREEN] || '#546d1b'), '#425712');
  drawTile(14, 9, (ITEM_COLORS[BLOCK.CONCRETE_RED] || '#a12722'), '#8E201B');
  drawTile(15, 9, (ITEM_COLORS[BLOCK.CONCRETE_BLACK] || '#141519'), '#0D0E11');

  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
  ctx.fillRect(0 * size, 10 * size, size, size);
  ctx.fillStyle = '#E4E4E4';
  for(let i=0; i<20; i++) {
     const nx = 0 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_ORANGE] || '#f07613');
  ctx.fillRect(1 * size, 10 * size, size, size);
  ctx.fillStyle = '#E06704';
  for(let i=0; i<20; i++) {
     const nx = 1 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_MAGENTA] || '#bd44b3');
  ctx.fillRect(2 * size, 10 * size, size, size);
  ctx.fillStyle = '#A4349A';
  for(let i=0; i<20; i++) {
     const nx = 2 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_BLUE] || '#3aafd9');
  ctx.fillRect(3 * size, 10 * size, size, size);
  ctx.fillStyle = '#2798C1';
  for(let i=0; i<20; i++) {
     const nx = 3 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_YELLOW] || '#f8c627');
  ctx.fillRect(4 * size, 10 * size, size, size);
  ctx.fillStyle = '#E8B415';
  for(let i=0; i<20; i++) {
     const nx = 4 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_LIME] || '#70b919');
  ctx.fillRect(5 * size, 10 * size, size, size);
  ctx.fillStyle = '#5EA111';
  for(let i=0; i<20; i++) {
     const nx = 5 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_PINK] || '#ed8dac');
  ctx.fillRect(6 * size, 10 * size, size, size);
  ctx.fillStyle = '#D97796';
  for(let i=0; i<20; i++) {
     const nx = 6 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_GRAY] || '#3e4447');
  ctx.fillRect(7 * size, 10 * size, size, size);
  ctx.fillStyle = '#2E3436';
  for(let i=0; i<20; i++) {
     const nx = 7 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_GRAY] || '#8e8e86');
  ctx.fillRect(8 * size, 10 * size, size, size);
  ctx.fillStyle = '#7A7A71';
  for(let i=0; i<20; i++) {
     const nx = 8 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_CYAN] || '#158991');
  ctx.fillRect(9 * size, 10 * size, size, size);
  ctx.fillStyle = '#117178';
  for(let i=0; i<20; i++) {
     const nx = 9 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_PURPLE] || '#792aac');
  ctx.fillRect(10 * size, 10 * size, size, size);
  ctx.fillStyle = '#641C8F';
  for(let i=0; i<20; i++) {
     const nx = 10 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_BLUE] || '#35399d');
  ctx.fillRect(11 * size, 10 * size, size, size);
  ctx.fillStyle = '#2B2E8A';
  for(let i=0; i<20; i++) {
     const nx = 11 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_BROWN] || '#724728');
  ctx.fillRect(12 * size, 10 * size, size, size);
  ctx.fillStyle = '#59361C';
  for(let i=0; i<20; i++) {
     const nx = 12 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_GREEN] || '#546d1b');
  ctx.fillRect(13 * size, 10 * size, size, size);
  ctx.fillStyle = '#425712';
  for(let i=0; i<20; i++) {
     const nx = 13 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_RED] || '#a12722');
  ctx.fillRect(14 * size, 10 * size, size, size);
  ctx.fillStyle = '#8E201B';
  for(let i=0; i<20; i++) {
     const nx = 14 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_BLACK] || '#141519');
  ctx.fillRect(15 * size, 10 * size, size, size);
  ctx.fillStyle = '#0D0E11';
  for(let i=0; i<20; i++) {
     const nx = 15 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.clearRect(0 * size, 11 * size, size, size);
  ctx.fillStyle = '#FFFFFF44';
  ctx.fillRect(0 * size, 11 * size, size, size);
  ctx.strokeStyle = '#FFFFFF88';
  ctx.strokeRect(0 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(1 * size, 11 * size, size, size);
  ctx.fillStyle = '#F0761344';
  ctx.fillRect(1 * size, 11 * size, size, size);
  ctx.strokeStyle = '#F0761388';
  ctx.strokeRect(1 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(2 * size, 11 * size, size, size);
  ctx.fillStyle = '#BD44B344';
  ctx.fillRect(2 * size, 11 * size, size, size);
  ctx.strokeStyle = '#BD44B388';
  ctx.strokeRect(2 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(3 * size, 11 * size, size, size);
  ctx.fillStyle = '#3AAfd944';
  ctx.fillRect(3 * size, 11 * size, size, size);
  ctx.strokeStyle = '#3AAfd988';
  ctx.strokeRect(3 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(4 * size, 11 * size, size, size);
  ctx.fillStyle = '#F8C62744';
  ctx.fillRect(4 * size, 11 * size, size, size);
  ctx.strokeStyle = '#F8C62788';
  ctx.strokeRect(4 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(5 * size, 11 * size, size, size);
  ctx.fillStyle = '#70B91944';
  ctx.fillRect(5 * size, 11 * size, size, size);
  ctx.strokeStyle = '#70B91988';
  ctx.strokeRect(5 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(6 * size, 11 * size, size, size);
  ctx.fillStyle = '#ED8DAC44';
  ctx.fillRect(6 * size, 11 * size, size, size);
  ctx.strokeStyle = '#ED8DAC88';
  ctx.strokeRect(6 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(7 * size, 11 * size, size, size);
  ctx.fillStyle = '#3E444744';
  ctx.fillRect(7 * size, 11 * size, size, size);
  ctx.strokeStyle = '#3E444788';
  ctx.strokeRect(7 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(8 * size, 11 * size, size, size);
  ctx.fillStyle = '#8E8E8644';
  ctx.fillRect(8 * size, 11 * size, size, size);
  ctx.strokeStyle = '#8E8E8688';
  ctx.strokeRect(8 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(9 * size, 11 * size, size, size);
  ctx.fillStyle = '#15899144';
  ctx.fillRect(9 * size, 11 * size, size, size);
  ctx.strokeStyle = '#15899188';
  ctx.strokeRect(9 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(10 * size, 11 * size, size, size);
  ctx.fillStyle = '#792AAC44';
  ctx.fillRect(10 * size, 11 * size, size, size);
  ctx.strokeStyle = '#792AAC88';
  ctx.strokeRect(10 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(11 * size, 11 * size, size, size);
  ctx.fillStyle = '#35399D44';
  ctx.fillRect(11 * size, 11 * size, size, size);
  ctx.strokeStyle = '#35399D88';
  ctx.strokeRect(11 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(12 * size, 11 * size, size, size);
  ctx.fillStyle = '#72472844';
  ctx.fillRect(12 * size, 11 * size, size, size);
  ctx.strokeStyle = '#72472888';
  ctx.strokeRect(12 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(13 * size, 11 * size, size, size);
  ctx.fillStyle = '#546D1B44';
  ctx.fillRect(13 * size, 11 * size, size, size);
  ctx.strokeStyle = '#546D1B88';
  ctx.strokeRect(13 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(14 * size, 11 * size, size, size);
  ctx.fillStyle = '#A1272244';
  ctx.fillRect(14 * size, 11 * size, size, size);
  ctx.strokeStyle = '#A1272288';
  ctx.strokeRect(14 * size + 1, 11 * size + 1, size - 2, size - 2);

  ctx.clearRect(15 * size, 11 * size, size, size);
  ctx.fillStyle = '#14151944';
  ctx.fillRect(15 * size, 11 * size, size, size);
  ctx.strokeStyle = '#14151988';
  ctx.strokeRect(15 * size + 1, 11 * size + 1, size - 2, size - 2);

  // --- AUTOMATIC PROCEDURAL TILE GENERATION FOR MISSING TILES ---
  for (const [key, value] of Object.entries(BLOCK)) {
     if (typeof value === 'number' && value > 0) {
        const uvs = BLOCK_UVS[value];
        if (uvs && uvs[0]) {
           const u = uvs[0][0];
           const v = uvs[0][1];
           // Only procedural generate for rows 12-26, and rows 4-8. Row 27-31 are manual high-res icons.
           if ((v >= 12 && v <= 26) || (v >= 4 && v <= 8)) {
              const color = ITEM_COLORS[value] || '#999999';
              // Darken color slightly for noise
              ctx.fillStyle = color;
              ctx.fillRect(u * size, v * size, size, size);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
              for (let i = 0; i < 30; i++) {
                 const nx = u * size + Math.random() * size;
                 const ny = v * size + Math.random() * size;
                 ctx.fillRect(nx, ny, 1, 1);
              }
              // Lighten top edge for a slightly blocky texture feel
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.fillRect(u * size, v * size, size, 2);
              // Darken bottom edge
              ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
              ctx.fillRect(u * size, v * size + size - 2, size, 2);
           }
        }
     }
  }

  // --- Torch (12, 27) ---
  ctx.clearRect(12 * size, 27 * size, size, size);
  // Stick with shading
  ctx.fillStyle = '#5A3A22'; // Shadow
  ctx.fillRect(12 * size + 6, 27 * size + 6, 4, 10);
  ctx.fillStyle = '#8B4513'; // Highlight
  ctx.fillRect(12 * size + 6, 27 * size + 6, 2, 10);
  
  // Flame base (Deep orange)
  ctx.fillStyle = '#E64A19'; 
  ctx.fillRect(12 * size + 5, 27 * size + 3, 6, 4);
  
  // Flame center (Orange/Yellow)
  ctx.fillStyle = '#FF9800'; 
  ctx.fillRect(12 * size + 6, 27 * size + 1, 4, 3);
  
  // Flame core (White/Yellow)
  ctx.fillStyle = '#FFFF8D'; 
  ctx.fillRect(12 * size + 7, 27 * size + 0, 2, 2);
  
  // Sparks
  ctx.fillStyle = '#FFAB91';
  ctx.fillRect(12 * size + 4, 27 * size + 4, 1, 1);
  ctx.fillRect(12 * size + 11, 27 * size + 2, 1, 1);
  ctx.fillRect(12 * size + 8, 27 * size - 1, 1, 1);
  
  
  // --- ASPECT OF THE END (24, 31) ---
  const drawAOTE = (x: number, y: number) => {
    drawTool(x, y, false, (ITEM_COLORS[BLOCK.ASPECT_OF_THE_END] || '#55ffff'), 4); // Cyan sword
  };

  // --- MINION (25, 31) ---
  const drawMinion = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = '#FFFF55';
    ctx.fillRect(x*size + 4, y*size + 4, 8, 8); // Head
    ctx.fillStyle = '#111111';
    ctx.fillRect(x*size + 5, y*size + 6, 2, 2); // Eye
    ctx.fillRect(x*size + 9, y*size + 6, 2, 2); // Eye
    ctx.fillStyle = '#FF5555';
    ctx.fillRect(x*size + 6, y*size + 10, 4, 1); // Mouth
  };

  drawAOTE(24, 31);
  drawMinion(25, 31);

  // --- Glowstone Redesign (8, 27) ---
  ctx.clearRect(8 * size, 27 * size, size, size);
  ctx.fillStyle = '#b57912'; // Base dark gold/brown
  ctx.fillRect(8 * size, 27 * size, size, size);
  
  // Crystals
  ctx.fillStyle = '#ffce3b';
  ctx.fillRect(8 * size + 2, 27 * size + 2, 6, 5);
  ctx.fillRect(8 * size + 1, 27 * size + 9, 5, 5);
  ctx.fillRect(8 * size + 9, 27 * size + 1, 5, 6);
  ctx.fillRect(8 * size + 8, 27 * size + 9, 6, 6);
  
  // Bright highlights
  ctx.fillStyle = '#ffea8c';
  ctx.fillRect(8 * size + 3, 27 * size + 3, 3, 2);
  ctx.fillRect(8 * size + 2, 27 * size + 10, 2, 2);
  ctx.fillRect(8 * size + 10, 27 * size + 2, 2, 3);
  ctx.fillRect(8 * size + 9, 27 * size + 10, 3, 3);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
  ctx.fillRect(8 * size + 4, 27 * size + 4, 1, 1);
  ctx.fillRect(8 * size + 10, 27 * size + 11, 1, 1);
  ctx.fillRect(8 * size + 11, 27 * size + 3, 1, 1);

  // --- Sugar Cane (9, 27) ---
  ctx.clearRect(9 * size, 27 * size, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SUGAR_CANE] || '#68b936');
  ctx.fillRect(9 * size + 4, 27 * size + 2, 2, 12);
  ctx.fillRect(9 * size + 7, 27 * size + 4, 2, 10);
  ctx.fillRect(9 * size + 10, 27 * size + 1, 2, 13);
  ctx.fillStyle = '#4A8522'; // segments
  for(let i=0; i<3; i++) {
    ctx.fillRect(9 * size + 4 + i*3, 27 * size + 5, 2, 1);
    ctx.fillRect(9 * size + 4 + i*3, 27 * size + 9, 2, 1);
  }

  // Horns on face texture
  ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd');
  ctx.fillRect(3 * size + 1, 4 * size + 1, 2, 3);
  ctx.fillRect(3 * size + 13, 4 * size + 1, 2, 3);

  // 3,5: Cow Body
  drawTile(3, 5, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee'); // White base
  ctx.fillStyle = '#222222'; // Black spots
  // More organic spots
  ctx.fillRect(3 * size + 1, 5 * size + 2, 5, 4);
  ctx.fillRect(3 * size + 9, 5 * size + 1, 6, 5);
  ctx.fillRect(3 * size + 2, 5 * size + 9, 4, 6);
  ctx.fillRect(3 * size + 10, 5 * size + 10, 5, 4);
  ctx.fillRect(3 * size + 6, 5 * size + 6, 3, 3);

  // 4,4: Cow Leg
  drawTile(4, 4, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee'); // White leg
  ctx.fillStyle = '#111111'; // Black hoof
  ctx.fillRect(4 * size, 4 * size + 12, size, 4);
  ctx.fillStyle = '#222222'; // Some spots on legs
  ctx.fillRect(4 * size + 2, 4 * size + 2, 4, 4);

  // 4,5: Sheep Leg
  drawTile(4, 5, '#e3c5a8', '#d1b08c');
  ctx.fillStyle = '#c4a484'; // Slight shading at bottom
  ctx.fillRect(4 * size, 5 * size + 12, size, 4);

  // 1,6: Skeleton Leg/Arm (Bone)
  drawTile(1, 6, (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'), '#bbbbbb');
  ctx.fillStyle = (ITEM_COLORS[BLOCK.BUCKET] || '#cccccc');
  for(let i=0; i<4; i++) ctx.fillRect(1 * size + Math.random()*14, 6 * size + Math.random()*14, 2, 2);

  // 5,4: Sheep Face
  drawTile(5, 4, '#e3c5a8', '#d1b08c'); // Warmer skin tone
  ctx.fillStyle = '#000000';
  ctx.fillRect(5 * size + 2, 4 * size + 6, 3, 2);
  ctx.fillRect(5 * size + 11, 4 * size + 6, 3, 2);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(5 * size + 6, 4 * size + 11, 4, 3);

  // 5,5: Sheep Body (Wool)
  drawTile(5, 5, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#f0f0f0');
  ctx.fillStyle = '#e0e0e0';
  // More "fluffy" wool texture
  for(let i=0; i<24; i++) {
    ctx.fillRect(5 * size + Math.random()*13, 5 * size + Math.random()*13, 3, 3);
  }
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
  for(let i=0; i<12; i++) {
    ctx.fillRect(5 * size + Math.random()*14, 5 * size + Math.random()*14, 2, 2);
  }

  // 6,4: Slime Face
  ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
  ctx.fillRect(6 * size, 4 * size, size, size);
  ctx.fillStyle = '#004400';
  ctx.fillRect(6 * size + 3, 4 * size + 4, 3, 3);
  ctx.fillRect(6 * size + 10, 4 * size + 4, 3, 3);
  ctx.fillRect(6 * size + 6, 4 * size + 10, 4, 2);

  // 6,5: Slime Body
  ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
  ctx.fillRect(6 * size, 5 * size, size, size);
  ctx.fillStyle = 'rgba(0, 200, 0, 0.5)';
  for(let i=0; i<10; i++) ctx.fillRect(6 * size + Math.random()*14, 5 * size + Math.random()*14, 2, 2);

  // --- ORES ---
  const drawOreExt = (x: number, y: number, color: string, isDeepslate: boolean, orePattern: number) => {
    // Base tile
    const c1 = isDeepslate ? '#313133' : (ITEM_COLORS[BLOCK.FURNACE] || '#7d7d7d');
    const c2 = isDeepslate ? '#212122' : '#6b6b6b';
    drawTile(x, y, c1, c2); 
    
    // Smooth the base a bit with subtle highlights/shadows
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x*size, y*size, size, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(x*size, y*size + size - 2, size, 2);

    // Ore flecks based on pattern
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(color);
    const bright = rgbToHex(base.r + 60, base.g + 60, base.b + 60);
    const dark = rgbToHex(base.r - 60, base.g - 60, base.b - 60);

    let flecks: number[][] = [];
    if (orePattern === 0) { // Blobs (Coal/Nether Gold)
       flecks = [[3, 3, 4, 3], [10, 4, 3, 3], [4, 10, 3, 4], [9, 10, 4, 3], [7, 7, 2, 2]];
    } else if (orePattern === 1) { // Streaks (Iron, Gold, Copper)
       flecks = [[2, 2, 3, 2], [5, 4, 4, 2], [10, 9, 3, 2], [3, 11, 4, 2], [8, 12, 3, 2], [11, 4, 2, 3]];
    } else { // Crystals (Diamond, Emerald, Redstone, Lapis)
       flecks = [[4, 4, 3, 3], [11, 5, 2, 3], [5, 11, 3, 2], [10, 10, 4, 3], [7, 8, 2, 2], [2, 8, 3, 2], [12, 2, 2, 2]];
    }
    
    flecks.forEach(([fx, fy, fw, fh]) => {
      // Depth shadow on the stone behind the ore
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x*size + fx - 1, y*size + fy - 1, fw + 2, fh + 2);
      
      // Main ore color
      ctx.fillStyle = color;
      ctx.fillRect(x*size + fx, y*size + fy, fw, fh);
      
      // Highlights
      ctx.fillStyle = bright;
      ctx.fillRect(x*size + fx, y*size + fy, Math.max(1, fw/2), 1);
      ctx.fillRect(x*size + fx, y*size + fy, 1, Math.max(1, fh/2));
      
      // Lowlights
      ctx.fillStyle = dark;
      ctx.fillRect(x*size + fx + Math.floor(fw/2), y*size + fy + fh - 1, Math.ceil(fw/2), 1);
      ctx.fillRect(x*size + fx + fw - 1, y*size + fy + Math.floor(fh/2), 1, Math.ceil(fh/2));
      
      // Extra shine for crystals
      if (orePattern === 2) {
          ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
          ctx.fillRect(x*size + fx + 1, y*size + fy + 1, 1, 1);
      }
    });
  };

  // Stone Ores
  drawOreExt(0, 8, '#333333', false, 0); // Coal
  drawOreExt(1, 8, (ITEM_COLORS[BLOCK.IRON_ORE] || '#d8af93'), false, 1); // Iron
  drawOreExt(2, 8, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), false, 1); // Gold
  drawOreExt(3, 8, (ITEM_COLORS[BLOCK.LAPIS_ORE] || '#1034bd'), false, 2); // Lapis
  drawOreExt(4, 8, (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'), false, 2); // Redstone
  drawOreExt(5, 8, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), false, 2); // Diamond
  drawOreExt(6, 8, (ITEM_COLORS[BLOCK.EMERALD_ORE] || '#17dd62'), false, 2); // Emerald
  // Deepslate Ores
  drawOreExt(8, 25, '#222222', true, 0); // Coal
  drawOreExt(9, 25, (ITEM_COLORS[BLOCK.IRON_ORE] || '#d8af93'), true, 1); // Iron
  drawOreExt(10, 25, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), true, 1); // Gold
  drawOreExt(11, 25, (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'), true, 2); // Redstone
  drawOreExt(12, 25, (ITEM_COLORS[BLOCK.EMERALD_ORE] || '#17dd62'), true, 2); // Emerald
  drawOreExt(13, 25, (ITEM_COLORS[BLOCK.LAPIS_ORE] || '#1034bd'), true, 2); // Lapis
  drawOreExt(14, 25, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), true, 2); // Diamond
  // Copper
  drawOreExt(21, 21, (ITEM_COLORS[BLOCK.COPPER_INGOT] || '#e39452'), false, 1); // Copper
  drawOreExt(22, 21, (ITEM_COLORS[BLOCK.COPPER_INGOT] || '#e39452'), true, 1); // Deepslate Copper
  // Nether
  drawOreExt(10, 18, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), false, 2); // Nether Quartz
  drawOreExt(15, 25, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), false, 1); // Nether Gold

  // --- MOB SKIN TILES ---
  // 0,22: Zombie Face
  drawTile(0, 22, '#2e4d23', '#253f1c'); // Deep greenish-black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0 * size + 2, 22 * size + 6, 4, 3); // Left eye
  ctx.fillRect(0 * size + 10, 22 * size + 6, 4, 3); // Right eye
  ctx.fillStyle = '#1a2b14';
  ctx.fillRect(0 * size + 7, 22 * size + 9, 2, 2);

  // 1,22: Skeleton Face
  drawTile(1, 22, (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'), '#bbbbbb');
  ctx.fillStyle = '#222222';
  ctx.fillRect(1 * size + 3, 22 * size + 5, 4, 4); 
  ctx.fillRect(1 * size + 9, 22 * size + 5, 4, 4);
  ctx.fillRect(1 * size + 7, 22 * size + 9, 2, 2);

  // 2,22: Creeper Face
  drawTile(2, 22, '#0da82e', '#0a8a25'); 
  ctx.fillStyle = '#000000';
  ctx.fillRect(2 * size + 3, 22 * size + 4, 3, 3);
  ctx.fillRect(2 * size + 10, 22 * size + 4, 3, 3);
  ctx.fillRect(2 * size + 6, 22 * size + 7, 4, 5); 
  ctx.fillRect(2 * size + 4, 22 * size + 10, 8, 3);

  // 3,22: Zombie Body/Limbs (Noise)
  drawTile(3, 22, '#2e4d23', '#253f1c');
  ctx.fillStyle = '#3a5f2c';
  for(let i=0; i<6; i++) ctx.fillRect(3 * size + Math.random()*13, 22 * size + Math.random()*13, 3, 3);

  // 4,22: Skeleton Limbs (Bony Texture)
  drawTile(4, 22, '#eeeeee', (ITEM_COLORS[BLOCK.ARROW] || '#dddddd')); // Brighter bone
  ctx.fillStyle = (ITEM_COLORS[BLOCK.BUCKET] || '#cccccc'); // Shadow noise
  for(let i=0; i<12; i++) ctx.fillRect(4 * size + Math.random()*13, 22 * size + Math.random()*13, 2, 2);
  // Joint shading at top/bottom
  ctx.fillStyle = '#bbbbbb';
  ctx.fillRect(4 * size, 22 * size, size, 1);
  ctx.fillRect(4 * size, 22 * size + 15, size, 1);

  // 5,22: Creeper Body (Noise)
  drawTile(5, 22, '#0da82e', '#0a8a25');
  ctx.fillStyle = '#11cc33';
  for(let i=0; i<8; i++) ctx.fillRect(5 * size + Math.random()*12, 22 * size + Math.random()*12, 4, 4);

  // 6,22: Cow Body (White with Black Spots)
  drawTile(6, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee'); 
  ctx.fillStyle = '#222222';
  ctx.fillRect(6 * size + 1, 22 * size + 2, 5, 4);
  ctx.fillRect(6 * size + 9, 22 * size + 1, 6, 5);
  ctx.fillRect(6 * size + 2, 22 * size + 9, 4, 6);
  ctx.fillRect(6 * size + 10, 22 * size + 10, 5, 4);

  // 7,22: Cow Face (Cute UwU Edition)
  drawTile(7, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee');
  ctx.fillStyle = '#222222'; 
  // Cute eyes (n n)
  ctx.fillStyle = '#222222';
  // Left eye
  ctx.fillRect(7 * size + 3, 22 * size + 5, 4, 1); // Top line
  ctx.fillRect(7 * size + 3, 22 * size + 6, 1, 2); // Left line
  ctx.fillRect(7 * size + 6, 22 * size + 6, 1, 2); // Right line

  // Right eye
  ctx.fillRect(7 * size + 9, 22 * size + 5, 4, 1); // Top line
  ctx.fillRect(7 * size + 9, 22 * size + 6, 1, 2); // Left line
  ctx.fillRect(7 * size + 12, 22 * size + 6, 1, 2); // Right line
  
  // Blush
  ctx.fillStyle = '#ffb6c1';
  ctx.fillRect(7 * size + 2, 22 * size + 8, 2, 1);
  ctx.fillRect(7 * size + 12, 22 * size + 8, 2, 1);

  ctx.fillStyle = '#ffaaaa'; // Snout
  ctx.fillRect(7 * size + 5, 22 * size + 10, 6, 4);

  // 8,22: Sheep Body (Wool)
  drawTile(8, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#f0f0f0');
  ctx.fillStyle = '#e0e0e0';
  for(let i=0; i<24; i++) {
    ctx.fillRect(8 * size + Math.random()*13, 22 * size + Math.random()*13, 3, 3);
  }

  // 9,22: Sheep Face
  drawTile(9, 22, '#e3c5a8', '#d1b08c');
  ctx.fillStyle = '#000000';
  ctx.fillRect(9 * size + 2, 22 * size + 6, 3, 2);
  ctx.fillRect(9 * size + 11, 22 * size + 6, 3, 2);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(9 * size + 6, 22 * size + 11, 4, 3);

  // 10,22: Cow Leg
  drawTile(10, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee');
  ctx.fillStyle = '#111111';
  ctx.fillRect(10 * size, 22 * size + 12, size, 4);

  // 11,22: Sheep Leg
  drawTile(11, 22, '#e3c5a8', '#d1b08c');
  ctx.fillStyle = '#c4a484';
  ctx.fillRect(11 * size, 22 * size + 12, size, 4);

  // 12,22: Zombie Shirt
  drawTile(12, 22, '#00aaaa', '#009090'); // Teal shirt
  // Neck hole
  ctx.fillStyle = '#2e4d23'; // Zombie green skin
  ctx.fillRect(12 * size + 5, 22 * size, 6, 2);
  // Pocket / detail
  ctx.fillStyle = '#008080';
  ctx.fillRect(12 * size + 3, 22 * size + 4, 3, 2);
  // Noise
  ctx.fillStyle = '#00bbbb';
  for(let i=0; i<8; i++) ctx.fillRect(12 * size + Math.random()*13, 22 * size + Math.random()*13, 2, 2);

  // 13,22: Zombie Pants
  drawTile(13, 22, '#2d2d88', '#252577'); // Blue pants
  // Belt / detail
  ctx.fillStyle = '#202060';
  ctx.fillRect(13 * size, 22 * size, size, 2);
  // Noise
  ctx.fillStyle = '#3a3aa9';
  for(let i=0; i<6; i++) ctx.fillRect(13 * size + Math.random()*13, 22 * size + Math.random()*13, 2, 2);

  // 15,24: Morvane Skin (Pitch Black)
  drawTile(15, 24, '#000000', '#050505');
  // 16,24: Morvane Face (Glowing Void)
  drawTile(16, 24, '#000000', '#050505');
  ctx.fillStyle = '#ff0000'; // Glowing red eyes
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ff5555';
  ctx.fillRect(16 * size + 3, 24 * size + 5, 3, 2);
  ctx.fillRect(16 * size + 10, 24 * size + 5, 3, 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#220000'; // Scary mouth
  ctx.fillRect(16 * size + 4, 24 * size + 11, 8, 2);
  // 17,24: Morvane Plate (Unused now but for consistency)
  drawTile(17, 24, '#080808', '#000000');
  ctx.fillStyle = '#444444'; // Metal highlights
  for(let i=0; i<10; i++) ctx.fillRect(17 * size + Math.random()*14, 24 * size + Math.random()*14, 2, 2);

  // 0,25: Launcher Pad
  drawTile(0, 25, '#1e1e24', '#2a2a35'); // Dark metallic base
  
  // Outer border
  ctx.fillStyle = '#111111';
  ctx.fillRect(0 * size, 25 * size, size, 1);
  ctx.fillRect(0 * size, 25 * size + size - 1, size, 1);
  ctx.fillRect(0 * size, 25 * size, 1, size);
  ctx.fillRect(0 * size + size - 1, 25 * size, 1, size);
  
  // Inner metallic pad
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(0 * size + 2, 25 * size + 2, size - 4, size - 4);
  
  // Glowing center
  ctx.fillStyle = '#8a2be2'; // Purple glow
  ctx.shadowBlur = 5;
  ctx.shadowColor = '#9b59b6';
  ctx.fillRect(0 * size + 4, 25 * size + 4, 8, 8);
  
  // Up arrow in the center
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0 * size + 8, 25 * size + 4); // Peak
  ctx.lineTo(0 * size + 12, 25 * size + 8); // Right
  ctx.lineTo(0 * size + 9, 25 * size + 8);
  ctx.lineTo(0 * size + 9, 25 * size + 11); // Bottom right
  ctx.lineTo(0 * size + 7, 25 * size + 11); // Bottom left
  ctx.lineTo(0 * size + 7, 25 * size + 8); 
  ctx.lineTo(0 * size + 4, 25 * size + 8); // Left
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0; // Reset

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let cachedAtlasDataUrl: string | null = null;
export function getTextureAtlasDataUrl(): string {
  if (cachedAtlasDataUrl) return cachedAtlasDataUrl;
  
  const texture = createTextureAtlas();
  const canvas = texture.image as HTMLCanvasElement;
  cachedAtlasDataUrl = canvas.toDataURL();
  return cachedAtlasDataUrl;
}

const BLOCK_UVS: number[][][] = [];
for (let i = 0; i < 600; i++) {
  BLOCK_UVS[i] = [[0,0], [0,0], [0,0], [0,0], [0,0], [0,0]];
}
BLOCK_UVS[BLOCK.DIRT] = [[0,0], [0,0], [0,0], [0,0], [0,0], [0,0]];
BLOCK_UVS[BLOCK.GRASS] = [[2,0], [2,0], [1,0], [0,0], [2,0], [2,0]];
BLOCK_UVS[BLOCK.STONE] = [[3,0], [3,0], [3,0], [3,0], [3,0], [3,0]];
BLOCK_UVS[BLOCK.WOOD] = [[0,1], [0,1], [1,1], [1,1], [0,1], [0,1]];
BLOCK_UVS[BLOCK.LEAVES] = [[2,1], [2,1], [2,1], [2,1], [2,1], [2,1]];
BLOCK_UVS[BLOCK.SAND] = [[3,1], [3,1], [3,1], [3,1], [3,1], [3,1]];
BLOCK_UVS[BLOCK.WATER] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_1] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_2] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_3] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_4] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_5] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_6] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.WATER_7] = [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]];
BLOCK_UVS[BLOCK.GLASS] = [[1,2], [1,2], [1,2], [1,2], [1,2], [1,2]];
BLOCK_UVS[BLOCK.BLUE_STONE] = [[0,3], [0,3], [0,3], [0,3], [0,3], [0,3]];
BLOCK_UVS[BLOCK.RED_STONE] = [[1,3], [1,3], [1,3], [1,3], [1,3], [1,3]];
BLOCK_UVS[BLOCK.PLANKS] = [[2,3], [2,3], [2,3], [2,3], [2,3], [2,3]];
BLOCK_UVS[BLOCK.BRICK] = [[2,2], [2,2], [2,2], [2,2], [2,2], [2,2]];
BLOCK_UVS[BLOCK.STICK] = [[3,3], [3,3], [3,3], [3,3], [3,3], [3,3]];
BLOCK_UVS[BLOCK.SNOW] = [[3,2], [3,2], [3,2], [3,2], [3,2], [3,2]];
BLOCK_UVS[BLOCK.SLAB_STONE] = [[3,0], [3,0], [3,0], [3,0], [3,0], [3,0]];
BLOCK_UVS[BLOCK.SLAB_BLUE_STONE] = [[0,3], [0,3], [0,3], [0,3], [0,3], [0,3]];
BLOCK_UVS[BLOCK.SLAB_RED_STONE] = [[1,3], [1,3], [1,3], [1,3], [1,3], [1,3]];
BLOCK_UVS[BLOCK.SLAB_WOOD] = [[0,1], [0,1], [1,1], [1,1], [0,1], [0,1]];
BLOCK_UVS[BLOCK.TORCH] = [[12,27], [12,27], [12,27], [12,27], [12,27], [12,27]];
BLOCK_UVS[BLOCK.TORCH_WALL_X_POS] = [[12,27], [12,27], [12,27], [12,27], [12,27], [12,27]];
BLOCK_UVS[BLOCK.TORCH_WALL_X_NEG] = [[12,27], [12,27], [12,27], [12,27], [12,27], [12,27]];
BLOCK_UVS[BLOCK.TORCH_WALL_Z_POS] = [[12,27], [12,27], [12,27], [12,27], [12,27], [12,27]];
BLOCK_UVS[BLOCK.TORCH_WALL_Z_NEG] = [[12,27], [12,27], [12,27], [12,27], [12,27], [12,27]];

BLOCK_UVS[BLOCK.TALL_GRASS] = [[4,0], [4,0], [4,0], [4,0], [4,0], [4,0]];
BLOCK_UVS[BLOCK.FLOWER_RED] = [[5,0], [5,0], [5,0], [5,0], [5,0], [5,0]];
BLOCK_UVS[BLOCK.FLOWER_YELLOW] = [[6,0], [6,0], [6,0], [6,0], [6,0], [6,0]];
BLOCK_UVS[BLOCK.WHEAT] = [[7,0], [7,0], [7,0], [7,0], [7,0], [7,0]];
BLOCK_UVS[BLOCK.SUGAR_CANE] = [[9,27], [9,27], [9,27], [9,27], [9,27], [9,27]];
BLOCK_UVS[BLOCK.BIRCH_LOG] = [[4,1], [4,1], [5,1], [5,1], [4,1], [4,1]];
BLOCK_UVS[BLOCK.BIRCH_LEAVES] = [[6,1], [6,1], [6,1], [6,1], [6,1], [6,1]];
BLOCK_UVS[BLOCK.SPRUCE_LOG] = [[4,2], [4,2], [5,2], [5,2], [4,2], [4,2]];
BLOCK_UVS[BLOCK.SPRUCE_LEAVES] = [[6,2], [6,2], [6,2], [6,2], [6,2], [6,2]];
BLOCK_UVS[BLOCK.CACTUS] = [[7,1], [7,1], [7,2], [7,2], [7,1], [7,1]];
BLOCK_UVS[BLOCK.DEAD_BUSH] = [[7,3], [7,3], [7,3], [7,3], [7,3], [7,3]];
BLOCK_UVS[BLOCK.ICE] = [[6,3], [6,3], [6,3], [6,3], [6,3], [6,3]];
BLOCK_UVS[BLOCK.SANDSTONE] = [[5,3], [5,3], [5,3], [5,3], [5,3], [5,3]];
BLOCK_UVS[BLOCK.MUD] = [[0,7], [0,7], [0,7], [0,7], [0,7], [0,7]];
BLOCK_UVS[BLOCK.RED_SAND] = [[1,7], [1,7], [1,7], [1,7], [1,7], [1,7]];
BLOCK_UVS[BLOCK.TERRACOTTA] = [[2,7], [2,7], [2,7], [2,7], [2,7], [2,7]];
BLOCK_UVS[BLOCK.OBSIDIAN] = [[3,7], [3,7], [3,7], [3,7], [3,7], [3,7]];
BLOCK_UVS[BLOCK.LAVA] = [[4,7], [4,7], [4,7], [4,7], [4,7], [4,7]];
BLOCK_UVS[BLOCK.MUSHROOM_RED] = [[5,7], [5,7], [5,7], [5,7], [5,7], [5,7]];
BLOCK_UVS[BLOCK.MUSHROOM_BROWN] = [[6,7], [6,7], [6,7], [6,7], [6,7], [6,7]];
BLOCK_UVS[BLOCK.MUSHROOM_STEM] = [[7,7], [7,7], [7,7], [7,7], [7,7], [7,7]];
BLOCK_UVS[BLOCK.MYCELIUM] = [[2,6], [2,6], [1,0], [0,0], [2,6], [2,6]];
BLOCK_UVS[BLOCK.MUSHROOM_BLOCK_RED] = [[3,6], [3,6], [3,6], [3,6], [3,6], [3,6]];
BLOCK_UVS[BLOCK.MUSHROOM_BLOCK_BROWN] = [[4,6], [4,6], [4,6], [4,6], [4,6], [4,6]];
BLOCK_UVS[BLOCK.CHERRY_LOG] = [[5,6], [5,6], [5,1], [5,1], [5,6], [5,6]];
BLOCK_UVS[BLOCK.CHERRY_LEAVES] = [[6,6], [6,6], [6,6], [6,6], [6,6], [6,6]];
BLOCK_UVS[BLOCK.DARK_OAK_LOG] = [[7,6], [7,6], [5,1], [5,1], [7,6], [7,6]];
BLOCK_UVS[BLOCK.DARK_OAK_LEAVES] = [[2,5], [2,5], [2,5], [2,5], [2,5], [2,5]];
BLOCK_UVS[BLOCK.GLOWSTONE] = [[8,27], [8,27], [8,27], [8,27], [8,27], [8,27]];
BLOCK_UVS[BLOCK.ASPECT_OF_THE_END] = [[24,31], [24,31], [24,31], [24,31], [24,31], [24,31]];
BLOCK_UVS[BLOCK.MINION] = [[25,31], [25,31], [25,31], [25,31], [25,31], [25,31]];
BLOCK_UVS[BLOCK.COAL_ORE] = [[0,8], [0,8], [0,8], [0,8], [0,8], [0,8]];
BLOCK_UVS[BLOCK.IRON_ORE] = [[1,8], [1,8], [1,8], [1,8], [1,8], [1,8]];
BLOCK_UVS[BLOCK.GOLD_ORE] = [[2,8], [2,8], [2,8], [2,8], [2,8], [2,8]];
BLOCK_UVS[BLOCK.LAPIS_ORE] = [[3,8], [3,8], [3,8], [3,8], [3,8], [3,8]];
BLOCK_UVS[BLOCK.REDSTONE_ORE] = [[4,8], [4,8], [4,8], [4,8], [4,8], [4,8]];
BLOCK_UVS[BLOCK.DIAMOND_ORE] = [[5,8], [5,8], [5,8], [5,8], [5,8], [5,8]];
BLOCK_UVS[BLOCK.EMERALD_ORE] = [[6,8], [6,8], [6,8], [6,8], [6,8], [6,8]];

BLOCK_UVS[BLOCK.CONCRETE_WHITE] = [[0,9], [0,9], [0,9], [0,9], [0,9], [0,9]];
BLOCK_UVS[BLOCK.CONCRETE_ORANGE] = [[1,9], [1,9], [1,9], [1,9], [1,9], [1,9]];
BLOCK_UVS[BLOCK.CONCRETE_MAGENTA] = [[2,9], [2,9], [2,9], [2,9], [2,9], [2,9]];
BLOCK_UVS[BLOCK.CONCRETE_LIGHT_BLUE] = [[3,9], [3,9], [3,9], [3,9], [3,9], [3,9]];
BLOCK_UVS[BLOCK.CONCRETE_YELLOW] = [[4,9], [4,9], [4,9], [4,9], [4,9], [4,9]];
BLOCK_UVS[BLOCK.CONCRETE_LIME] = [[5,9], [5,9], [5,9], [5,9], [5,9], [5,9]];
BLOCK_UVS[BLOCK.CONCRETE_PINK] = [[6,9], [6,9], [6,9], [6,9], [6,9], [6,9]];
BLOCK_UVS[BLOCK.CONCRETE_GRAY] = [[7,9], [7,9], [7,9], [7,9], [7,9], [7,9]];
BLOCK_UVS[BLOCK.CONCRETE_LIGHT_GRAY] = [[8,9], [8,9], [8,9], [8,9], [8,9], [8,9]];
BLOCK_UVS[BLOCK.CONCRETE_CYAN] = [[9,9], [9,9], [9,9], [9,9], [9,9], [9,9]];
BLOCK_UVS[BLOCK.CONCRETE_PURPLE] = [[10,9], [10,9], [10,9], [10,9], [10,9], [10,9]];
BLOCK_UVS[BLOCK.CONCRETE_BLUE] = [[11,9], [11,9], [11,9], [11,9], [11,9], [11,9]];
BLOCK_UVS[BLOCK.CONCRETE_BROWN] = [[12,9], [12,9], [12,9], [12,9], [12,9], [12,9]];
BLOCK_UVS[BLOCK.CONCRETE_GREEN] = [[13,9], [13,9], [13,9], [13,9], [13,9], [13,9]];
BLOCK_UVS[BLOCK.CONCRETE_RED] = [[14,9], [14,9], [14,9], [14,9], [14,9], [14,9]];
BLOCK_UVS[BLOCK.CONCRETE_BLACK] = [[15,9], [15,9], [15,9], [15,9], [15,9], [15,9]];
BLOCK_UVS[BLOCK.WOOL_WHITE] = [[0,10], [0,10], [0,10], [0,10], [0,10], [0,10]];
BLOCK_UVS[BLOCK.WOOL_ORANGE] = [[1,10], [1,10], [1,10], [1,10], [1,10], [1,10]];
BLOCK_UVS[BLOCK.WOOL_MAGENTA] = [[2,10], [2,10], [2,10], [2,10], [2,10], [2,10]];
BLOCK_UVS[BLOCK.WOOL_LIGHT_BLUE] = [[3,10], [3,10], [3,10], [3,10], [3,10], [3,10]];
BLOCK_UVS[BLOCK.WOOL_YELLOW] = [[4,10], [4,10], [4,10], [4,10], [4,10], [4,10]];
BLOCK_UVS[BLOCK.WOOL_LIME] = [[5,10], [5,10], [5,10], [5,10], [5,10], [5,10]];
BLOCK_UVS[BLOCK.WOOL_PINK] = [[6,10], [6,10], [6,10], [6,10], [6,10], [6,10]];
BLOCK_UVS[BLOCK.WOOL_GRAY] = [[7,10], [7,10], [7,10], [7,10], [7,10], [7,10]];
BLOCK_UVS[BLOCK.WOOL_LIGHT_GRAY] = [[8,10], [8,10], [8,10], [8,10], [8,10], [8,10]];
BLOCK_UVS[BLOCK.WOOL_CYAN] = [[9,10], [9,10], [9,10], [9,10], [9,10], [9,10]];
BLOCK_UVS[BLOCK.WOOL_PURPLE] = [[10,10], [10,10], [10,10], [10,10], [10,10], [10,10]];
BLOCK_UVS[BLOCK.WOOL_BLUE] = [[11,10], [11,10], [11,10], [11,10], [11,10], [11,10]];
BLOCK_UVS[BLOCK.WOOL_BROWN] = [[12,10], [12,10], [12,10], [12,10], [12,10], [12,10]];
BLOCK_UVS[BLOCK.WOOL_GREEN] = [[13,10], [13,10], [13,10], [13,10], [13,10], [13,10]];
BLOCK_UVS[BLOCK.WOOL_RED] = [[14,10], [14,10], [14,10], [14,10], [14,10], [14,10]];
BLOCK_UVS[BLOCK.WOOL_BLACK] = [[15,10], [15,10], [15,10], [15,10], [15,10], [15,10]];
BLOCK_UVS[BLOCK.GLASS_WHITE] = [[0,11], [0,11], [0,11], [0,11], [0,11], [0,11]];
BLOCK_UVS[BLOCK.GLASS_ORANGE] = [[1,11], [1,11], [1,11], [1,11], [1,11], [1,11]];
BLOCK_UVS[BLOCK.GLASS_MAGENTA] = [[2,11], [2,11], [2,11], [2,11], [2,11], [2,11]];
BLOCK_UVS[BLOCK.GLASS_LIGHT_BLUE] = [[3,11], [3,11], [3,11], [3,11], [3,11], [3,11]];
BLOCK_UVS[BLOCK.GLASS_YELLOW] = [[4,11], [4,11], [4,11], [4,11], [4,11], [4,11]];
BLOCK_UVS[BLOCK.GLASS_LIME] = [[5,11], [5,11], [5,11], [5,11], [5,11], [5,11]];
BLOCK_UVS[BLOCK.GLASS_PINK] = [[6,11], [6,11], [6,11], [6,11], [6,11], [6,11]];
BLOCK_UVS[BLOCK.GLASS_GRAY] = [[7,11], [7,11], [7,11], [7,11], [7,11], [7,11]];
BLOCK_UVS[BLOCK.GLASS_LIGHT_GRAY] = [[8,11], [8,11], [8,11], [8,11], [8,11], [8,11]];
BLOCK_UVS[BLOCK.GLASS_CYAN] = [[9,11], [9,11], [9,11], [9,11], [9,11], [9,11]];
BLOCK_UVS[BLOCK.GLASS_PURPLE] = [[10,11], [10,11], [10,11], [10,11], [10,11], [10,11]];
BLOCK_UVS[BLOCK.GLASS_BLUE] = [[11,11], [11,11], [11,11], [11,11], [11,11], [11,11]];
BLOCK_UVS[BLOCK.GLASS_BROWN] = [[12,11], [12,11], [12,11], [12,11], [12,11], [12,11]];
BLOCK_UVS[BLOCK.GLASS_GREEN] = [[13,11], [13,11], [13,11], [13,11], [13,11], [13,11]];
BLOCK_UVS[BLOCK.GLASS_RED] = [[14,11], [14,11], [14,11], [14,11], [14,11], [14,11]];
BLOCK_UVS[BLOCK.GLASS_BLACK] = [[15,11], [15,11], [15,11], [15,11], [15,11], [15,11]];

BLOCK_UVS[BLOCK.GRANITE] = [[0,12], [0,12], [0,12], [0,12], [0,12], [0,12]];
BLOCK_UVS[BLOCK.POLISHED_GRANITE] = [[1,12], [1,12], [1,12], [1,12], [1,12], [1,12]];
BLOCK_UVS[BLOCK.DIORITE] = [[2,12], [2,12], [2,12], [2,12], [2,12], [2,12]];
BLOCK_UVS[BLOCK.POLISHED_DIORITE] = [[3,12], [3,12], [3,12], [3,12], [3,12], [3,12]];
BLOCK_UVS[BLOCK.ANDESITE] = [[4,12], [4,12], [4,12], [4,12], [4,12], [4,12]];
BLOCK_UVS[BLOCK.POLISHED_ANDESITE] = [[5,12], [5,12], [5,12], [5,12], [5,12], [5,12]];
BLOCK_UVS[BLOCK.DEEPSLATE] = [[6,12], [6,12], [6,12], [6,12], [6,12], [6,12]];
BLOCK_UVS[BLOCK.COBBLED_DEEPSLATE] = [[7,12], [7,12], [7,12], [7,12], [7,12], [7,12]];
BLOCK_UVS[BLOCK.NETHERRACK] = [[8,12], [8,12], [8,12], [8,12], [8,12], [8,12]];
BLOCK_UVS[BLOCK.SOUL_SAND] = [[9,12], [9,12], [9,12], [9,12], [9,12], [9,12]];
BLOCK_UVS[BLOCK.SOUL_SOIL] = [[10,12], [10,12], [10,12], [10,12], [10,12], [10,12]];
BLOCK_UVS[BLOCK.MAGMA_BLOCK] = [[11,12], [11,12], [11,12], [11,12], [11,12], [11,12]];
BLOCK_UVS[BLOCK.BONE_BLOCK] = [[12,12], [12,12], [12,12], [12,12], [12,12], [12,12]];
BLOCK_UVS[BLOCK.QUARTZ_BLOCK] = [[13,12], [13,12], [13,12], [13,12], [13,12], [13,12]];
BLOCK_UVS[BLOCK.NETHER_BRICKS] = [[14,12], [14,12], [14,12], [14,12], [14,12], [14,12]];
BLOCK_UVS[BLOCK.RED_NETHER_BRICKS] = [[15,12], [15,12], [15,12], [15,12], [15,12], [15,12]];
BLOCK_UVS[BLOCK.BOOKSHELF] = [[0,13], [0,13], [0,13], [0,13], [0,13], [0,13]];
BLOCK_UVS[BLOCK.CRAFTING_TABLE] = [[1,13], [1,13], [1,13], [1,13], [1,13], [1,13]];
BLOCK_UVS[BLOCK.FURNACE] = [[2,13], [2,13], [2,13], [2,13], [2,13], [2,13]];
BLOCK_UVS[BLOCK.JUKEBOX] = [[3,13], [3,13], [3,13], [3,13], [3,13], [3,13]];
BLOCK_UVS[BLOCK.MELON] = [[4,13], [4,13], [4,13], [4,13], [4,13], [4,13]];
BLOCK_UVS[BLOCK.PUMPKIN] = [[5,13], [5,13], [5,13], [5,13], [5,13], [5,13]];
BLOCK_UVS[BLOCK.JACK_O_LANTERN] = [[6,13], [6,13], [6,13], [6,13], [6,13], [6,13]];
BLOCK_UVS[BLOCK.HAY_BALE] = [[7,13], [7,13], [7,13], [7,13], [7,13], [7,13]];
BLOCK_UVS[BLOCK.SPONGE] = [[8,13], [8,13], [8,13], [8,13], [8,13], [8,13]];
BLOCK_UVS[BLOCK.WET_SPONGE] = [[9,13], [9,13], [9,13], [9,13], [9,13], [9,13]];
BLOCK_UVS[BLOCK.SLIME_BLOCK] = [[10,13], [10,13], [10,13], [10,13], [10,13], [10,13]];
BLOCK_UVS[BLOCK.HONEY_BLOCK] = [[11,13], [11,13], [11,13], [11,13], [11,13], [11,13]];
BLOCK_UVS[BLOCK.SEA_LANTERN] = [[12,13], [12,13], [12,13], [12,13], [12,13], [12,13]];
BLOCK_UVS[BLOCK.PRISMARINE] = [[13,13], [13,13], [13,13], [13,13], [13,13], [13,13]];
BLOCK_UVS[BLOCK.PRISMARINE_BRICKS] = [[14,13], [14,13], [14,13], [14,13], [14,13], [14,13]];
BLOCK_UVS[BLOCK.DARK_PRISMARINE] = [[15,13], [15,13], [15,13], [15,13], [15,13], [15,13]];
BLOCK_UVS[BLOCK.TERRACOTTA_WHITE] = [[0,14], [0,14], [0,14], [0,14], [0,14], [0,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_ORANGE] = [[1,14], [1,14], [1,14], [1,14], [1,14], [1,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_MAGENTA] = [[2,14], [2,14], [2,14], [2,14], [2,14], [2,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_LIGHT_BLUE] = [[3,14], [3,14], [3,14], [3,14], [3,14], [3,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_YELLOW] = [[4,14], [4,14], [4,14], [4,14], [4,14], [4,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_LIME] = [[5,14], [5,14], [5,14], [5,14], [5,14], [5,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_PINK] = [[6,14], [6,14], [6,14], [6,14], [6,14], [6,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_GRAY] = [[7,14], [7,14], [7,14], [7,14], [7,14], [7,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_LIGHT_GRAY] = [[8,14], [8,14], [8,14], [8,14], [8,14], [8,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_CYAN] = [[9,14], [9,14], [9,14], [9,14], [9,14], [9,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_PURPLE] = [[10,14], [10,14], [10,14], [10,14], [10,14], [10,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_BLUE] = [[11,14], [11,14], [11,14], [11,14], [11,14], [11,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_BROWN] = [[12,14], [12,14], [12,14], [12,14], [12,14], [12,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_GREEN] = [[13,14], [13,14], [13,14], [13,14], [13,14], [13,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_RED] = [[14,14], [14,14], [14,14], [14,14], [14,14], [14,14]];
BLOCK_UVS[BLOCK.TERRACOTTA_BLACK] = [[15,14], [15,14], [15,14], [15,14], [15,14], [15,14]];
BLOCK_UVS[BLOCK.ACACIA_LOG] = [[0,15], [0,15], [0,15], [0,15], [0,15], [0,15]];
BLOCK_UVS[BLOCK.ACACIA_PLANKS] = [[1,15], [1,15], [1,15], [1,15], [1,15], [1,15]];
BLOCK_UVS[BLOCK.ACACIA_LEAVES] = [[2,15], [2,15], [2,15], [2,15], [2,15], [2,15]];
BLOCK_UVS[BLOCK.JUNGLE_LOG] = [[3,15], [3,15], [3,15], [3,15], [3,15], [3,15]];
BLOCK_UVS[BLOCK.JUNGLE_PLANKS] = [[4,15], [4,15], [4,15], [4,15], [4,15], [4,15]];
BLOCK_UVS[BLOCK.JUNGLE_LEAVES] = [[5,15], [5,15], [5,15], [5,15], [5,15], [5,15]];
BLOCK_UVS[BLOCK.CALCITE] = [[6,15], [6,15], [6,15], [6,15], [6,15], [6,15]];
BLOCK_UVS[BLOCK.TUFF] = [[7,15], [7,15], [7,15], [7,15], [7,15], [7,15]];
BLOCK_UVS[BLOCK.DRIPSTONE_BLOCK] = [[8,15], [8,15], [8,15], [8,15], [8,15], [8,15]];
BLOCK_UVS[BLOCK.BASALT] = [[9,15], [9,15], [9,15], [9,15], [9,15], [9,15]];
BLOCK_UVS[BLOCK.POLISHED_BASALT] = [[10,15], [10,15], [10,15], [10,15], [10,15], [10,15]];
BLOCK_UVS[BLOCK.BLACKSTONE] = [[11,15], [11,15], [11,15], [11,15], [11,15], [11,15]];
BLOCK_UVS[BLOCK.POLISHED_BLACKSTONE] = [[12,15], [12,15], [12,15], [12,15], [12,15], [12,15]];
BLOCK_UVS[BLOCK.END_STONE] = [[13,15], [13,15], [13,15], [13,15], [13,15], [13,15]];
BLOCK_UVS[BLOCK.PURPUR_BLOCK] = [[14,15], [14,15], [14,15], [14,15], [14,15], [14,15]];
BLOCK_UVS[BLOCK.MANGROVE_LOG] = [[0,16], [0,16], [0,16], [0,16], [0,16], [0,16]];
BLOCK_UVS[BLOCK.MANGROVE_PLANKS] = [[1,16], [1,16], [1,16], [1,16], [1,16], [1,16]];
BLOCK_UVS[BLOCK.MANGROVE_LEAVES] = [[2,16], [2,16], [2,16], [2,16], [2,16], [2,16]];
BLOCK_UVS[BLOCK.CRIMSON_STEM] = [[3,16], [3,16], [3,16], [3,16], [3,16], [3,16]];
BLOCK_UVS[BLOCK.CRIMSON_PLANKS] = [[4,16], [4,16], [4,16], [4,16], [4,16], [4,16]];
BLOCK_UVS[BLOCK.NETHER_WART_BLOCK] = [[5,16], [5,16], [5,16], [5,16], [5,16], [5,16]];
BLOCK_UVS[BLOCK.WARPED_STEM] = [[6,16], [6,16], [6,16], [6,16], [6,16], [6,16]];
BLOCK_UVS[BLOCK.WARPED_PLANKS] = [[7,16], [7,16], [7,16], [7,16], [7,16], [7,16]];
BLOCK_UVS[BLOCK.WARPED_WART_BLOCK] = [[8,16], [8,16], [8,16], [8,16], [8,16], [8,16]];
BLOCK_UVS[BLOCK.COBBLESTONE] = [[9,16], [9,16], [9,16], [9,16], [9,16], [9,16]];
BLOCK_UVS[BLOCK.MOSSY_COBBLESTONE] = [[10,16], [10,16], [10,16], [10,16], [10,16], [10,16]];
BLOCK_UVS[BLOCK.SMOOTH_STONE] = [[11,16], [11,16], [11,16], [11,16], [11,16], [11,16]];
BLOCK_UVS[BLOCK.STONE_BRICKS] = [[12,16], [12,16], [12,16], [12,16], [12,16], [12,16]];
BLOCK_UVS[BLOCK.MOSSY_STONE_BRICKS] = [[13,16], [13,16], [13,16], [13,16], [13,16], [13,16]];
BLOCK_UVS[BLOCK.CRACKED_STONE_BRICKS] = [[14,16], [14,16], [14,16], [14,16], [14,16], [14,16]];
BLOCK_UVS[BLOCK.CHISELED_STONE_BRICKS] = [[15,16], [15,16], [15,16], [15,16], [15,16], [15,16]];
BLOCK_UVS[BLOCK.IRON_BLOCK] = [[0,17], [0,17], [0,17], [0,17], [0,17], [0,17]];
BLOCK_UVS[BLOCK.GOLD_BLOCK] = [[1,17], [1,17], [1,17], [1,17], [1,17], [1,17]];
BLOCK_UVS[BLOCK.DIAMOND_BLOCK] = [[2,17], [2,17], [2,17], [2,17], [2,17], [2,17]];
BLOCK_UVS[BLOCK.EMERALD_BLOCK] = [[3,17], [3,17], [3,17], [3,17], [3,17], [3,17]];
BLOCK_UVS[BLOCK.LAPIS_BLOCK] = [[4,17], [4,17], [4,17], [4,17], [4,17], [4,17]];
BLOCK_UVS[BLOCK.REDSTONE_BLOCK] = [[5,17], [5,17], [5,17], [5,17], [5,17], [5,17]];
BLOCK_UVS[BLOCK.COAL_BLOCK] = [[6,17], [6,17], [6,17], [6,17], [6,17], [6,17]];
BLOCK_UVS[BLOCK.COPPER_BLOCK] = [[7,17], [7,17], [7,17], [7,17], [7,17], [7,17]];
BLOCK_UVS[BLOCK.EXPOSED_COPPER] = [[8,17], [8,17], [8,17], [8,17], [8,17], [8,17]];
BLOCK_UVS[BLOCK.WEATHERED_COPPER] = [[9,17], [9,17], [9,17], [9,17], [9,17], [9,17]];
BLOCK_UVS[BLOCK.OXIDIZED_COPPER] = [[10,17], [10,17], [10,17], [10,17], [10,17], [10,17]];
BLOCK_UVS[BLOCK.RAW_IRON_BLOCK] = [[11,17], [11,17], [11,17], [11,17], [11,17], [11,17]];
BLOCK_UVS[BLOCK.RAW_GOLD_BLOCK] = [[12,17], [12,17], [12,17], [12,17], [12,17], [12,17]];
BLOCK_UVS[BLOCK.RAW_COPPER_BLOCK] = [[13,17], [13,17], [13,17], [13,17], [13,17], [13,17]];
BLOCK_UVS[BLOCK.AMETHYST_BLOCK] = [[14,17], [14,17], [14,17], [14,17], [14,17], [14,17]];
BLOCK_UVS[BLOCK.BEACON] = [[15,17], [15,17], [15,17], [15,17], [15,17], [15,17]];
BLOCK_UVS[BLOCK.LODESTONE] = [[0,18], [0,18], [0,18], [0,18], [0,18], [0,18]];
BLOCK_UVS[BLOCK.CRYING_OBSIDIAN] = [[1,18], [1,18], [1,18], [1,18], [1,18], [1,18]];
BLOCK_UVS[BLOCK.GILDED_BLACKSTONE] = [[2,18], [2,18], [2,18], [2,18], [2,18], [2,18]];
BLOCK_UVS[BLOCK.DIRT_PATH] = [[3,18], [3,18], [3,18], [3,18], [3,18], [3,18]];
BLOCK_UVS[BLOCK.NOTE_BLOCK] = [[4,18], [4,18], [4,18], [4,18], [4,18], [4,18]];
BLOCK_UVS[BLOCK.OBSERVER] = [[5,18], [5,18], [5,18], [5,18], [5,18], [5,18]];
BLOCK_UVS[BLOCK.TARGET] = [[6,18], [6,18], [6,18], [6,18], [6,18], [6,18]];
BLOCK_UVS[BLOCK.DISPENSER] = [[7,18], [7,18], [7,18], [7,18], [7,18], [7,18]];
BLOCK_UVS[BLOCK.DROPPER] = [[8,18], [8,18], [8,18], [8,18], [8,18], [8,18]];
BLOCK_UVS[BLOCK.BRICKS] = [[9,18], [9,18], [9,18], [9,18], [9,18], [9,18]];
BLOCK_UVS[BLOCK.NETHER_QUARTZ_ORE] = [[10,18], [10,18], [10,18], [10,18], [10,18], [10,18]];
BLOCK_UVS[BLOCK.ANCIENT_DEBRIS] = [[11,18], [11,18], [11,18], [11,18], [11,18], [11,18]];
BLOCK_UVS[BLOCK.SPRUCE_PLANKS] = [[12,18], [12,18], [12,18], [12,18], [12,18], [12,18]];
BLOCK_UVS[BLOCK.BIRCH_PLANKS] = [[13,18], [13,18], [13,18], [13,18], [13,18], [13,18]];
BLOCK_UVS[BLOCK.DARK_OAK_PLANKS] = [[14,18], [14,18], [14,18], [14,18], [14,18], [14,18]];
BLOCK_UVS[BLOCK.CHERRY_PLANKS] = [[15,18], [15,18], [15,18], [15,18], [15,18], [15,18]];
BLOCK_UVS[BLOCK.BAMBOO_BLOCK] = [[0,19], [0,19], [0,19], [0,19], [0,19], [0,19]];
BLOCK_UVS[BLOCK.BAMBOO_PLANKS] = [[1,19], [1,19], [1,19], [1,19], [1,19], [1,19]];
BLOCK_UVS[BLOCK.BAMBOO_MOSAIC] = [[2,19], [2,19], [2,19], [2,19], [2,19], [2,19]];
BLOCK_UVS[BLOCK.CHISELED_SANDSTONE] = [[3,19], [3,19], [3,19], [3,19], [3,19], [3,19]];
BLOCK_UVS[BLOCK.SMOOTH_SANDSTONE] = [[4,19], [4,19], [4,19], [4,19], [4,19], [4,19]];
BLOCK_UVS[BLOCK.CUT_SANDSTONE] = [[5,19], [5,19], [5,19], [5,19], [5,19], [5,19]];
BLOCK_UVS[BLOCK.RED_SANDSTONE] = [[6,19], [6,19], [6,19], [6,19], [6,19], [6,19]];
BLOCK_UVS[BLOCK.CHISELED_RED_SANDSTONE] = [[7,19], [7,19], [7,19], [7,19], [7,19], [7,19]];
BLOCK_UVS[BLOCK.SMOOTH_RED_SANDSTONE] = [[8,19], [8,19], [8,19], [8,19], [8,19], [8,19]];
BLOCK_UVS[BLOCK.CUT_RED_SANDSTONE] = [[9,19], [9,19], [9,19], [9,19], [9,19], [9,19]];
BLOCK_UVS[BLOCK.CHISELED_QUARTZ_BLOCK] = [[10,19], [10,19], [10,19], [10,19], [10,19], [10,19]];
BLOCK_UVS[BLOCK.QUARTZ_PILLAR] = [[11,19], [11,19], [11,19], [11,19], [11,19], [11,19]];
BLOCK_UVS[BLOCK.SMOOTH_QUARTZ] = [[12,19], [12,19], [12,19], [12,19], [12,19], [12,19]];
BLOCK_UVS[BLOCK.QUARTZ_BRICKS] = [[13,19], [13,19], [13,19], [13,19], [13,19], [13,19]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_WHITE] = [[14,19], [14,19], [14,19], [14,19], [14,19], [14,19]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_ORANGE] = [[15,19], [15,19], [15,19], [15,19], [15,19], [15,19]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_MAGENTA] = [[0,20], [0,20], [0,20], [0,20], [0,20], [0,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_LIGHT_BLUE] = [[1,20], [1,20], [1,20], [1,20], [1,20], [1,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_YELLOW] = [[2,20], [2,20], [2,20], [2,20], [2,20], [2,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_LIME] = [[3,20], [3,20], [3,20], [3,20], [3,20], [3,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_PINK] = [[4,20], [4,20], [4,20], [4,20], [4,20], [4,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_GRAY] = [[5,20], [5,20], [5,20], [5,20], [5,20], [5,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_LIGHT_GRAY] = [[6,20], [6,20], [6,20], [6,20], [6,20], [6,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_CYAN] = [[7,20], [7,20], [7,20], [7,20], [7,20], [7,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_PURPLE] = [[8,20], [8,20], [8,20], [8,20], [8,20], [8,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_BLUE] = [[9,20], [9,20], [9,20], [9,20], [9,20], [9,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_BROWN] = [[10,20], [10,20], [10,20], [10,20], [10,20], [10,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_GREEN] = [[11,20], [11,20], [11,20], [11,20], [11,20], [11,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_RED] = [[12,20], [12,20], [12,20], [12,20], [12,20], [12,20]];
BLOCK_UVS[BLOCK.CONCRETE_POWDER_BLACK] = [[13,20], [13,20], [13,20], [13,20], [13,20], [13,20]];
BLOCK_UVS[BLOCK.POLISHED_DEEPSLATE] = [[14,20], [14,20], [14,20], [14,20], [14,20], [14,20]];
BLOCK_UVS[BLOCK.DEEPSLATE_BRICKS] = [[15,20], [15,20], [15,20], [15,20], [15,20], [15,20]];
BLOCK_UVS[BLOCK.CRACKED_DEEPSLATE_BRICKS] = [[16,20], [16,20], [16,20], [16,20], [16,20], [16,20]];
BLOCK_UVS[BLOCK.DEEPSLATE_TILES] = [[17,20], [17,20], [17,20], [17,20], [17,20], [17,20]];
BLOCK_UVS[BLOCK.CRACKED_DEEPSLATE_TILES] = [[18,20], [18,20], [18,20], [18,20], [18,20], [18,20]];
BLOCK_UVS[BLOCK.CHISELED_DEEPSLATE] = [[19,20], [19,20], [19,20], [19,20], [19,20], [19,20]];
BLOCK_UVS[BLOCK.POLISHED_BLACKSTONE_BRICKS] = [[20,20], [20,20], [20,20], [20,20], [20,20], [20,20]];
BLOCK_UVS[BLOCK.CRACKED_POLISHED_BLACKSTONE_BRICKS] = [[21,20], [21,20], [21,20], [21,20], [21,20], [21,20]];
BLOCK_UVS[BLOCK.CHISELED_POLISHED_BLACKSTONE] = [[22,20], [22,20], [22,20], [22,20], [22,20], [22,20]];
BLOCK_UVS[BLOCK.MUD_BRICKS] = [[23,20], [23,20], [23,20], [23,20], [23,20], [23,20]];
BLOCK_UVS[BLOCK.PACKED_MUD] = [[24,20], [24,20], [24,20], [24,20], [24,20], [24,20]];
BLOCK_UVS[BLOCK.SCULK] = [[25,20], [25,20], [25,20], [25,20], [25,20], [25,20]];
BLOCK_UVS[BLOCK.SCULK_CATALYST] = [[26,20], [26,20], [26,20], [26,20], [26,20], [26,20]];
BLOCK_UVS[BLOCK.SCULK_SHRIEKER] = [[27,20], [27,20], [27,20], [27,20], [27,20], [27,20]];
BLOCK_UVS[BLOCK.SCULK_SENSOR] = [[28,20], [28,20], [28,20], [28,20], [28,20], [28,20]];
BLOCK_UVS[BLOCK.OCHRE_FROGLIGHT] = [[29,20], [29,20], [29,20], [29,20], [29,20], [29,20]];
BLOCK_UVS[BLOCK.VERDANT_FROGLIGHT] = [[30,20], [30,20], [30,20], [30,20], [30,20], [30,20]];
BLOCK_UVS[BLOCK.PEARLESCENT_FROGLIGHT] = [[31,20], [31,20], [31,20], [31,20], [31,20], [31,20]];
BLOCK_UVS[BLOCK.REINFORCED_DEEPSLATE] = [[0,21], [0,21], [0,21], [0,21], [0,21], [0,21]];
BLOCK_UVS[BLOCK.TUBE_CORAL_BLOCK] = [[1,21], [1,21], [1,21], [1,21], [1,21], [1,21]];
BLOCK_UVS[BLOCK.BRAIN_CORAL_BLOCK] = [[2,21], [2,21], [2,21], [2,21], [2,21], [2,21]];
BLOCK_UVS[BLOCK.BUBBLE_CORAL_BLOCK] = [[3,21], [3,21], [3,21], [3,21], [3,21], [3,21]];
BLOCK_UVS[BLOCK.FIRE_CORAL_BLOCK] = [[4,21], [4,21], [4,21], [4,21], [4,21], [4,21]];
BLOCK_UVS[BLOCK.HORN_CORAL_BLOCK] = [[5,21], [5,21], [5,21], [5,21], [5,21], [5,21]];
BLOCK_UVS[BLOCK.DEAD_TUBE_CORAL_BLOCK] = [[6,21], [6,21], [6,21], [6,21], [6,21], [6,21]];
BLOCK_UVS[BLOCK.DEAD_BRAIN_CORAL_BLOCK] = [[7,21], [7,21], [7,21], [7,21], [7,21], [7,21]];
BLOCK_UVS[BLOCK.DEAD_BUBBLE_CORAL_BLOCK] = [[8,21], [8,21], [8,21], [8,21], [8,21], [8,21]];
BLOCK_UVS[BLOCK.DEAD_FIRE_CORAL_BLOCK] = [[9,21], [9,21], [9,21], [9,21], [9,21], [9,21]];
BLOCK_UVS[BLOCK.DEAD_HORN_CORAL_BLOCK] = [[10,21], [10,21], [10,21], [10,21], [10,21], [10,21]];
BLOCK_UVS[BLOCK.MOSS_BLOCK] = [[11,21], [11,21], [11,21], [11,21], [11,21], [11,21]];
BLOCK_UVS[BLOCK.MOSS_CARPET] = [[12,21], [12,21], [12,21], [12,21], [12,21], [12,21]];
BLOCK_UVS[BLOCK.AZALEA] = [[13,21], [13,21], [13,21], [13,21], [13,21], [13,21]];
BLOCK_UVS[BLOCK.FLOWERING_AZALEA] = [[14,21], [14,21], [14,21], [14,21], [14,21], [14,21]];
BLOCK_UVS[BLOCK.SPORE_BLOSSOM] = [[15,21], [15,21], [15,21], [15,21], [15,21], [15,21]];
BLOCK_UVS[BLOCK.CAVE_VINES] = [[16,21], [16,21], [16,21], [16,21], [16,21], [16,21]];
BLOCK_UVS[BLOCK.DRIPSTONE_BLOCK] = [[17,21], [17,21], [17,21], [17,21], [17,21], [17,21]];
BLOCK_UVS[BLOCK.POINTED_DRIPSTONE] = [[18,21], [18,21], [18,21], [18,21], [18,21], [18,21]];
BLOCK_UVS[BLOCK.TUFF] = [[19,21], [19,21], [19,21], [19,21], [19,21], [19,21]];
BLOCK_UVS[BLOCK.CALCITE] = [[20,21], [20,21], [20,21], [20,21], [20,21], [20,21]];
BLOCK_UVS[BLOCK.COPPER_ORE] = [[21,21], [21,21], [21,21], [21,21], [21,21], [21,21]];
BLOCK_UVS[BLOCK.DEEPSLATE_COPPER_ORE] = [[22,21], [22,21], [22,21], [22,21], [22,21], [22,21]];
BLOCK_UVS[BLOCK.AMETHYST_CLUSTER] = [[23,21], [23,21], [23,21], [23,21], [23,21], [23,21]];
BLOCK_UVS[BLOCK.LARGE_AMETHYST_BUD] = [[24,21], [24,21], [24,21], [24,21], [24,21], [24,21]];
BLOCK_UVS[BLOCK.MEDIUM_AMETHYST_BUD] = [[25,21], [25,21], [25,21], [25,21], [25,21], [25,21]];
BLOCK_UVS[BLOCK.SMALL_AMETHYST_BUD] = [[26,21], [26,21], [26,21], [26,21], [26,21], [26,21]];
BLOCK_UVS[BLOCK.TINTED_GLASS] = [[27,21], [27,21], [27,21], [27,21], [27,21], [27,21]];
BLOCK_UVS[BLOCK.LIGHTNING_ROD] = [[28,21], [28,21], [28,21], [28,21], [28,21], [28,21]];
BLOCK_UVS[BLOCK.CANDLE] = [[29,21], [29,21], [29,21], [29,21], [29,21], [29,21]];
BLOCK_UVS[BLOCK.POTTED_AZALEA] = [[30,21], [30,21], [30,21], [30,21], [30,21], [30,21]];

BLOCK_UVS[BLOCK.LILY_PAD] = [[0,23], [0,23], [0,23], [0,23], [0,23], [0,23]];
BLOCK_UVS[BLOCK.VINE] = [[1,23], [1,23], [1,23], [1,23], [1,23], [1,23]];
BLOCK_UVS[BLOCK.GLOW_LICHEN] = [[2,23], [2,23], [2,23], [2,23], [2,23], [2,23]];
BLOCK_UVS[BLOCK.SUGAR_CANE] = [[3,23], [3,23], [3,23], [3,23], [3,23], [3,23]];
BLOCK_UVS[BLOCK.KELP] = [[4,23], [4,23], [4,23], [4,23], [4,23], [4,23]];
BLOCK_UVS[BLOCK.SEAGRASS] = [[5,23], [5,23], [5,23], [5,23], [5,23], [5,23]];
BLOCK_UVS[BLOCK.SEA_PICKLE] = [[6,23], [6,23], [6,23], [6,23], [6,23], [6,23]];
BLOCK_UVS[BLOCK.SHROOMLIGHT] = [[7,23], [7,23], [7,23], [7,23], [7,23], [7,23]];
BLOCK_UVS[BLOCK.CRIMSON_NYLIUM] = [[8,23], [8,23], [8,23], [8,23], [8,23], [8,23]];
BLOCK_UVS[BLOCK.WARPED_NYLIUM] = [[9,23], [9,23], [9,23], [9,23], [9,23], [9,23]];
BLOCK_UVS[BLOCK.CRIMSON_FUNGUS] = [[10,23], [10,23], [10,23], [10,23], [10,23], [10,23]];
BLOCK_UVS[BLOCK.WARPED_FUNGUS] = [[11,23], [11,23], [11,23], [11,23], [11,23], [11,23]];
BLOCK_UVS[BLOCK.WARPED_ROOTS] = [[12,23], [12,23], [12,23], [12,23], [12,23], [12,23]];
BLOCK_UVS[BLOCK.CRIMSON_ROOTS] = [[13,23], [13,23], [13,23], [13,23], [13,23], [13,23]];
BLOCK_UVS[BLOCK.NETHER_SPROUTS] = [[14,23], [14,23], [14,23], [14,23], [14,23], [14,23]];
BLOCK_UVS[BLOCK.WEEPING_VINES] = [[15,23], [15,23], [15,23], [15,23], [15,23], [15,23]];
BLOCK_UVS[BLOCK.TWISTING_VINES] = [[16,23], [16,23], [16,23], [16,23], [16,23], [16,23]];
BLOCK_UVS[BLOCK.IRON_BARS] = [[17,23], [17,23], [17,23], [17,23], [17,23], [17,23]];
BLOCK_UVS[BLOCK.CHAIN] = [[18,23], [18,23], [18,23], [18,23], [18,23], [18,23]];
BLOCK_UVS[BLOCK.LANTERN] = [[19,23], [19,23], [19,23], [19,23], [19,23], [19,23]];
BLOCK_UVS[BLOCK.SOUL_LANTERN] = [[20,23], [20,23], [20,23], [20,23], [20,23], [20,23]];
BLOCK_UVS[BLOCK.CAMPFIRE] = [[21,23], [21,23], [21,23], [21,23], [21,23], [21,23]];
BLOCK_UVS[BLOCK.SOUL_CAMPFIRE] = [[22,23], [22,23], [22,23], [22,23], [22,23], [22,23]];
BLOCK_UVS[BLOCK.REDSTONE_LAMP] = [[23,23], [23,23], [23,23], [23,23], [23,23], [23,23]];
BLOCK_UVS[BLOCK.SMOOTH_BASALT] = [[24,23], [24,23], [24,23], [24,23], [24,23], [24,23]];
BLOCK_UVS[BLOCK.COBWEB] = [[25,23], [25,23], [25,23], [25,23], [25,23], [25,23]];
BLOCK_UVS[BLOCK.FARMLAND] = [[26,23], [26,23], [26,23], [26,23], [26,23], [26,23]];
BLOCK_UVS[BLOCK.PODZOL] = [[27,23], [27,23], [27,23], [27,23], [27,23], [27,23]];
BLOCK_UVS[BLOCK.DAYLIGHT_DETECTOR] = [[28,23], [28,23], [28,23], [28,23], [28,23], [28,23]];
BLOCK_UVS[BLOCK.HOPPER] = [[29,23], [29,23], [29,23], [29,23], [29,23], [29,23]];
BLOCK_UVS[BLOCK.CAULDRON] = [[30,23], [30,23], [30,23], [30,23], [30,23], [30,23]];
BLOCK_UVS[BLOCK.ANVIL] = [[31,23], [31,23], [31,23], [31,23], [31,23], [31,23]];
BLOCK_UVS[BLOCK.GRINDSTONE] = [[0,24], [0,24], [0,24], [0,24], [0,24], [0,24]];
BLOCK_UVS[BLOCK.SMITHING_TABLE] = [[1,24], [1,24], [1,24], [1,24], [1,24], [1,24]];
BLOCK_UVS[BLOCK.FLETCHING_TABLE] = [[2,24], [2,24], [2,24], [2,24], [2,24], [2,24]];
BLOCK_UVS[BLOCK.CARTOGRAPHY_TABLE] = [[3,24], [3,24], [3,24], [3,24], [3,24], [3,24]];
BLOCK_UVS[BLOCK.LOOM] = [[4,24], [4,24], [4,24], [4,24], [4,24], [4,24]];
BLOCK_UVS[BLOCK.BARREL] = [[5,24], [5,24], [5,24], [5,24], [5,24], [5,24]];
BLOCK_UVS[BLOCK.SMOKER] = [[6,24], [6,24], [6,24], [6,24], [6,24], [6,24]];
BLOCK_UVS[BLOCK.BLAST_FURNACE] = [[7,24], [7,24], [7,24], [7,24], [7,24], [7,24]];
BLOCK_UVS[BLOCK.COMPOSTER] = [[8,24], [8,24], [8,24], [8,24], [8,24], [8,24]];
BLOCK_UVS[BLOCK.STONECUTTER] = [[9,24], [9,24], [9,24], [9,24], [9,24], [9,24]];
BLOCK_UVS[BLOCK.BELL] = [[10,24], [10,24], [10,24], [10,24], [10,24], [10,24]];
BLOCK_UVS[BLOCK.BEEHIVE] = [[11,24], [11,24], [11,24], [11,24], [11,24], [11,24]];
BLOCK_UVS[BLOCK.BEE_NEST] = [[12,24], [12,24], [12,24], [12,24], [12,24], [12,24]];
BLOCK_UVS[BLOCK.HONEYCOMB_BLOCK] = [[13,24], [13,24], [13,24], [13,24], [13,24], [13,24]];
BLOCK_UVS[BLOCK.RESPAWN_ANCHOR] = [[14,24], [14,24], [14,24], [14,24], [14,24], [14,24]];
BLOCK_UVS[BLOCK.CANDLE_CAKE] = [[15,24], [15,24], [15,24], [15,24], [15,24], [15,24]];
BLOCK_UVS[BLOCK.COARSE_DIRT] = [[16,24], [16,24], [16,24], [16,24], [16,24], [16,24]];
BLOCK_UVS[BLOCK.ROOTED_DIRT] = [[17,24], [17,24], [17,24], [17,24], [17,24], [17,24]];
BLOCK_UVS[BLOCK.MUDDY_MANGROVE_ROOTS] = [[18,24], [18,24], [18,24], [18,24], [18,24], [18,24]];
BLOCK_UVS[BLOCK.CHORUS_PLANT] = [[19,24], [19,24], [19,24], [19,24], [19,24], [19,24]];
BLOCK_UVS[BLOCK.CHORUS_FLOWER] = [[20,24], [20,24], [20,24], [20,24], [20,24], [20,24]];
BLOCK_UVS[BLOCK.TURTLE_EGG] = [[21,24], [21,24], [21,24], [21,24], [21,24], [21,24]];
BLOCK_UVS[BLOCK.SNIFFER_EGG] = [[22,24], [22,24], [22,24], [22,24], [22,24], [22,24]];
BLOCK_UVS[BLOCK.PITCHER_PLANT] = [[23,24], [23,24], [23,24], [23,24], [23,24], [23,24]];
BLOCK_UVS[BLOCK.TORCHFLOWER] = [[24,24], [24,24], [24,24], [24,24], [24,24], [24,24]];
BLOCK_UVS[BLOCK.SWEET_BERRY_BUSH] = [[25,24], [25,24], [25,24], [25,24], [25,24], [25,24]];
BLOCK_UVS[BLOCK.END_PORTAL_FRAME] = [[26,24], [26,24], [26,24], [26,24], [26,24], [26,24]];
BLOCK_UVS[BLOCK.END_PORTAL] = [[27,24], [27,24], [27,24], [27,24], [27,24], [27,24]];
BLOCK_UVS[BLOCK.NETHER_PORTAL] = [[28,24], [28,24], [28,24], [28,24], [28,24], [28,24]];
BLOCK_UVS[BLOCK.ENDER_CHEST] = [[29,24], [29,24], [29,24], [29,24], [29,24], [29,24]];
BLOCK_UVS[BLOCK.ENCHANTING_TABLE] = [[30,24], [30,24], [30,24], [30,24], [30,24], [30,24]];
BLOCK_UVS[BLOCK.CHISELED_BOOKSHELF] = [[31,24], [31,24], [31,24], [31,24], [31,24], [31,24]];
BLOCK_UVS[BLOCK.COMMAND_BLOCK] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.REPEATING_COMMAND_BLOCK] = [[1,25], [1,25], [1,25], [1,25], [1,25], [1,25]];
BLOCK_UVS[BLOCK.CHAIN_COMMAND_BLOCK] = [[2,25], [2,25], [2,25], [2,25], [2,25], [2,25]];
BLOCK_UVS[BLOCK.LAUNCHER] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.STRUCTURE_BLOCK] = [[3,25], [3,25], [3,25], [3,25], [3,25], [3,25]];
BLOCK_UVS[BLOCK.BARRIER] = [[4,25], [4,25], [4,25], [4,25], [4,25], [4,25]];
BLOCK_UVS[BLOCK.LAUNCHER] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.LAUNCHER_WALL_X_POS] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.LAUNCHER_WALL_X_NEG] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.LAUNCHER_WALL_Z_POS] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.LAUNCHER_WALL_Z_NEG] = [[0,25], [0,25], [0,25], [0,25], [0,25], [0,25]];
BLOCK_UVS[BLOCK.LIGHT_BLOCK] = [[5,25], [5,25], [5,25], [5,25], [5,25], [5,25]];
BLOCK_UVS[BLOCK.SPAWNER] = [[6,25], [6,25], [6,25], [6,25], [6,25], [6,25]];
BLOCK_UVS[BLOCK.DRAGON_EGG] = [[7,25], [7,25], [7,25], [7,25], [7,25], [7,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_COAL_ORE] = [[8,25], [8,25], [8,25], [8,25], [8,25], [8,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_IRON_ORE] = [[9,25], [9,25], [9,25], [9,25], [9,25], [9,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_GOLD_ORE] = [[10,25], [10,25], [10,25], [10,25], [10,25], [10,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_REDSTONE_ORE] = [[11,25], [11,25], [11,25], [11,25], [11,25], [11,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_EMERALD_ORE] = [[12,25], [12,25], [12,25], [12,25], [12,25], [12,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_LAPIS_ORE] = [[13,25], [13,25], [13,25], [13,25], [13,25], [13,25]];
BLOCK_UVS[BLOCK.DEEPSLATE_DIAMOND_ORE] = [[14,25], [14,25], [14,25], [14,25], [14,25], [14,25]];
BLOCK_UVS[BLOCK.NETHER_GOLD_ORE] = [[15,25], [15,25], [15,25], [15,25], [15,25], [15,25]];
BLOCK_UVS[BLOCK.BLOCK_OF_NETHERITE] = [[16,25], [16,25], [16,25], [16,25], [16,25], [16,25]];
BLOCK_UVS[BLOCK.STRIPPED_OAK_LOG] = [[17,25], [17,25], [17,25], [17,25], [17,25], [17,25]];
BLOCK_UVS[BLOCK.STRIPPED_SPRUCE_LOG] = [[18,25], [18,25], [18,25], [18,25], [18,25], [18,25]];
BLOCK_UVS[BLOCK.STRIPPED_BIRCH_LOG] = [[19,25], [19,25], [19,25], [19,25], [19,25], [19,25]];
BLOCK_UVS[BLOCK.STRIPPED_JUNGLE_LOG] = [[20,25], [20,25], [20,25], [20,25], [20,25], [20,25]];
BLOCK_UVS[BLOCK.STRIPPED_ACACIA_LOG] = [[21,25], [21,25], [21,25], [21,25], [21,25], [21,25]];
BLOCK_UVS[BLOCK.STRIPPED_DARK_OAK_LOG] = [[22,25], [22,25], [22,25], [22,25], [22,25], [22,25]];
BLOCK_UVS[BLOCK.STRIPPED_MANGROVE_LOG] = [[23,25], [23,25], [23,25], [23,25], [23,25], [23,25]];
BLOCK_UVS[BLOCK.STRIPPED_CHERRY_LOG] = [[24,25], [24,25], [24,25], [24,25], [24,25], [24,25]];
BLOCK_UVS[BLOCK.OAK_WOOD] = [[25,25], [25,25], [25,25], [25,25], [25,25], [25,25]];
BLOCK_UVS[BLOCK.SPRUCE_WOOD] = [[26,25], [26,25], [26,25], [26,25], [26,25], [26,25]];
BLOCK_UVS[BLOCK.BIRCH_WOOD] = [[27,25], [27,25], [27,25], [27,25], [27,25], [27,25]];
BLOCK_UVS[BLOCK.JUNGLE_WOOD] = [[28,25], [28,25], [28,25], [28,25], [28,25], [28,25]];
BLOCK_UVS[BLOCK.ACACIA_WOOD] = [[29,25], [29,25], [29,25], [29,25], [29,25], [29,25]];
BLOCK_UVS[BLOCK.DARK_OAK_WOOD] = [[30,25], [30,25], [30,25], [30,25], [30,25], [30,25]];
BLOCK_UVS[BLOCK.MANGROVE_WOOD] = [[31,25], [31,25], [31,25], [31,25], [31,25], [31,25]];
BLOCK_UVS[BLOCK.CHERRY_WOOD] = [[0,26], [0,26], [0,26], [0,26], [0,26], [0,26]];
BLOCK_UVS[BLOCK.END_STONE_BRICKS] = [[1,26], [1,26], [1,26], [1,26], [1,26], [1,26]];
BLOCK_UVS[BLOCK.PURPUR_PILLAR] = [[2,26], [2,26], [2,26], [2,26], [2,26], [2,26]];
BLOCK_UVS[BLOCK.PACKED_ICE] = [[3,26], [3,26], [3,26], [3,26], [3,26], [3,26]];
BLOCK_UVS[BLOCK.BLUE_ICE] = [[4,26], [4,26], [4,26], [4,26], [4,26], [4,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_WHITE] = [[5,26], [5,26], [5,26], [5,26], [5,26], [5,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_ORANGE] = [[6,26], [6,26], [6,26], [6,26], [6,26], [6,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_MAGENTA] = [[7,26], [7,26], [7,26], [7,26], [7,26], [7,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_LIGHT_BLUE] = [[8,26], [8,26], [8,26], [8,26], [8,26], [8,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_YELLOW] = [[9,26], [9,26], [9,26], [9,26], [9,26], [9,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_LIME] = [[10,26], [10,26], [10,26], [10,26], [10,26], [10,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_PINK] = [[11,26], [11,26], [11,26], [11,26], [11,26], [11,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_GRAY] = [[12,26], [12,26], [12,26], [12,26], [12,26], [12,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_LIGHT_GRAY] = [[13,26], [13,26], [13,26], [13,26], [13,26], [13,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_CYAN] = [[14,26], [14,26], [14,26], [14,26], [14,26], [14,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_PURPLE] = [[15,26], [15,26], [15,26], [15,26], [15,26], [15,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_BLUE] = [[16,26], [16,26], [16,26], [16,26], [16,26], [16,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_BROWN] = [[17,26], [17,26], [17,26], [17,26], [17,26], [17,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_GREEN] = [[18,26], [18,26], [18,26], [18,26], [18,26], [18,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_RED] = [[19,26], [19,26], [19,26], [19,26], [19,26], [19,26]];
BLOCK_UVS[BLOCK.SHULKER_BOX_BLACK] = [[20,26], [20,26], [20,26], [20,26], [20,26], [20,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_WHITE] = [[21,26], [21,26], [21,26], [21,26], [21,26], [21,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_ORANGE] = [[22,26], [22,26], [22,26], [22,26], [22,26], [22,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_MAGENTA] = [[23,26], [23,26], [23,26], [23,26], [23,26], [23,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_LIGHT_BLUE] = [[24,26], [24,26], [24,26], [24,26], [24,26], [24,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_YELLOW] = [[25,26], [25,26], [25,26], [25,26], [25,26], [25,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_LIME] = [[26,26], [26,26], [26,26], [26,26], [26,26], [26,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_PINK] = [[27,26], [27,26], [27,26], [27,26], [27,26], [27,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_GRAY] = [[28,26], [28,26], [28,26], [28,26], [28,26], [28,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_LIGHT_GRAY] = [[29,26], [29,26], [29,26], [29,26], [29,26], [29,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_CYAN] = [[30,26], [30,26], [30,26], [30,26], [30,26], [30,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_PURPLE] = [[31,26], [31,26], [31,26], [31,26], [31,26], [31,26]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_BLUE] = [[0,27], [0,27], [0,27], [0,27], [0,27], [0,27]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_BROWN] = [[1,27], [1,27], [1,27], [1,27], [1,27], [1,27]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_GREEN] = [[2,27], [2,27], [2,27], [2,27], [2,27], [2,27]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_RED] = [[3,27], [3,27], [3,27], [3,27], [3,27], [3,27]];
BLOCK_UVS[BLOCK.GLAZED_TERRACOTTA_BLACK] = [[4,27], [4,27], [4,27], [4,27], [4,27], [4,27]];

BLOCK_UVS[BLOCK.WOODEN_PICKAXE] = [[0,28], [0,28], [0,28], [0,28], [0,28], [0,28]];
BLOCK_UVS[BLOCK.STONE_PICKAXE] = [[1,28], [1,28], [1,28], [1,28], [1,28], [1,28]];
BLOCK_UVS[BLOCK.IRON_PICKAXE] = [[2,28], [2,28], [2,28], [2,28], [2,28], [2,28]];
BLOCK_UVS[BLOCK.GOLDEN_PICKAXE] = [[3,28], [3,28], [3,28], [3,28], [3,28], [3,28]];
BLOCK_UVS[BLOCK.DIAMOND_PICKAXE] = [[4,28], [4,28], [4,28], [4,28], [4,28], [4,28]];

BLOCK_UVS[BLOCK.WOODEN_SWORD] = [[0,29], [0,29], [0,29], [0,29], [0,29], [0,29]];
BLOCK_UVS[BLOCK.STONE_SWORD] = [[1,29], [1,29], [1,29], [1,29], [1,29], [1,29]];
BLOCK_UVS[BLOCK.IRON_SWORD] = [[2,29], [2,29], [2,29], [2,29], [2,29], [2,29]];
BLOCK_UVS[BLOCK.GOLDEN_SWORD] = [[3,29], [3,29], [3,29], [3,29], [3,29], [3,29]];
BLOCK_UVS[BLOCK.DIAMOND_SWORD] = [[4,29], [4,29], [4,29], [4,29], [4,29], [4,29]];
BLOCK_UVS[BLOCK.WOODEN_SHOVEL] = [[0,30], [0,30], [0,30], [0,30], [0,30], [0,30]];
BLOCK_UVS[BLOCK.STONE_SHOVEL] = [[1,30], [1,30], [1,30], [1,30], [1,30], [1,30]];
BLOCK_UVS[BLOCK.IRON_SHOVEL] = [[2,30], [2,30], [2,30], [2,30], [2,30], [2,30]];
BLOCK_UVS[BLOCK.GOLDEN_SHOVEL] = [[3,30], [3,30], [3,30], [3,30], [3,30], [3,30]];
BLOCK_UVS[BLOCK.DIAMOND_SHOVEL] = [[4,30], [4,30], [4,30], [4,30], [4,30], [4,30]];
BLOCK_UVS[BLOCK.WOODEN_AXE] = [[2,31], [2,31], [2,31], [2,31], [2,31], [2,31]];
BLOCK_UVS[BLOCK.STONE_AXE] = [[3,31], [3,31], [3,31], [3,31], [3,31], [3,31]];
BLOCK_UVS[BLOCK.IRON_AXE] = [[4,31], [4,31], [4,31], [4,31], [4,31], [4,31]];
BLOCK_UVS[BLOCK.GOLDEN_AXE] = [[5,31], [5,31], [5,31], [5,31], [5,31], [5,31]];
BLOCK_UVS[BLOCK.DIAMOND_AXE] = [[6,31], [6,31], [6,31], [6,31], [6,31], [6,31]];
BLOCK_UVS[BLOCK.APPLE] = [[7,31], [7,31], [7,31], [7,31], [7,31], [7,31]];
BLOCK_UVS[BLOCK.GOLDEN_APPLE] = [[8,31], [8,31], [8,31], [8,31], [8,31], [8,31]];
BLOCK_UVS[BLOCK.COOKED_BEEF] = [[9,31], [9,31], [9,31], [9,31], [9,31], [9,31]];
BLOCK_UVS[BLOCK.RAW_BEEF] = [[10,31], [10,31], [10,31], [10,31], [10,31], [10,31]];
BLOCK_UVS[BLOCK.FISHING_ROD] = [[11,31], [11,31], [11,31], [11,31], [11,31], [11,31]];
BLOCK_UVS[BLOCK.BOW] = [[12,31], [12,31], [12,31], [12,31], [12,31], [12,31]];
BLOCK_UVS[BLOCK.ARROW] = [[13,31], [13,31], [13,31], [13,31], [13,31], [13,31]];
BLOCK_UVS[BLOCK.BUCKET] = [[14,31], [14,31], [14,31], [14,31], [14,31], [14,31]];
BLOCK_UVS[BLOCK.WATER_BUCKET] = [[15,31], [15,31], [15,31], [15,31], [15,31], [15,31]];
BLOCK_UVS[BLOCK.LAVA_BUCKET] = [[16,31], [16,31], [16,31], [16,31], [16,31], [16,31]];
BLOCK_UVS[BLOCK.ENDER_PEARL] = [[17,31], [17,31], [17,31], [17,31], [17,31], [17,31]];
BLOCK_UVS[BLOCK.BONE] = [[18,31], [18,31], [18,31], [18,31], [18,31], [18,31]];
BLOCK_UVS[BLOCK.GUNPOWDER] = [[19,31], [19,31], [19,31], [19,31], [19,31], [19,31]];
BLOCK_UVS[BLOCK.STRING] = [[20,31], [20,31], [20,31], [20,31], [20,31], [20,31]];
BLOCK_UVS[BLOCK.FEATHER] = [[21,31], [21,31], [21,31], [21,31], [21,31], [21,31]];
BLOCK_UVS[BLOCK.BREAD] = [[22,31], [22,31], [22,31], [22,31], [22,31], [22,31]];
BLOCK_UVS[BLOCK.SEEDS] = [[23,31], [23,31], [23,31], [23,31], [23,31], [23,31]];
BLOCK_UVS[BLOCK.IRON_INGOT] = [[5,28], [5,28], [5,28], [5,28], [5,28], [5,28]];
BLOCK_UVS[BLOCK.GOLD_INGOT] = [[6,28], [6,28], [6,28], [6,28], [6,28], [6,28]];
BLOCK_UVS[BLOCK.DIAMOND] = [[7,28], [7,28], [7,28], [7,28], [7,28], [7,28]];
BLOCK_UVS[BLOCK.SKYCOIN] = [[8,28], [8,28], [8,28], [8,28], [8,28], [8,28]];
BLOCK_UVS[BLOCK.COAL] = [[9,28], [9,28], [9,28], [9,28], [9,28], [9,28]];
BLOCK_UVS[BLOCK.EMERALD] = [[10,28], [10,28], [10,28], [10,28], [10,28], [10,28]];
BLOCK_UVS[BLOCK.REDSTONE] = [[11,28], [11,28], [11,28], [11,28], [11,28], [11,28]];
BLOCK_UVS[BLOCK.LAPIS_LAZULI] = [[12,28], [12,28], [12,28], [12,28], [12,28], [12,28]];
BLOCK_UVS[BLOCK.COPPER_INGOT] = [[13,28], [13,28], [13,28], [13,28], [13,28], [13,28]];
BLOCK_UVS[BLOCK.HAY_BLOCK] = [[5,27], [5,27], [5,27], [5,27], [5,27], [5,27]];
BLOCK_UVS[BLOCK.DRIED_KELP_BLOCK] = [[6,27], [6,27], [6,27], [6,27], [6,27], [6,27]];
BLOCK_UVS[BLOCK.SPONGEY_HONEY] = [[7,27], [7,27], [7,27], [7,27], [7,27], [7,27]];

export function createBreakingTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  const seed = 123;
  const random = (i: number) => {
    const x = Math.sin(i + seed) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(random(i * 1.1) * size);
    const y = Math.floor(random(i * 2.2) * size);
    ctx.fillRect(x, y, 1, 1);
    if (i % 3 === 0) {
      const dirX = random(i * 3.3) > 0.5 ? 1 : -1;
      const dirY = random(i * 4.4) > 0.5 ? 1 : -1;
      ctx.fillRect(x + dirX, y, 1, 1);
      ctx.fillRect(x, y + dirY, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export const getBlockUVs = (blockType: number) => {
  return BLOCK_UVS[blockType] || [[0,26], [0,26], [0,26], [0,26], [0,26], [0,26]]; // Fallback UV
};

const IS_TRANSPARENT: boolean[] = new Array(600).fill(false);
IS_TRANSPARENT[BLOCK.AIR] = true;
IS_TRANSPARENT[BLOCK.WATER] = true;
IS_TRANSPARENT[BLOCK.WATER_1] = true;
IS_TRANSPARENT[BLOCK.WATER_2] = true;
IS_TRANSPARENT[BLOCK.WATER_3] = true;
IS_TRANSPARENT[BLOCK.WATER_4] = true;
IS_TRANSPARENT[BLOCK.WATER_5] = true;
IS_TRANSPARENT[BLOCK.WATER_6] = true;
IS_TRANSPARENT[BLOCK.WATER_7] = true;
IS_TRANSPARENT[BLOCK.GLASS] = true;
IS_TRANSPARENT[BLOCK.ICE] = true;
IS_TRANSPARENT[BLOCK.GLASS_WHITE] = true;
IS_TRANSPARENT[BLOCK.GLASS_ORANGE] = true;
IS_TRANSPARENT[BLOCK.GLASS_MAGENTA] = true;
IS_TRANSPARENT[BLOCK.GLASS_LIGHT_BLUE] = true;
IS_TRANSPARENT[BLOCK.GLASS_YELLOW] = true;
IS_TRANSPARENT[BLOCK.GLASS_LIME] = true;
IS_TRANSPARENT[BLOCK.GLASS_PINK] = true;
IS_TRANSPARENT[BLOCK.GLASS_GRAY] = true;
IS_TRANSPARENT[BLOCK.GLASS_LIGHT_GRAY] = true;
IS_TRANSPARENT[BLOCK.GLASS_CYAN] = true;
IS_TRANSPARENT[BLOCK.GLASS_PURPLE] = true;
IS_TRANSPARENT[BLOCK.GLASS_BLUE] = true;
IS_TRANSPARENT[BLOCK.GLASS_BROWN] = true;
IS_TRANSPARENT[BLOCK.GLASS_GREEN] = true;
IS_TRANSPARENT[BLOCK.GLASS_RED] = true;
IS_TRANSPARENT[BLOCK.GLASS_BLACK] = true;
IS_TRANSPARENT[BLOCK.SLIME_BLOCK] = true;
IS_TRANSPARENT[BLOCK.HONEY_BLOCK] = true;
IS_TRANSPARENT[BLOCK.ACACIA_LEAVES] = true;
IS_TRANSPARENT[BLOCK.JUNGLE_LEAVES] = true;
IS_TRANSPARENT[BLOCK.MANGROVE_LEAVES] = true;
IS_TRANSPARENT[BLOCK.TINTED_GLASS] = true;
IS_TRANSPARENT[BLOCK.SLIME_BLOCK] = true;
IS_TRANSPARENT[BLOCK.HONEY_BLOCK] = true;
IS_TRANSPARENT[BLOCK.ACACIA_LEAVES] = true;
IS_TRANSPARENT[BLOCK.JUNGLE_LEAVES] = true;

export const isTransparent = (blockType: number) => {
  return IS_TRANSPARENT[blockType];
};

const IS_CUTOUT: boolean[] = new Array(600).fill(false);
IS_CUTOUT[BLOCK.LEAVES] = true;
// ... (adding tool cutouts)
IS_CUTOUT[BLOCK.WOODEN_PICKAXE] = true;
IS_CUTOUT[BLOCK.STONE_PICKAXE] = true;
IS_CUTOUT[BLOCK.IRON_PICKAXE] = true;
IS_CUTOUT[BLOCK.GOLDEN_PICKAXE] = true;
IS_CUTOUT[BLOCK.DIAMOND_PICKAXE] = true;
IS_CUTOUT[BLOCK.WOODEN_SWORD] = true;
IS_CUTOUT[BLOCK.STONE_SWORD] = true;
IS_CUTOUT[BLOCK.IRON_SWORD] = true;
IS_CUTOUT[BLOCK.GOLDEN_SWORD] = true;
IS_CUTOUT[BLOCK.DIAMOND_SWORD] = true;
IS_CUTOUT[BLOCK.WOODEN_SHOVEL] = true;
IS_CUTOUT[BLOCK.STONE_SHOVEL] = true;
IS_CUTOUT[BLOCK.IRON_SHOVEL] = true;
IS_CUTOUT[BLOCK.GOLDEN_SHOVEL] = true;
IS_CUTOUT[BLOCK.DIAMOND_SHOVEL] = true;
IS_CUTOUT[BLOCK.WOODEN_AXE] = true;
IS_CUTOUT[BLOCK.STONE_AXE] = true;
IS_CUTOUT[BLOCK.IRON_AXE] = true;
IS_CUTOUT[BLOCK.GOLDEN_AXE] = true;
IS_CUTOUT[BLOCK.DIAMOND_AXE] = true;
IS_CUTOUT[BLOCK.APPLE] = true;
IS_CUTOUT[BLOCK.GOLDEN_APPLE] = true;
IS_CUTOUT[BLOCK.COOKED_BEEF] = true;
IS_CUTOUT[BLOCK.RAW_BEEF] = true;
IS_CUTOUT[BLOCK.FISHING_ROD] = true;
IS_CUTOUT[BLOCK.BOW] = true;
IS_CUTOUT[BLOCK.ARROW] = true;
IS_CUTOUT[BLOCK.BUCKET] = true;
IS_CUTOUT[BLOCK.WATER_BUCKET] = true;
IS_CUTOUT[BLOCK.LAVA_BUCKET] = true;
IS_CUTOUT[BLOCK.ENDER_PEARL] = true;
IS_CUTOUT[BLOCK.BONE] = true;
IS_CUTOUT[BLOCK.GUNPOWDER] = true;
IS_CUTOUT[BLOCK.STRING] = true;
IS_CUTOUT[BLOCK.FEATHER] = true;
IS_CUTOUT[BLOCK.BREAD] = true;
IS_CUTOUT[BLOCK.SEEDS] = true;
IS_CUTOUT[BLOCK.IRON_INGOT] = true;
IS_CUTOUT[BLOCK.GOLD_INGOT] = true;
IS_CUTOUT[BLOCK.DIAMOND] = true;
IS_CUTOUT[BLOCK.COAL] = true;
IS_CUTOUT[BLOCK.EMERALD] = true;
IS_CUTOUT[BLOCK.REDSTONE] = true;
IS_CUTOUT[BLOCK.LAPIS_LAZULI] = true;
IS_CUTOUT[BLOCK.COPPER_INGOT] = true;
IS_CUTOUT[BLOCK.SKYCOIN] = true;
IS_CUTOUT[BLOCK.ASPECT_OF_THE_END] = true;
IS_CUTOUT[BLOCK.MINION] = true;
IS_CUTOUT[BLOCK.SUGAR_CANE] = true;
IS_CUTOUT[BLOCK.BIRCH_LEAVES] = true;
IS_CUTOUT[BLOCK.SPRUCE_LEAVES] = true;
IS_CUTOUT[BLOCK.TALL_GRASS] = true;
IS_CUTOUT[BLOCK.FLOWER_RED] = true;
IS_CUTOUT[BLOCK.FLOWER_YELLOW] = true;
IS_CUTOUT[BLOCK.WHEAT] = true;
IS_CUTOUT[BLOCK.DEAD_BUSH] = true;
IS_CUTOUT[BLOCK.MUSHROOM_RED] = true;
IS_CUTOUT[BLOCK.MUSHROOM_BROWN] = true;
IS_CUTOUT[BLOCK.CHERRY_LEAVES] = true;
IS_CUTOUT[BLOCK.DARK_OAK_LEAVES] = true;
IS_CUTOUT[BLOCK.ACACIA_LEAVES] = true;
IS_CUTOUT[BLOCK.JUNGLE_LEAVES] = true;
IS_CUTOUT[BLOCK.MANGROVE_LEAVES] = true;
IS_CUTOUT[BLOCK.AZALEA] = true;
IS_CUTOUT[BLOCK.FLOWERING_AZALEA] = true;
IS_CUTOUT[BLOCK.SPORE_BLOSSOM] = true;
IS_CUTOUT[BLOCK.CAVE_VINES] = true;
IS_CUTOUT[BLOCK.POINTED_DRIPSTONE] = true;
IS_CUTOUT[BLOCK.AMETHYST_CLUSTER] = true;
IS_CUTOUT[BLOCK.LARGE_AMETHYST_BUD] = true;
IS_CUTOUT[BLOCK.MEDIUM_AMETHYST_BUD] = true;
IS_CUTOUT[BLOCK.SMALL_AMETHYST_BUD] = true;
IS_CUTOUT[BLOCK.LIGHTNING_ROD] = true;
IS_CUTOUT[BLOCK.CANDLE] = true;
IS_CUTOUT[BLOCK.POTTED_AZALEA] = true;
IS_CUTOUT[BLOCK.MOSS_CARPET] = true;
IS_CUTOUT[BLOCK.TORCH] = true;
IS_CUTOUT[BLOCK.TORCH_WALL_X_POS] = true;
IS_CUTOUT[BLOCK.TORCH_WALL_X_NEG] = true;
IS_CUTOUT[BLOCK.TORCH_WALL_Z_POS] = true;
IS_CUTOUT[BLOCK.TORCH_WALL_Z_NEG] = true;
IS_CUTOUT[BLOCK.LAUNCHER] = true;
IS_CUTOUT[BLOCK.LAUNCHER_WALL_X_POS] = true;
IS_CUTOUT[BLOCK.LAUNCHER_WALL_X_NEG] = true;
IS_CUTOUT[BLOCK.LAUNCHER_WALL_Z_POS] = true;
IS_CUTOUT[BLOCK.LAUNCHER_WALL_Z_NEG] = true;

export const isCutout = (blockType: number) => {
  return IS_CUTOUT[blockType] || false;
};

const IS_SLAB: boolean[] = new Array(600).fill(false);
IS_SLAB[BLOCK.SLAB_STONE] = true;
IS_SLAB[BLOCK.SLAB_BLUE_STONE] = true;
IS_SLAB[BLOCK.SLAB_RED_STONE] = true;
IS_SLAB[BLOCK.SLAB_WOOD] = true;
IS_SLAB[BLOCK.MOSS_CARPET] = true;

export const isSlab = (blockType: number) => {
  return IS_SLAB[blockType] || false;
};

const IS_SOLID: boolean[] = new Array(600).fill(true);
IS_SOLID[BLOCK.AIR] = false;
IS_SOLID[BLOCK.WATER] = false;
IS_SOLID[BLOCK.WATER_1] = false;
IS_SOLID[BLOCK.WATER_2] = false;
IS_SOLID[BLOCK.WATER_3] = false;
IS_SOLID[BLOCK.WATER_4] = false;
IS_SOLID[BLOCK.WATER_5] = false;
IS_SOLID[BLOCK.WATER_6] = false;
IS_SOLID[BLOCK.WATER_7] = false;
IS_SOLID[BLOCK.GLASS] = true;
IS_SOLID[BLOCK.TALL_GRASS] = false;
IS_SOLID[BLOCK.FLOWER_RED] = false;
IS_SOLID[BLOCK.FLOWER_YELLOW] = false;
IS_SOLID[BLOCK.WHEAT] = false;
IS_SOLID[BLOCK.DEAD_BUSH] = false;
IS_SOLID[BLOCK.LAVA] = false;
IS_SOLID[BLOCK.MUSHROOM_RED] = false;
IS_SOLID[BLOCK.MUSHROOM_BROWN] = false;
IS_SOLID[BLOCK.SCULK_SENSOR] = false;
IS_SOLID[BLOCK.SCULK_SHRIEKER] = false;
IS_SOLID[BLOCK.GLOWSTONE] = true;
IS_SOLID[BLOCK.MOSS_CARPET] = false;
IS_SOLID[BLOCK.TORCH] = false;
IS_SOLID[BLOCK.TORCH_WALL_X_POS] = false;
IS_SOLID[BLOCK.TORCH_WALL_X_NEG] = false;
IS_SOLID[BLOCK.TORCH_WALL_Z_POS] = false;
IS_SOLID[BLOCK.TORCH_WALL_Z_NEG] = false;
IS_SOLID[BLOCK.LAUNCHER] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_X_POS] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_X_NEG] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_Z_POS] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_Z_NEG] = false;
IS_SOLID[BLOCK.AZALEA] = false;
IS_SOLID[BLOCK.FLOWERING_AZALEA] = false;
IS_SOLID[BLOCK.SPORE_BLOSSOM] = false;
IS_SOLID[BLOCK.CAVE_VINES] = false;
IS_SOLID[BLOCK.POINTED_DRIPSTONE] = false;
IS_SOLID[BLOCK.AMETHYST_CLUSTER] = false;
IS_SOLID[BLOCK.LARGE_AMETHYST_BUD] = false;
IS_SOLID[BLOCK.MEDIUM_AMETHYST_BUD] = false;
IS_SOLID[BLOCK.SMALL_AMETHYST_BUD] = false;
IS_SOLID[BLOCK.CANDLE] = false;

export const isSolidBlock = (blockType: number) => {
  return IS_SOLID[blockType] ?? true;
};

const IS_PLANT: boolean[] = new Array(600).fill(false);
IS_PLANT[BLOCK.TALL_GRASS] = true;
// ... (adding tool cutouts)
IS_PLANT[BLOCK.WOODEN_PICKAXE] = true;
IS_PLANT[BLOCK.STONE_PICKAXE] = true;
IS_PLANT[BLOCK.IRON_PICKAXE] = true;
IS_PLANT[BLOCK.GOLDEN_PICKAXE] = true;
IS_PLANT[BLOCK.DIAMOND_PICKAXE] = true;
IS_PLANT[BLOCK.WOODEN_SWORD] = true;
IS_PLANT[BLOCK.STONE_SWORD] = true;
IS_PLANT[BLOCK.IRON_SWORD] = true;
IS_PLANT[BLOCK.GOLDEN_SWORD] = true;
IS_PLANT[BLOCK.DIAMOND_SWORD] = true;
IS_PLANT[BLOCK.WOODEN_SHOVEL] = true;
IS_PLANT[BLOCK.STONE_SHOVEL] = true;
IS_PLANT[BLOCK.IRON_SHOVEL] = true;
IS_PLANT[BLOCK.GOLDEN_SHOVEL] = true;
IS_PLANT[BLOCK.DIAMOND_SHOVEL] = true;
IS_PLANT[BLOCK.WOODEN_AXE] = true;
IS_PLANT[BLOCK.STONE_AXE] = true;
IS_PLANT[BLOCK.IRON_AXE] = true;
IS_PLANT[BLOCK.GOLDEN_AXE] = true;
IS_PLANT[BLOCK.DIAMOND_AXE] = true;
IS_PLANT[BLOCK.APPLE] = true;
IS_PLANT[BLOCK.GOLDEN_APPLE] = true;
IS_PLANT[BLOCK.COOKED_BEEF] = true;
IS_PLANT[BLOCK.RAW_BEEF] = true;
IS_PLANT[BLOCK.FISHING_ROD] = true;
IS_PLANT[BLOCK.BOW] = true;
IS_PLANT[BLOCK.ARROW] = true;
IS_PLANT[BLOCK.BUCKET] = true;
IS_PLANT[BLOCK.WATER_BUCKET] = true;
IS_PLANT[BLOCK.LAVA_BUCKET] = true;
IS_PLANT[BLOCK.ENDER_PEARL] = true;
IS_PLANT[BLOCK.BONE] = true;
IS_PLANT[BLOCK.GUNPOWDER] = true;
IS_PLANT[BLOCK.STRING] = true;
IS_PLANT[BLOCK.FEATHER] = true;
IS_PLANT[BLOCK.BREAD] = true;
IS_PLANT[BLOCK.SEEDS] = true;
IS_PLANT[BLOCK.IRON_INGOT] = true;
IS_PLANT[BLOCK.GOLD_INGOT] = true;
IS_PLANT[BLOCK.DIAMOND] = true;
IS_PLANT[BLOCK.COAL] = true;
IS_PLANT[BLOCK.EMERALD] = true;
IS_PLANT[BLOCK.REDSTONE] = true;
IS_PLANT[BLOCK.LAPIS_LAZULI] = true;
IS_PLANT[BLOCK.COPPER_INGOT] = true;
IS_PLANT[BLOCK.ASPECT_OF_THE_END] = true;
IS_PLANT[BLOCK.MINION] = true;
IS_PLANT[BLOCK.SUGAR_CANE] = true;
IS_PLANT[BLOCK.FLOWER_RED] = true;
IS_PLANT[BLOCK.FLOWER_YELLOW] = true;
IS_PLANT[BLOCK.WHEAT] = true;
IS_PLANT[BLOCK.DEAD_BUSH] = true;
IS_PLANT[BLOCK.MUSHROOM_RED] = true;
IS_PLANT[BLOCK.MUSHROOM_BROWN] = true;
IS_PLANT[BLOCK.AZALEA] = true;
IS_PLANT[BLOCK.FLOWERING_AZALEA] = true;
IS_PLANT[BLOCK.SPORE_BLOSSOM] = true;
IS_PLANT[BLOCK.CAVE_VINES] = true;
IS_PLANT[BLOCK.POINTED_DRIPSTONE] = true;
IS_PLANT[BLOCK.AMETHYST_CLUSTER] = true;
IS_PLANT[BLOCK.LARGE_AMETHYST_BUD] = true;
IS_PLANT[BLOCK.MEDIUM_AMETHYST_BUD] = true;
IS_PLANT[BLOCK.SMALL_AMETHYST_BUD] = true;
IS_PLANT[BLOCK.LIGHTNING_ROD] = true;
IS_PLANT[BLOCK.CANDLE] = true;
IS_PLANT[BLOCK.POTTED_AZALEA] = true;
IS_PLANT[BLOCK.TORCH] = true;
IS_PLANT[BLOCK.TORCH_WALL_X_POS] = true;
IS_PLANT[BLOCK.TORCH_WALL_X_NEG] = true;
IS_PLANT[BLOCK.TORCH_WALL_Z_POS] = true;
IS_PLANT[BLOCK.TORCH_WALL_Z_NEG] = true;

export const isPlant = (blockType: number) => {
  return IS_PLANT[blockType] || false;
};

export const isAnyTorch = (blockType: number) => {
  return blockType === BLOCK.TORCH || 
         blockType === BLOCK.TORCH_WALL_X_POS || 
         blockType === BLOCK.TORCH_WALL_X_NEG || 
         blockType === BLOCK.TORCH_WALL_Z_POS || 
         blockType === BLOCK.TORCH_WALL_Z_NEG;
};

export const isFlatItem = (blockType: number) => {
  return (blockType >= BLOCK.WOODEN_PICKAXE && blockType <= 472) || // Tools, Food, Rod, Bow, Arrow, Bucket, Drops, Misc
    (blockType >= 500 && blockType <= 509) || // Minion, Skycoin, Materials
    blockType === 54 || // ASPECT_OF_THE_END
    blockType === 13 || // STICK
    isAnyTorch(blockType) ||
    (blockType >= 317 && blockType <= 322) || // Iron Bars, Chain, Lanterns, Campfires
    blockType === 325 || // Cobweb
    blockType === 300; // Lily Pad
};

const IS_LEAVES: boolean[] = new Array(600).fill(false);
IS_LEAVES[BLOCK.LEAVES] = true;
IS_LEAVES[BLOCK.BIRCH_LEAVES] = true;
IS_LEAVES[BLOCK.SPRUCE_LEAVES] = true;
IS_LEAVES[BLOCK.CHERRY_LEAVES] = true;
IS_LEAVES[BLOCK.DARK_OAK_LEAVES] = true;
IS_LEAVES[BLOCK.ACACIA_LEAVES] = true;
IS_LEAVES[BLOCK.JUNGLE_LEAVES] = true;
IS_LEAVES[BLOCK.MANGROVE_LEAVES] = true;

export const isLeaves = (blockType: number) => {
  return IS_LEAVES[blockType] || false;
};

export const isLightEmitting = (blockType: number) => {
  return blockType === BLOCK.TORCH || 
         blockType === BLOCK.GLOWSTONE || 
         blockType === BLOCK.LANTERN || 
         blockType === BLOCK.SOUL_LANTERN || 
         blockType === BLOCK.CAMPFIRE || 
         blockType === BLOCK.SOUL_CAMPFIRE || 
         blockType === BLOCK.SHROOMLIGHT || 
         blockType === BLOCK.CANDLE || 
         blockType === BLOCK.TORCHFLOWER ||
         blockType === BLOCK.LAVA ||
         blockType === BLOCK.REDSTONE_LAMP;
};
