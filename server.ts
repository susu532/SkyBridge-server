import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import itemsData from './data/items.json';
import npcsData from './src/game/data/npcs.json';
import bakedBlocksData from './data/bakedBlocks.json';
import { createNoise2D, createNoise3D } from 'simplex-noise';

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

const prng = createPRNG('skyBridge-seed-v1');
const noise2D = createNoise2D(prng);
const noise3D = createNoise3D(prng);

function getTerrainHeight(wx_raw: number, wz_raw: number) {
  const wx = Math.floor(wx_raw);
  const wz = Math.floor(wz_raw);
  
  // Blue Castle & Village (Z: 70 to 180, X: -50 to 50)
  const dxBlue = Math.max(0, Math.abs(wx) - 50);
  const dzBlue = Math.max(0, 70 - wz, wz - 180);
  const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

  // Red Castle & Village (Z: -180 to -70, X: -50 to 50)
  const dxRed = Math.max(0, Math.abs(wx) - 50);
  const dzRed = Math.max(0, -180 - wz, wz - -70);
  const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

  const distToProtected = Math.min(distBlue, distRed);
  const baseHeight = 64;
  
  // Biome selection noise
  const tempNoise = noise2D(wx * 0.002, wz * 0.002);
  const moistNoise = noise2D(wx * 0.002 + 1000, wz * 0.002 + 1000);
  
  let biomeScale = 0.01;
  let biomeHeight = 5;
  
  if (tempNoise < -0.6) {
    biomeScale = 0.02; biomeHeight = 15; // ICE_SPIKES
  } else if (tempNoise < -0.3) {
    if (moistNoise < 0) { biomeScale = 0.015; biomeHeight = 10; } // SNOWY_TUNDRA
    else { biomeScale = 0.02; biomeHeight = 20; } // TAIGA
  } else if (tempNoise < 0.0) {
    if (moistNoise < -0.3) { biomeScale = 0.015; biomeHeight = 35; } // CHERRY_GROVE
    else if (moistNoise < 0.3) { biomeScale = 0.02; biomeHeight = 15; } // FOREST
    else { biomeScale = 0.02; biomeHeight = 15; } // DARK_FOREST
  } else if (tempNoise < 0.3) {
    if (moistNoise < -0.3) { biomeScale = 0.008; biomeHeight = 8; } // SAVANNA
    else if (moistNoise < 0.3) { biomeScale = 0.01; biomeHeight = 5; } // PLAINS
    else { biomeScale = 0.015; biomeHeight = 2; } // SWAMP
  } else if (tempNoise < 0.6) {
    if (moistNoise < -0.4) { biomeScale = 0.01; biomeHeight = 25; } // BADLANDS
    else if (moistNoise < 0.4) { biomeScale = 0.01; biomeHeight = 8; } // DESERT
    else { biomeScale = 0.025; biomeHeight = 25; } // JUNGLE
  } else {
    if (moistNoise < -0.4) { biomeScale = 0.02; biomeHeight = 30; } // VOLCANIC
    else if (moistNoise < 0.4) { biomeScale = 0.015; biomeHeight = 10; } // MUSHROOM_ISLAND
    else { biomeScale = 0.025; biomeHeight = 25; } // JUNGLE
  }
  
  const elevationNoise = noise2D(wx * 0.001, wz * 0.001);
  if (elevationNoise < -0.5) { biomeScale = 0.01; biomeHeight = -15; } // OCEAN
  else if (elevationNoise > 0.6) { biomeScale = 0.005; biomeHeight = 60; } // MOUNTAINS

  const n1 = noise2D(wx * biomeScale, wz * biomeScale);
  const n2 = noise2D(wx * biomeScale * 4, wz * biomeScale * 4) * 0.5;
  const n3 = noise2D(wx * biomeScale * 16, wz * biomeScale * 16) * 0.25;
  
  let mountainHeight = (n1 + n2 + n3) * biomeHeight;
  
  const distFromCenter = Math.sqrt(wx * wx + wz * wz);
  if (distFromCenter > 800 - 100) {
    const edgeFactor = Math.min(1, (distFromCenter - (800 - 100)) / 100);
    mountainHeight = mountainHeight * (1 - edgeFactor) - 30 * edgeFactor;
  }

  const targetHeight = baseHeight + mountainHeight;
  const blendDist = 30;
  let blendFactor = Math.min(1, distToProtected / blendDist);
  blendFactor = blendFactor * blendFactor * (3 - 2 * blendFactor);

  const finalHeight = Math.floor(baseHeight * (1 - blendFactor) + targetHeight * blendFactor);
  return finalHeight - 60; // Convert to world Y (WORLD_Y_OFFSET is -60)
}

function isNature(wx_raw: number, wz_raw: number) {
  const wx = Math.floor(wx_raw);
  const wz = Math.floor(wz_raw);
  
  // Mobs only spawn on the islands, not in the void between them
  const isBlueSide = wz >= 70;
  const isRedSide = wz <= -70;
  if (!isBlueSide && !isRedSide) return false;

  // Blue Castle & Village (Z: 70 to 180, X: -50 to 50)
  const dxBlue = Math.max(0, Math.abs(wx) - 50);
  const dzBlue = Math.max(0, 70 - wz, wz - 180);
  const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);

  // Red Castle & Village (Z: -180 to -70, X: -50 to 50)
  const dxRed = Math.max(0, Math.abs(wx) - 50);
  const dzRed = Math.max(0, -180 - wz, wz - -70);
  const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);

  const distToProtected = Math.min(distBlue, distRed);
  
  // Don't spawn in protected areas or too close to them
  if (distToProtected <= 10) return false;

  // Don't spawn in the ocean (water level is 62, which is 2 in world Y)
  const groundY = getTerrainHeight(wx, wz);
  if (groundY < 3) return false; // 3 is 1 block above water surface
  
  return true;
}

async function startServer() {
  const app = express();

  // --- SECURITY MIDDLEWARES ---
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://sky-bridge-teal-two.vercel.app'
  ];

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use(limiter);
  // -----------------------------

  const PORT = process.env.PORT || 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { 
      origin: allowedOrigins,
      methods: ["GET", "POST"]
    }
  });

  // BAKED_BLOCKS_START
  const bakedBlocks = new Map<string, number>(Object.entries(bakedBlocksData));
  // BAKED_BLOCKS_END

  function createGameServer(namespacePrefix: string, worldDataFileName: string, isHubMode: boolean) {
    const ioNamespace = io.of(namespacePrefix);
    const WORLD_DATA_FILE = path.join(process.cwd(), worldDataFileName);
    let blockChanges: Record<string, number> = {}; 
    let npcs: any[] = [];
    const players: Record<string, any> = {};
    
    // Load saved world data if it exists
    try {
      if (fs.existsSync(WORLD_DATA_FILE)) {
        const data = fs.readFileSync(WORLD_DATA_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.blockChanges) {
          blockChanges = parsed.blockChanges;
          // Load npcs from save, fallback to npcs.json
          const defaultNpcs = (npcsData as any)[namespacePrefix.replace('/', '')] || [];
          npcs = parsed.npcs && parsed.npcs.length > 0 ? parsed.npcs : defaultNpcs;
        } else {
          // Backward compatibility
          blockChanges = parsed;
          const defaultNpcs = (npcsData as any)[namespacePrefix.replace('/', '')] || [];
          npcs = defaultNpcs;
        }
        console.log(`Loaded ${Object.keys(blockChanges).length} block changes and ${npcs.length} NPCs from ${worldDataFileName}`);
      } else {
        const defaultNpcs = (npcsData as any)[namespacePrefix.replace('/', '')] || [];
        npcs = defaultNpcs;
      }
    } catch (err) {
      console.error('Error loading world data:', err);
      npcs = (npcsData as any)[namespacePrefix.replace('/', '')] || [];
    }
  
    // Periodic save function
    const saveWorldData = () => {
      try {
        fs.writeFile(WORLD_DATA_FILE, JSON.stringify({ blockChanges, npcs }), (err) => {
          if (err) console.error('Error saving world data:', err);
        });
      } catch (err) {
        console.error('Error triggering world save:', err);
      }
    };
  
    // Save world data every 10 seconds
    setInterval(saveWorldData, 10000);
  
    const droppedItems: Record<string, any> = {};
    const mobs: Record<string, any> = {};
    const minions: Record<string, any> = {};
    const pendingPlayerUpdates = new Set<string>();
  
    let dayTime = 0;
    const dayCycleSpeed = 0.0008;
  
    const BLOCK = {
      AIR: 0,
      LEAVES: 5,
      WATER: 7,
      GLASS: 8,
      TALL_GRASS: 26,
      FLOWER_RED: 27,
      FLOWER_YELLOW: 28,
      WHEAT: 29,
      BIRCH_LEAVES: 31,
      SPRUCE_LEAVES: 33,
      DEAD_BUSH: 35,
      LAVA: 42,
      MUSHROOM_RED: 43,
      MUSHROOM_BROWN: 44,
      CHERRY_LEAVES: 50,
      DARK_OAK_LEAVES: 52,
      GLOWSTONE: 53,
      OBSIDIAN: 41,
      CALCITE: 164,
      TUFF: 165,
      DRIPSTONE_BLOCK: 166,
      SCULK_SENSOR: 265,
      SCULK_SHRIEKER: 264,
      TUBE_CORAL_BLOCK: 270,
      BRAIN_CORAL_BLOCK: 271,
      BUBBLE_CORAL_BLOCK: 272,
      FIRE_CORAL_BLOCK: 273,
      HORN_CORAL_BLOCK: 274,
      DEAD_TUBE_CORAL_BLOCK: 275,
      DEAD_BRAIN_CORAL_BLOCK: 276,
      DEAD_BUBBLE_CORAL_BLOCK: 277,
      DEAD_FIRE_CORAL_BLOCK: 278,
      DEAD_HORN_CORAL_BLOCK: 279,
      MOSS_BLOCK: 280,
      MOSS_CARPET: 281,
      AZALEA: 282,
      FLOWERING_AZALEA: 283,
      SPORE_BLOSSOM: 284,
      CAVE_VINES: 285,
      POINTED_DRIPSTONE: 287,
      AMETHYST_CLUSTER: 292,
      LARGE_AMETHYST_BUD: 293,
      MEDIUM_AMETHYST_BUD: 294,
      SMALL_AMETHYST_BUD: 295,
      TORCH: 297,
      CANDLE: 298,
      GLOW_LICHEN: 299,
      TORCH_WALL_X_POS: 304,
      TORCH_WALL_X_NEG: 305,
      TORCH_WALL_Z_POS: 306,
      TORCH_WALL_Z_NEG: 307,
      TORCHFLOWER: 355
    };
  
    function isSolidBlock(type: number) {
      return type !== BLOCK.AIR && 
             type !== BLOCK.WATER && 
             !(type >= 19 && type <= 25) && // WATER_1 through WATER_7
             type !== BLOCK.TALL_GRASS &&
             type !== BLOCK.FLOWER_RED &&
             type !== BLOCK.FLOWER_YELLOW &&
             type !== BLOCK.WHEAT &&
             type !== BLOCK.DEAD_BUSH &&
             type !== BLOCK.LAVA &&
             type !== BLOCK.MUSHROOM_RED &&
             type !== BLOCK.MUSHROOM_BROWN &&
             type !== BLOCK.SCULK_SENSOR &&
             type !== BLOCK.SCULK_SHRIEKER &&
             type !== BLOCK.MOSS_CARPET &&
             type !== BLOCK.AZALEA &&
             type !== BLOCK.FLOWERING_AZALEA &&
             type !== BLOCK.SPORE_BLOSSOM &&
             type !== BLOCK.CAVE_VINES &&
             type !== BLOCK.POINTED_DRIPSTONE &&
             type !== BLOCK.AMETHYST_CLUSTER &&
             type !== BLOCK.LARGE_AMETHYST_BUD &&
             type !== BLOCK.MEDIUM_AMETHYST_BUD &&
             type !== BLOCK.SMALL_AMETHYST_BUD &&
             type !== BLOCK.CANDLE &&
             type !== BLOCK.GLOW_LICHEN &&
             type !== BLOCK.TORCH &&
             type !== BLOCK.TORCH_WALL_X_POS &&
             type !== BLOCK.TORCH_WALL_X_NEG &&
             type !== BLOCK.TORCH_WALL_Z_POS &&
             type !== BLOCK.TORCH_WALL_Z_NEG &&
             type !== BLOCK.TORCHFLOWER;
    }
  
    // Indestructible blocks (baked builds, bedrock, castles, villages)
    function isIndestructible(x: number, y: number, z: number): boolean {
      if (isHubMode) return true; // Entire hub is indestructible
      const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
      if (bakedBlocks.has(key)) return true;
  
      // Bedrock is always indestructible
      if (y === -60) return true;
  
      // Castle footprints (including fences/walls at +-30)
      const isWithinX = x >= -30 && x <= 30;
      const isBlueCastleZ = z >= 70 && z <= 130;
      const isRedCastleZ = z >= -130 && z <= -70;
  
      // Castles and the grass layer immediately beneath them (y=4)
      if (isWithinX && (isBlueCastleZ || isRedCastleZ) && y >= 4) {
        return true;
      }
  
      // Village boundaries (protected area)
      const isBlueVillageZ = z >= 131 && z <= 180;
      const isRedVillageZ = z >= -180 && z <= -131;
      const isVillageX = x >= -50 && x <= 50;
      if (isVillageX && (isBlueVillageZ || isRedVillageZ) && y >= 4) {
        return true;
      }
  
      return false;
    }
  
    function getBlockAt(x: number, y: number, z: number) {
      if (isHubMode) {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        
        // Portal to SkyBridge (Force at Y=3 floor level)
        if (z === 15 && Math.abs(x) <= 2) {
           if (Math.abs(x) === 2) {
              if (y >= 3 && y <= 7) return BLOCK.OBSIDIAN;
           } else {
              if (y === 7) return BLOCK.OBSIDIAN;
              if (y >= 3 && y <= 6) return BLOCK.LAVA;
           }
        }

        if (blockChanges[key] !== undefined) return blockChanges[key];
        
        const distSq = x * x + z * z;
        if (distSq <= 7225) { // 85 radius squared
          if (y === -60) return 1; // Bedrock
          if (y >= -60 && y < 0) return 1; // Stone/Dirt
          if (y === 0) return 115; // Polished Andesite
        }
        return BLOCK.AIR;
      }

      const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
      if (blockChanges[key] !== undefined) return blockChanges[key];
      if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;
      
      // Match client-side void/island logic
      const isBlueSide = z >= 70;
      const isRedSide = z <= -70;
      const isVoid = !isBlueSide && !isRedSide;
      const isBridge = isVoid && x >= -8 && x <= 8;
  
      if (isBridge) {
        // Bridge is at world Y=0 to 4 (60 to 64 in absolute height)
        if (y >= 0 && y <= 4) return 1;
        return BLOCK.AIR;
      }
  
      if (isVoid) return BLOCK.AIR;
  
      const groundY = getTerrainHeight(x, z);
      // A block at groundY occupies [groundY, groundY + 1)
      if (y >= groundY && y < groundY + 1) return 1; 
      
      if (y < groundY) {
        // Check for caves
        const dxBlue = Math.max(0, Math.abs(x) - 50);
        const dzBlue = Math.max(0, 70 - z, z - 180);
        const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);
  
        const dxRed = Math.max(0, Math.abs(x) - 50);
        const dzRed = Math.max(0, -180 - z, z - -70);
        const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);
  
        const distToProtected = Math.min(distBlue, distRed);
        const isAreaProtected = distToProtected === 0;
        
        const isVillageOrCastle = (x >= -50 && x <= 50) && ((z >= 70 && z <= 410) || (z <= -70 && z >= -410));
        const isBridgeArea = x >= -12 && x <= 12 && z > -70 && z < 70;
        const isProtected = isVillageOrCastle || isBridgeArea || isAreaProtected;
  
        const elevationNoise = noise2D(x * 0.001, z * 0.001);
        const isOcean = elevationNoise < -0.5;
  
        const hasCaves = !isProtected && !isOcean && noise2D(x * 0.01, z * 0.01) > 0.3;
        
        const cy = y + 60;
        const cTerrainHeight = groundY + 60;
        
        if (hasCaves && cy > 1 && cy < cTerrainHeight - 4) {
          let isCave = false;
          const caveNoise1 = noise3D(x * 0.015, cy * 0.015, z * 0.015);
          const caveNoise2 = noise3D(x * 0.015 + 1000, cy * 0.015 + 1000, z * 0.015 + 1000);
          const tunnelRadius = 0.08 + noise3D(x * 0.005, cy * 0.005, z * 0.005) * 0.05;
          if (Math.abs(caveNoise1) < tunnelRadius && Math.abs(caveNoise2) < tunnelRadius) {
            isCave = true;
          }
          
          const cavernNoise = noise3D(x * 0.008, cy * 0.01, z * 0.008);
          if (cavernNoise > 0.3) {
            isCave = true;
          }
  
          if (isCave) {
            if (cy < 10) {
              return BLOCK.LAVA;
            }
            return BLOCK.AIR;
          }
        }
        return 1; // Below ground is solid
      }
      
      // Above ground
      if (y < 2) { // Water level is 62, which is 2 in absolute coordinates (62 - 60)
        const tempNoise = noise2D(x * 0.002, z * 0.002);
        const moistNoise = noise2D(x * 0.002 + 1000, z * 0.002 + 1000);
        if (tempNoise >= 0.6 && moistNoise < -0.4) {
          return BLOCK.LAVA;
        }
        return BLOCK.WATER;
      }
      
      return BLOCK.AIR;
    }
  
    function spawnMob(type: string, x: number, y: number, z: number, level?: number) {
      const id = 'mob_' + Math.random().toString(36).substring(2, 9);
      
      const isHostile = ['Zombie', 'Creeper', 'Skeleton', 'Slime'].includes(type);
      
      let mobLvl = 1;
      let hp = 100;
      let scale = 1;
      
      if (isHostile) {
        if (level !== undefined && level >= 1) {
           mobLvl = level;
        } else {
           mobLvl = 1;
           for (let i = 2; i <= 13; i++) {
             if (Math.random() < Math.pow(0.8, i - 1)) {
               mobLvl = i;
             } else {
               break;
             }
           }
        }
        hp = 100 + (mobLvl - 1) * 20; 
        scale = 1 + (mobLvl - 1) * 0.1;
      }

      const mob = {
        id,
        type,
        level: mobLvl,
        scale,
        position: { x, y, z },
        velocity: { x: 0, y: 0, z: 0 },
        health: hp,
        maxHealth: hp,
        targetId: null,
        isGrounded: false
      };
      mobs[id] = mob;
      console.log(`Spawned Lv${mobLvl} ${type} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
      ioNamespace.emit('mobSpawned', mob);
    }
  
    ioNamespace.on('connection', (socket) => {
      console.log('Player connected:', socket.id);
  
      // Send current state to new player
      socket.emit('init', {
        players,
        blockChanges,
        droppedItems,
        mobs,
        minions,
        dayTime,
        npcs
      });
  
      // Handle player join
      socket.on('join', (data) => {
        players[socket.id] = {
          id: socket.id,
          position: data.position,
          rotation: data.rotation,
          skinSeed: data.skinSeed || socket.id,
          name: data.name || 'Unknown Player',
          health: 100,
          maxHealth: 100,
          skills: data.skills || {},
          heldItem: data.heldItem || 0,
          offHandItem: data.offHandItem || 0
        };
        socket.broadcast.emit('playerJoined', players[socket.id]);
      });
  
      // Handle skill updates
      socket.on('skillUpdate', (data) => {
        if (players[socket.id]) {
          if (!players[socket.id].skills) players[socket.id].skills = {};
          players[socket.id].skills[data.skill] = data.progress;
          
          // Broadcast to others
          socket.broadcast.emit('skillUpdate', {
            id: socket.id,
            skill: data.skill,
            progress: data.progress
          });
        }
      });
  
      // Handle player hit
      socket.on('playerHit', (data) => {
        if (isHubMode) return;
        const { id, damage, knockbackDir, attackerId, reason } = data;
        
        // Security: Players can only apply self-inflicted damage via this event (e.g. falling into void)
        if (id !== socket.id) return;

        if (players[id]) {
          players[id].health -= damage;
          if (players[id].health <= 0 && !players[id].isDead) {
            players[id].isDead = true;
            
            const attackerName = players[attackerId] ? players[attackerId].name : 'Someone';
            let deathMessage = `${players[id].name} died`;
            if (reason) {
              deathMessage = `${players[id].name} ${reason}`;
            } else if (id !== attackerId) {
              deathMessage = `${players[id].name} was slain by ${attackerName}`;
            }
              
            ioNamespace.emit('chatMessage', {
              sender: 'System',
              message: deathMessage
            });
            
            ioNamespace.emit('playerDied', { id });
          }
          // Broadcast hit to everyone so they can show visual feedback
          ioNamespace.emit('playerHit', { id, damage, knockbackDir, attackerId });
        }
      });

      // Handle server-authoritative attack
      socket.on('attack', (data) => {
        const { targetId, isMob, knockbackDir, isSprinting } = data;
        
        if (isHubMode && !isMob) return; // Prevent PvP in Hub
        const attacker = players[socket.id];
        if (!attacker) return;
        
        // Base combat calculation
        let baseDamage = 5;
        let strength = 0;
        let critChance = 30;
        let critDamage = 50;

        const heldItem = attacker.heldItem || 0;
        const itemStats = (itemsData as Record<string, { baseDamage: number, strength: number }>)[heldItem.toString()];
        
        if (itemStats) {
          baseDamage += itemStats.baseDamage;
          strength += itemStats.strength;
        }

        const combatLevel = attacker.skills?.['Combat']?.level || 0;
        const additiveMultiplier = 1 + (combatLevel * 0.04);
        const strengthMultiplier = 1 + (strength / 100);

        const isCrit = Math.random() < (critChance / 100);
        const critMultiplier = isCrit ? (1 + critDamage / 100) : 1;

        const damage = Math.floor(baseDamage * strengthMultiplier * critMultiplier * additiveMultiplier);

        if (isMob) {
            const mob = mobs[targetId];
            if (mob && knockbackDir) {
                mob.health -= damage;
                
                const hostileMobTypes = ['Zombie', 'Creeper', 'Skeleton', 'Slime'];
                if (!hostileMobTypes.includes(mob.type)) {
                  mob.fleeTimer = 5.0;
                }
        
                if (mob.health <= 0) {
                  delete mobs[targetId];
                  ioNamespace.emit('mobDespawned', targetId);
                } else {
                  mob.velocity.x = knockbackDir.x * 1.5;
                  mob.velocity.z = knockbackDir.z * 1.5;
                  mob.velocity.y = 6; 
                  mob.knockbackTimer = 0.5;
                }
                ioNamespace.emit('mobHit', { id: targetId, damage, knockbackDir, isCrit });
            }
        } else {
            const target = players[targetId];
            if (target) {
                const targetDefense = target.defense || 0;
                const reduction = targetDefense / (targetDefense + 100);
                const actualDamage = Math.floor(damage * (1 - reduction));
                
                target.health -= actualDamage;
                if (target.health <= 0 && !target.isDead) {
                  target.isDead = true;
                  let deathMessage = `${target.name} was slain by ${attacker.name}`;
                  ioNamespace.emit('chatMessage', { sender: 'System', message: deathMessage });
                  ioNamespace.emit('playerDied', { id: targetId });
                }
                ioNamespace.emit('playerHit', { id: targetId, damage: actualDamage, knockbackDir, attackerId: socket.id, isCrit });
            }
        }
      });
  
      socket.on('requestRespawn', () => {
        if (players[socket.id] && players[socket.id].isDead) {
          players[socket.id].health = 100;
          players[socket.id].isDead = false;
          players[socket.id].position = { x: 0, y: 10, z: 0 };
          ioNamespace.emit('playerRespawn', { id: socket.id, position: players[socket.id].position });
        }
      });
  
      // Handle player movement
      socket.on('move', (data) => {
        if (players[socket.id]) {
          // Distance anti-cheat (unbounded movement exploit)
          const oldPos = players[socket.id].position;
          const newPos = data.position;
          const distSq = (oldPos.x - newPos.x) ** 2 + (oldPos.y - newPos.y) ** 2 + (oldPos.z - newPos.z) ** 2;
          
          if (distSq > Math.pow(15, 2)) {
            // Player moved too far in a single tick (e.g. hack or heavy desync)
            // 15 blocks gives enough leeway for Instant Transmission ability + ping
            ioNamespace.emit('playerRespawn', { id: socket.id, position: oldPos });
            return;
          }

          // Anti-cheat: Unauthorised vertical flight check (e.g. infinite jump exploits)
          // Normal jump velocity shouldn't exceed ~15 units upwards per network tick.
          if (!data.isFlying && !data.isSwimming) {
            const dy = newPos.y - oldPos.y;
            if (dy > 20) { 
              // Prevent extreme upward jumps
              ioNamespace.emit('playerRespawn', { id: socket.id, position: oldPos });
              return;
            }
          }

          players[socket.id].position = data.position;
          players[socket.id].rotation = data.rotation;
          players[socket.id].isFlying = data.isFlying;
          players[socket.id].isSwimming = data.isSwimming;
          players[socket.id].isCrouching = data.isCrouching;
          players[socket.id].isSprinting = data.isSprinting;
          players[socket.id].isSwinging = data.isSwinging;
          players[socket.id].swingSpeed = data.swingSpeed;
          players[socket.id].isGrounded = data.isGrounded;
          players[socket.id].heldItem = data.heldItem;
          players[socket.id].offHandItem = data.offHandItem || 0;
          players[socket.id].defense = data.defense || 0;
          
          pendingPlayerUpdates.add(socket.id);
        }
      });
  
      // Handle block changes
      socket.on('setBlock', (data) => {
        const { x, y, z, type, force } = data;
        
        // Anti-cheat: distance limit for placing/breaking blocks
        if (players[socket.id] && !force) {
          const px = players[socket.id].position.x;
          const py = players[socket.id].position.y;
          const pz = players[socket.id].position.z;
          const distSq = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
          if (distSq > Math.pow(8, 2)) { // 8 blocks 
             return;
          }
        }
        
        // Prevent modifying indestructible blocks (unless forced by creative mode)
        if (!force && isIndestructible(x, y, z)) {
          return; // Ignore request to modify indestructible block
        }
        
        const key = `${x},${y},${z}`;
        blockChanges[key] = type;
        
        // Broadcast to others immediately (blocks are rare compared to movement)
        socket.broadcast.emit('blockChanged', data);
      });
  
      // Handle chat message
      socket.on('chatMessage', (message) => {
        if (players[socket.id]) {
          ioNamespace.emit('chatMessage', {
            sender: players[socket.id].name,
            message: message
          });
        }
      });
  
      // Handle dropping items
      socket.on('dropItem', (data) => {
        // Limit total dropped items to 500 to prevent performance issues
        const itemIds = Object.keys(droppedItems);
        if (itemIds.length >= 500) {
          const oldestId = itemIds[0];
          delete droppedItems[oldestId];
          ioNamespace.emit('itemDespawned', oldestId);
        }
  
        const id = Math.random().toString(36).substring(2, 9);
        const item = {
          id,
          type: data.type,
          position: data.position,
          velocity: data.velocity,
          timestamp: Date.now()
        };
        droppedItems[id] = item;
        ioNamespace.emit('itemSpawned', item);
      });
  
      // Handle picking up items
      socket.on('pickupItem', (id) => {
        if (droppedItems[id]) {
          delete droppedItems[id];
          ioNamespace.emit('itemDespawned', id);
        }
      });
  
      // Handle spawning minions
      socket.on('spawnMinion', (data) => {
        const id = 'minion_' + Math.random().toString(36).substring(2, 9);
        const minion = {
          id,
          type: data.type,
          position: data.position,
          ownerId: socket.id,
          storage: 0,
          maxStorage: 64,
          lastActionTime: Date.now()
        };
        minions[id] = minion;
        ioNamespace.emit('minionSpawned', minion);
      });
  
      // Handle removing minions
      socket.on('removeMinion', (id) => {
        if (minions[id]) {
          delete minions[id];
          ioNamespace.emit('minionDespawned', id);
        }
      });
  
      // Handle collecting from minions
      socket.on('collectMinion', (id) => {
        const minion = minions[id];
        if (minion && minion.storage > 0) {
          const amount = minion.storage;
          minion.storage = 0;
          socket.emit('minionCollected', { id, amount, type: minion.type });
          ioNamespace.emit('minionUpdate', { id, storage: 0 });
        }
      });
  
      // Deprecated: client attempts to hit mobs directly via `mobHit` will be ignored
      // Clients must use the server-authoritative `attack` event instead to prevent damage exploits
      socket.on('mobHit', (data) => {
        // Ignored. Server handles it via `attack`.
      });
  
      socket.on('spawnMob', (data) => {
        if (!data || !data.type || !data.position) return;
        const { type, position, level } = data;
        
        // Limit total mobs
        if (Object.keys(mobs).length > 100) return;
  
        // Prevent duplicate mobs at the exact same location (from multiple clients generating the same chunk)
        for (const id in mobs) {
          const m = mobs[id];
          if (m.type === type && Math.abs(m.position.x - position.x) < 0.1 && Math.abs(m.position.z - position.z) < 0.1) {
            return; // Already spawned
          }
        }
  
        spawnMob(type, position.x, position.y, position.z, level);
      });
  
      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        pendingPlayerUpdates.delete(socket.id);
        ioNamespace.emit('playerLeft', socket.id);
      });
    });
  
    // Server Tick Loop (20Hz)
    setInterval(() => {
      // Player updates
      if (pendingPlayerUpdates.size > 0) {
        const updates: Record<string, any> = {};
        for (const id of pendingPlayerUpdates) {
          if (players[id]) {
            updates[id] = {
              id: players[id].id,
              position: players[id].position,
              rotation: players[id].rotation,
              isFlying: players[id].isFlying,
              isSwimming: players[id].isSwimming,
              isCrouching: players[id].isCrouching,
              isSprinting: players[id].isSprinting,
              isSwinging: players[id].isSwinging,
              swingSpeed: players[id].swingSpeed,
              isGrounded: players[id].isGrounded,
              heldItem: players[id].heldItem
            };
          }
        }
        ioNamespace.emit('playersUpdate', updates);
        pendingPlayerUpdates.clear();
      }
  
      // Mob updates
      const now = Date.now();
      const delta = 0.05;
      const gravity = -20;
  
      // Spatial hash for mob push separation
      const CELL_SIZE = 2;
      const getCellKey = (x: number, y: number, z: number) => `${Math.floor(x/CELL_SIZE)},${Math.floor(y/CELL_SIZE)},${Math.floor(z/CELL_SIZE)}`;
      const spatialHash = new Map<string, any[]>();
      
      for (const mId in mobs) {
         const m = mobs[mId];
         const key = getCellKey(m.position.x, m.position.y, m.position.z);
         if (!spatialHash.has(key)) spatialHash.set(key, []);
         spatialHash.get(key)!.push(m);
      }
      
      for (const id in mobs) {
        const mob = mobs[id];
        
        // Initialize AI state if missing
        if (mob.wanderTimer === undefined) {
          mob.wanderTimer = 0;
          mob.wanderAngle = 0;
          mob.fleeTimer = 0;
          mob.knockbackTimer = 0;
          mob.stuckTimer = 0;
          mob.stuckAngle = -1;
        }
  
        if (mob.knockbackTimer > 0) {
          mob.knockbackTimer -= delta;
        }
  
        let closestDist = Infinity;
        let closestPlayer = null;
  
        for (const pId in players) {
          const p = players[pId];
          const dx = p.position.x - mob.position.x;
          const dy = p.position.y - mob.position.y;
          const dz = p.position.z - mob.position.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist < closestDist) {
            closestDist = dist;
            closestPlayer = p;
          }
        }
  
        // Movement logic
        let moveSpeed = 2.5;
        let wishDirX = 0;
        let wishDirZ = 0;
  
        const hostileMobTypes = ['Zombie', 'Creeper', 'Skeleton', 'Slime'];
        const isHostile = hostileMobTypes.includes(mob.type);
  
        if (mob.knockbackTimer > 0) {
          // Apply knockback velocity with friction
          mob.velocity.x *= 0.9;
          mob.velocity.z *= 0.9;
          wishDirX = mob.velocity.x;
          wishDirZ = mob.velocity.z;
          moveSpeed = 1.0; // Velocity is already scaled, so multiplier is 1
        } else if (mob.fleeTimer > 0) {
          mob.fleeTimer -= delta;
          if (closestPlayer) {
            const dx = mob.position.x - closestPlayer.position.x;
            const dz = mob.position.z - closestPlayer.position.z;
            const len = Math.sqrt(dx*dx + dz*dz);
            if (len > 0.1) {
              wishDirX = dx / len;
              wishDirZ = dz / len;
              moveSpeed = 4.0; // Run away faster
            }
          }
        } else if (isHostile && closestPlayer && closestDist < 25) {
          if (mob.stuckTimer < 0 && mob.stuckAngle !== -1) {
            wishDirX = Math.cos(mob.stuckAngle);
            wishDirZ = Math.sin(mob.stuckAngle);
            mob.stuckTimer += delta;
            if (mob.stuckTimer >= 0) {
              mob.stuckAngle = -1;
            }
          } else {
            const dx = closestPlayer.position.x - mob.position.x;
            const dz = closestPlayer.position.z - mob.position.z;
            const len = Math.sqrt(dx*dx + dz*dz);
            if (len > 0.5) {
              wishDirX = dx / len;
              wishDirZ = dz / len;
            }

            // Attack logic
            if (closestDist <= 1.5 && mob.stuckTimer >= 0) {
              mob.lastAttackTime = mob.lastAttackTime || 0;
              const now = Date.now();
              if (now - mob.lastAttackTime > 1500 && !closestPlayer.isDead) {
                mob.lastAttackTime = now;
                const damage = 5 * (mob.level || 1);
                closestPlayer.health -= damage;
                
                const pushLen = Math.max(0.1, len);
                const kb = { x: dx/pushLen, y: 0.4, z: dz/pushLen };

                ioNamespace.emit('playerHit', {
                  id: closestPlayer.id,
                  damage: damage,
                  knockbackDir: kb,
                  attackerId: id,
                  reason: `was slain by a ${mob.type}` // server parses this if id == attackerId, but here id != attackerId so it will say was slain by Someone if we dont do reason
                });

                if (closestPlayer.health <= 0 && !closestPlayer.isDead) {
                  closestPlayer.isDead = true;
                  ioNamespace.emit('chatMessage', { sender: 'System', message: `${closestPlayer.name} was slain by a ${mob.type}` });
                  ioNamespace.emit('playerDied', { id: closestPlayer.id });
                }
              }
            }
          }
        } else if (!isHostile) {
          // Passive wandering
          mob.wanderTimer -= delta;
          if (mob.wanderTimer <= 0) {
            mob.wanderTimer = 2 + Math.random() * 5;
            if (Math.random() < 0.4) {
              mob.wanderAngle = -1; // Idle
            } else {
              mob.wanderAngle = Math.random() * Math.PI * 2;
            }
          }
  
          if (mob.wanderAngle !== -1) {
            wishDirX = Math.cos(mob.wanderAngle);
            wishDirZ = Math.sin(mob.wanderAngle);
            moveSpeed = 1.2;
          }
        }
  
        // Water and Ledge avoidance for ALL mobs
        if (mob.isGrounded && mob.knockbackTimer <= 0) {
          const checkDist = 0.8;
          const checkX = mob.position.x + wishDirX * checkDist;
          const checkZ = mob.position.z + wishDirZ * checkDist;
          const blockBelow = getBlockAt(checkX, mob.position.y - 0.5, checkZ);
          const blockFarBelow = getBlockAt(checkX, mob.position.y - 1.5, checkZ);
          const blockAtFeet = getBlockAt(checkX, mob.position.y + 0.5, checkZ);
          
          const isWater = blockAtFeet === BLOCK.WATER || blockAtFeet === BLOCK.LAVA || blockBelow === BLOCK.WATER || blockBelow === BLOCK.LAVA;
          const isLedge = !isSolidBlock(blockBelow) && !isSolidBlock(blockFarBelow) && !isWater;
  
          if (isWater || (isLedge && !isHostile)) {
            wishDirX = 0;
            wishDirZ = 0;
            if (!isHostile) mob.wanderTimer = 0;
          }
        }
  
        // Entity push/separation (Collision with other mobs and players)
        let pushX = 0;
        let pushZ = 0;
        const pushRadius = 0.8;
        
        for (const pId in players) {
          const p = players[pId];
          if (Math.abs(p.position.y - mob.position.y) < 1.5) {
            const dx = mob.position.x - p.position.x;
            const dz = mob.position.z - p.position.z;
            const distSq = dx*dx + dz*dz;
            if (distSq < pushRadius*pushRadius && distSq > 0.001) {
               const dist = Math.sqrt(distSq);
               pushX += (dx / dist) * (pushRadius - dist) * 0.2;
               pushZ += (dz / dist) * (pushRadius - dist) * 0.2;
            }
          }
        }
        
        // Use spatial hash to quickly find nearby mobs
        const mx = mob.position.x;
        const my = mob.position.y;
        const mz = mob.position.z;
        for (let ix = -1; ix <= 1; ix++) {
          for (let iy = -1; iy <= 1; iy++) {
             for (let iz = -1; iz <= 1; iz++) {
               const key = getCellKey(mx + ix*CELL_SIZE, my + iy*CELL_SIZE, mz + iz*CELL_SIZE);
               const adjacentMobs = spatialHash.get(key);
               if (adjacentMobs) {
                 for (const m of adjacentMobs) {
                   if (m.id === id) continue;
                   if (Math.abs(m.position.y - my) < 1.5) {
                     const dx = mx - m.position.x;
                     const dz = mz - m.position.z;
                     const distSq = dx*dx + dz*dz;
                     if (distSq < pushRadius*pushRadius && distSq > 0.001) {
                        const dist = Math.sqrt(distSq);
                        pushX += (dx / dist) * (pushRadius - dist) * 0.2;
                        pushZ += (dz / dist) * (pushRadius - dist) * 0.2;
                     }
                   }
                 }
               }
             }
          }
        }
  
        // Apply gravity
        mob.velocity.y += gravity * delta;
        
        // Horizontal movement with radius-based collision and sliding
        const radius = 0.35;
        const canMoveTo = (tx: number, tz: number, ty: number) => {
          // Prevent mobs from entering protected areas (castles, villages)
          const dxBlue = Math.max(0, Math.abs(tx) - 50);
          const dzBlue = Math.max(0, 70 - tz, tz - 180);
          const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);
  
          const dxRed = Math.max(0, Math.abs(tx) - 50);
          const dzRed = Math.max(0, -180 - tz, tz - -70);
          const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);
  
          if (Math.min(distBlue, distRed) <= 0) return false;
  
          const offsets = [
            { x: -radius, z: -radius },
            { x: radius, z: -radius },
            { x: -radius, z: radius },
            { x: radius, z: radius }
          ];
          for (const off of offsets) {
            const legBlock = getBlockAt(tx + off.x, ty + 0.5, tz + off.z);
            const headBlock = getBlockAt(tx + off.x, ty + 1.5, tz + off.z);
            if (isSolidBlock(legBlock) || isSolidBlock(headBlock)) return false;
            // Also treat water/lava as solid for mobs so they don't enter it
            if (legBlock === BLOCK.WATER || legBlock === BLOCK.LAVA) return false;
          }
          return true;
        };
  
        // Apply push directly to position
        if (pushX !== 0 || pushZ !== 0) {
           const nextPushX = mob.position.x + pushX;
           const nextPushZ = mob.position.z + pushZ;
           if (canMoveTo(nextPushX, mob.position.z, mob.position.y)) mob.position.x = nextPushX;
           if (canMoveTo(mob.position.x, nextPushZ, mob.position.y)) mob.position.z = nextPushZ;
        }
  
        const nextX = mob.position.x + wishDirX * moveSpeed * delta;
        const nextZ = mob.position.z + wishDirZ * moveSpeed * delta;
  
        let moved = false;
        if (canMoveTo(nextX, nextZ, mob.position.y)) {
          mob.position.x = nextX;
          mob.position.z = nextZ;
          moved = true;
        } else if (mob.isGrounded && canMoveTo(nextX, nextZ, mob.position.y + 1)) {
          mob.velocity.y = 7;
          mob.isGrounded = false;
          moved = true;
        } else {
          // Try sliding X
          if (canMoveTo(nextX, mob.position.z, mob.position.y)) {
            mob.position.x = nextX;
            moved = true;
          } else if (mob.isGrounded && canMoveTo(nextX, mob.position.z, mob.position.y + 1)) {
            mob.velocity.y = 7;
            mob.isGrounded = false;
            moved = true;
          }
          
          // Try sliding Z
          if (!moved && canMoveTo(mob.position.x, nextZ, mob.position.y)) {
            mob.position.z = nextZ;
            moved = true;
          } else if (!moved && mob.isGrounded && canMoveTo(mob.position.x, nextZ, mob.position.y + 1)) {
            mob.velocity.y = 7;
            mob.isGrounded = false;
            moved = true;
          }
        }
  
        if (!moved) {
          mob.stuckTimer = (mob.stuckTimer || 0) + delta;
          if (mob.stuckTimer > 0.3 && isHostile) {
             // We are stuck. Move perpendicular to the player temporarily (Wall sliding / whisker approach)
             mob.stuckAngle = Math.atan2(wishDirZ, wishDirX) + (Math.random() < 0.5 ? Math.PI/2 : -Math.PI/2);
             mob.stuckTimer = -0.5; // Walk this direction for 0.5 seconds
          } else if (!isHostile && mob.fleeTimer <= 0) {
             mob.wanderTimer = 0;
          }
        } else if (mob.stuckTimer > 0) {
          mob.stuckTimer = 0;
        }

        // Vertical movement and ground collision
        mob.position.y += mob.velocity.y * delta;
        
        const blockBelow = getBlockAt(mob.position.x, mob.position.y - 0.05, mob.position.z);
        const legBlock = getBlockAt(mob.position.x, mob.position.y + 0.5, mob.position.z);
        
        if (legBlock === BLOCK.LAVA || blockBelow === BLOCK.LAVA) {
           mob.health -= 25 * delta;
           if (mob.health <= 0) {
              delete mobs[id];
              ioNamespace.emit('mobDespawned', id);
              continue;
           }
        }
        
        if (isSolidBlock(blockBelow) && mob.velocity.y <= 0) {
          mob.position.y = Math.floor(mob.position.y - 0.05) + 1;
          mob.velocity.y = 0;
          mob.isGrounded = true;
        } else {
          mob.isGrounded = false;
        }
  
        // Despawn if fell into void
        if (mob.position.y < -20) {
          delete mobs[id];
          ioNamespace.emit('mobDespawned', id);
          continue;
        }
      }
  
      if (Object.keys(mobs).length > 0) {
        ioNamespace.emit('mobsUpdate', mobs);
      }
  
      // Update dayTime
      dayTime = (dayTime + delta * dayCycleSpeed) % 1;
      ioNamespace.emit('timeUpdate', { dayTime });
  
      // Minion production
      for (const id in minions) {
        const minion = minions[id];
        if (now - minion.lastActionTime > 10000) { // 10 seconds
          if (minion.storage < minion.maxStorage) {
            minion.storage++;
            minion.lastActionTime = now;
            ioNamespace.emit('minionUpdate', { id, storage: minion.storage });
          }
        }
      }
    }, 50);
  
    // Mob Spawning Loop
    let spawnInterval = 1000;
    
    const spawnMobsTick = () => {
      const isDay = Math.sin(dayTime * Math.PI * 2) > 0;
      spawnInterval = isDay ? 1000 : 500; // Double spawn rate at night
      setTimeout(spawnMobsTick, spawnInterval);

      if (isHubMode) return;
      const playerIds = Object.keys(players);
      if (playerIds.length === 0) return;
      
      const maxMobs = Math.min(150, playerIds.length * 75);
      if (Object.keys(mobs).length < maxMobs) {
        const randomPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
        const randomPlayer = players[randomPlayerId];
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        const x = randomPlayer.position.x + Math.cos(angle) * dist;
        const z = randomPlayer.position.z + Math.sin(angle) * dist;
        
        if (isNature(x, z)) {
          let spawnY = -1;
          // Try to find a valid ground near the player's Y level
          // We search for multiple layers (surface and caves) and pick one
          let validSpawnYLevels: number[] = [];
          const startY = 64; // Search from near the top
          const endY = -50;  // Search down to near the bottom
          
          // Search in the vertical column
          for (let y = startY; y > endY; y--) {
            const blockBelow = getBlockAt(x, y - 1, z);
            const blockAt = getBlockAt(x, y, z);
            const blockAbove = getBlockAt(x, y + 1, z);
            
            // Allow standing on solid blocks, except leaves and glass
            const validGround = isSolidBlock(blockBelow) && blockBelow !== BLOCK.LEAVES && blockBelow !== BLOCK.GLASS && blockBelow !== BLOCK.BIRCH_LEAVES && blockBelow !== BLOCK.SPRUCE_LEAVES && blockBelow !== BLOCK.DARK_OAK_LEAVES && blockBelow !== BLOCK.CHERRY_LEAVES;
            const validSpace = blockAt === BLOCK.AIR && blockAbove === BLOCK.AIR;

            if (validGround && validSpace) {
              // Valid ground found. Check if it's within a reasonable semi-vertical distance of the player
              // to keep them loaded or if it's just a valid spot in general
              if (Math.abs(y - randomPlayer.position.y) < 40) {
                validSpawnYLevels.push(y);
              }
              // Skip 2 blocks to find next potential platform faster
              y -= 2;
            }
          }

          if (validSpawnYLevels.length > 0) {
            spawnY = validSpawnYLevels[Math.floor(Math.random() * validSpawnYLevels.length)];
          }
          
          if (spawnY !== -1) {
            const rand = Math.random();
            let type = '';
            let level = 1;

            if (isDay) {
              // Day: spawn mostly passive mobs, but also try hostile (client will only allow them in caves)
              if (rand > 0.8) type = 'Cow';
              else if (rand > 0.6) type = 'Pig';
              else if (rand > 0.4) type = 'Sheep';
              else if (rand > 0.3) type = 'Zombie';
              else if (rand > 0.2) type = 'Skeleton';
              else if (rand > 0.1) type = 'Creeper';
              else type = 'Slime';
            } else {
              // Night: mostly hostile mobs
              if (rand > 0.95) type = 'Cow';
              else if (rand > 0.9) type = 'Pig';
              else if (rand > 0.85) type = 'Sheep';
              else if (rand > 0.6) type = 'Zombie';
              else if (rand > 0.4) type = 'Skeleton';
              else if (rand > 0.2) type = 'Creeper';
              else type = 'Slime';
            }
            
            // For hostile mobs, we need to check light level securely off the client
            if (['Zombie', 'Creeper', 'Skeleton', 'Slime'].includes(type)) {
               level = 1;
               
               // Server-side spawn lighting check
               let nearLightSource = false;
               const radius = 7;
               const px = Math.floor(x);
               const py = Math.floor(spawnY);
               const pz = Math.floor(z);

               for (let dx = -radius; dx <= radius; dx++) {
                 for (let dy = -radius; dy <= radius; dy++) {
                   for (let dz = -radius; dz <= radius; dz++) {
                     if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                       const b = getBlockAt(px + dx, py + dy, pz + dz);
                       if (b === BLOCK.GLOWSTONE || b === BLOCK.LAVA || b === BLOCK.TORCH || 
                           b === BLOCK.CANDLE || b === BLOCK.TORCH_WALL_X_POS || b === BLOCK.TORCH_WALL_X_NEG || 
                           b === BLOCK.TORCH_WALL_Z_POS || b === BLOCK.TORCH_WALL_Z_NEG) {
                         nearLightSource = true;
                         break;
                       }
                     }
                   }
                   if (nearLightSource) break;
                 }
                 if (nearLightSource) break;
               }

               let isExposed = true;
               if (!nearLightSource) {
                 for (let y = py + 1; y < 68; y++) {
                   const block = getBlockAt(px, y, pz);
                   if (block !== BLOCK.AIR && block !== BLOCK.WATER && block !== BLOCK.GLASS) { // Simple exposure test
                     isExposed = false;
                     break;
                   }
                 }
               }

               if (!nearLightSource && (!isDay || !isExposed)) {
                 for (let i = 2; i <= 13; i++) {
                   if (Math.random() < Math.pow(0.8, i - 1)) {
                     level = i;
                   } else {
                     break;
                   }
                 }
                 spawnMob(type, Math.floor(x) + 0.5, spawnY, Math.floor(z) + 0.5, level);
               }
            } else {
               spawnMob(type, Math.floor(x) + 0.5, spawnY, Math.floor(z) + 0.5, level);
            }
          }
        }
      }
    };
    setTimeout(spawnMobsTick, spawnInterval);
  
    // Mob Despawn Loop (Every 10 seconds)
    setInterval(() => {
      const playerIds = Object.keys(players);
      const isDay = Math.sin(dayTime * Math.PI * 2) > 0;
      
      if (playerIds.length === 0) {
        // Despawn all mobs if no players
        for (const id in mobs) {
          delete mobs[id];
          ioNamespace.emit('mobDespawned', id);
        }
        return;
      }
  
      for (const id in mobs) {
        const mob = mobs[id];
        let minPlayerDist = Infinity;
        
        for (const pId of playerIds) {
          const p = players[pId];
          const dx = p.position.x - mob.position.x;
          const dz = p.position.z - mob.position.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          if (dist < minPlayerDist) minPlayerDist = dist;
        }
  
        const isHostile = ['Zombie', 'Creeper', 'Skeleton', 'Slime'].includes(mob.type);

        let isExposed = true;
        if (isHostile && isDay) {
          for (let y = Math.floor(mob.position.y) + 1; y < 68; y++) {
            const block = getBlockAt(Math.floor(mob.position.x), y, Math.floor(mob.position.z));
            if (block !== BLOCK.AIR && block !== BLOCK.WATER && block !== BLOCK.GLASS && !(block >= 19 && block <= 25)) { // AIR, WATER, GLASS
              isExposed = false;
              break;
            }
          }
        }

        // Despawn if too far from all players, or if hostile during day and exposed
        if (minPlayerDist > 120 || (isDay && isHostile && isExposed && minPlayerDist > 15)) {
          delete mobs[id];
          ioNamespace.emit('mobDespawned', id);
        }
      }
    }, 10000);
  
    // Item Despawn Loop (Every 30 seconds)
    setInterval(() => {
      const now = Date.now();
      const expiryTime = 5 * 60 * 1000; // 5 minutes
      let despawned = 0;
      
      for (const id in droppedItems) {
        if (now - droppedItems[id].timestamp > expiryTime) {
          delete droppedItems[id];
          ioNamespace.emit('itemDespawned', id);
          despawned++;
        }
        if (despawned > 50) break; // Limit despawns per tick
      }
    }, 30000);
  
  }

  createGameServer('/hub', 'hub_world_data.json', true);
  createGameServer('/skybridge', 'world_data.json', false);
  createGameServer('/skycastles', 'skycastles_world_data.json', false);
  app.get('/', (req, res) => {
    res.send('SkyBridge API Server is running');
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
