import { Server } from 'socket.io';
import { ChunkManager } from './ChunkManager';
import { getTerrainHeight, isNature, noise2D, noise3D } from '../game/TerrainGenerator';
import { BLOCK, isSolidBlock, CHUNK_SIZE, WORLD_Y_OFFSET } from './constants';
import itemsData from '../../data/items.json';
import npcsData from '../game/data/npcs.json';
import bakedBlocksData from '../../data/bakedBlocks.json';
import fs from 'fs';
import path from 'path';

const bakedBlocks = new Map<string, number>(Object.entries(bakedBlocksData));

export function createGameServer(io: Server, db: any, namespacePrefix: string, worldDataFileName: string, isHubMode: boolean) {
    const worldName = namespacePrefix.replace('/', '');
    const isSkyCastlesMode = namespacePrefix === '/skycastles' || namespacePrefix === '/voidtrail';
    const ioNamespace = io.of(namespacePrefix);
    const WORLD_DATA_FILE = path.join(process.cwd(), worldDataFileName);
    const chunkManager = new ChunkManager(worldName, db);
    let npcs: any[] = [];
    const players: Record<string, any> = {};

    // Load NPCs (Chunk loading is now implicit inside ChunkManager.getChunkArray)
    try {
      const getNPCs = db.prepare(`SELECT data FROM world_npcs WHERE world = ?`);
      const npcRow = getNPCs.get(worldName) as any;
      if (npcRow) {
        npcs = JSON.parse(npcRow.data);
        console.log(`Loaded ${npcs.length} NPCs for ${worldName} from DB`);
      } else {
        npcs = (npcsData as any)[worldName] || [];
      }
      if (npcs.length === 0) {
         npcs = (npcsData as any)[worldName] || [];
      }
    } catch (err) {
      console.error('Error loading NPCs:', err);
      npcs = (npcsData as any)[worldName] || [];
    }

    // Save world data every 10 seconds
    setInterval(() => {
       chunkManager.saveDirtyChunks();
       // Also save NPCs if dirty
       try {
         const insertNPCs = db.prepare(`INSERT OR REPLACE INTO world_npcs (world, data) VALUES (?, ?)`);
         if (npcs.length > 0) insertNPCs.run(worldName, JSON.stringify(npcs));
       } catch(e) {}
    }, 10000);

    // Unload idle chunks every 30 seconds
    setInterval(() => {
       chunkManager.unloadIdleChunks(players, 6); // 6 chunk render distance
    }, 30000);

    // Sync time every 10 seconds to save bandwidth
    setInterval(() => {
       ioNamespace.emit('timeUpdate', { dayTime });
    }, 10000);

  
    const droppedItems: Record<string, any> = {};
    const mobs: Record<string, any> = {};
    const minions: Record<string, any> = {};
    const pendingPlayerUpdates = new Set<string>();
    const pendingHits: any[] = [];
    const pendingMobHits: any[] = [];
  
    let dayTime = 0;
    const dayCycleSpeed = 0.0008;
  

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
      const villageEnd = isSkyCastlesMode ? 300 : 180;
      const isBlueVillageZ = z >= 131 && z <= villageEnd;
      const isRedVillageZ = z >= -villageEnd && z <= -131;
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

        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
        if (chunkType !== undefined) return chunkType;
        
        const distSq = x * x + z * z;
        const dist = Math.sqrt(distSq);
        
        if (distSq <= 7225 && y >= -60 && y <= 0) { // Max radius 85, within world height bounds
          const radiusAtY = Math.sqrt(y + 60) * 11;
          const noise = (Math.sin(x * 0.1) + Math.cos(z * 0.1)) * 4;
          
          if (dist < radiusAtY + noise) {
             if (y === -60) return 1; // Bedrock
             if (y >= -60 && y < 0) return 1; // Stone/Dirt
             if (y === 0) return 115; // Polished Andesite
          }
        }
        return BLOCK.AIR;
      }

      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const chunkType = chunkManager.getBlockFromChunk(cx, cz, lx, Math.floor(y) - WORLD_Y_OFFSET, lz);
      if (chunkType !== undefined) return chunkType;

      const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
      if (bakedBlocks.has(key)) return bakedBlocks.get(key)!;
      
      // Match client-side void/island logic
      const isBlueSide = z >= 70;
      const isRedSide = z <= -70;
      const isVoid = !isBlueSide && !isRedSide;
      const isBridge = isVoid && x >= -8 && x <= 8;
  
      if (isBridge) {
        // Bridge is at world Y=0, fences at Y=1. Server just needs to support walking.
        if (y === 0 || (y === 1 && (x === -8 || x === 8))) return 1;
        return BLOCK.AIR;
      }
  
      if (isVoid) return BLOCK.AIR;
  
      const groundY = getTerrainHeight(x, z, isSkyCastlesMode);
      // A block at groundY occupies [groundY, groundY + 1)
      if (y >= groundY && y < groundY + 1) return 1; 
      
      if (y < groundY) {
        if (isSkyCastlesMode && y < -30) return BLOCK.AIR; // Floating bottom
        // Check for caves
        const dxBlue = Math.max(0, Math.abs(x) - 50);
        const villageEnd = isSkyCastlesMode ? 300 : 180;
        const dzBlue = Math.max(0, 70 - z, z - villageEnd);
        const distBlue = Math.sqrt(dxBlue * dxBlue + dzBlue * dzBlue);
  
        const dxRed = Math.max(0, Math.abs(x) - 50);
        const dzRed = Math.max(0, -villageEnd - z, z - -70);
        const distRed = Math.sqrt(dxRed * dxRed + dzRed * dzRed);
  
        const distToProtected = Math.min(distBlue, distRed);
        const isAreaProtected = distToProtected === 0;
        
        const isVillageOrCastle = (x >= -50 && x <= 50) && ((z >= 70 && z <= 410) || (z <= -70 && z >= -410));
        const isBridgeArea = x >= -12 && x <= 12 && z > -70 && z < 70;
        const isProtected = isVillageOrCastle || isBridgeArea || isAreaProtected;
  
        const elevationNoise = noise2D(x * 0.001, z * 0.001);
        const isOcean = elevationNoise < -0.5;
  
        const hasCaves = !isSkyCastlesMode && !isProtected && !isOcean && noise2D(x * 0.01, z * 0.01) > 0.3;
        
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
      
      // Above ground - No ocean/lakes
      return BLOCK.AIR;
    }
  
    function spawnMob(type: string, x: number, y: number, z: number, level?: number) {
      const id = 'mob_' + Math.random().toString(36).substring(2, 9);
      
      const isHostile = ['Zombie', 'Creeper', 'Skeleton', 'Slime', 'Morvane'].includes(type);
      
      let mobLvl = 1;
      let hp = 100;
      let scale = 1;
      
      if (type === 'Morvane') {
        hp = 25000;
        scale = 5;
        mobLvl = 100;
      } else if (isHostile) {
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
        blockChanges: chunkManager.getBlockChangesDict(),
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
        const player = players[socket.id];
        if (player) {
          const now = Date.now();
          if (player.lastSkillTime && now - player.lastSkillTime < 250) return; // Max 4 times per sec
          player.lastSkillTime = now;

          if (!player.skills) player.skills = {};
          player.skills[data.skill] = data.progress;
          
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
        
        const now = Date.now();
        if (attacker.lastAttackTime && now - attacker.lastAttackTime < 250) return; // Max 4 attacks per second
        attacker.lastAttackTime = now;
        
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
                const dx = attacker.position.x - mob.position.x;
                const dy = attacker.position.y - mob.position.y;
                const dz = attacker.position.z - mob.position.z;
                if (dx * dx + dy * dy + dz * dz > 100) return; // Validation
                
                mob.health -= damage;
                
                const hostileMobTypes = ['Zombie', 'Creeper', 'Skeleton', 'Slime', 'Morvane'];
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
                pendingMobHits.push({ id: targetId, damage, knockbackDir, isCrit });
            }
        } else {
            const target = players[targetId];
            if (target) {
                const dx = attacker.position.x - target.position.x;
                const dy = attacker.position.y - target.position.y;
                const dz = attacker.position.z - target.position.z;
                if (dx * dx + dy * dy + dz * dz > 100) return; // Validation
            
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
                pendingHits.push({ id: targetId, damage: actualDamage, knockbackDir, attackerId: socket.id, isCrit });
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
  
      // Handle binary packed player movement
      socket.on('moveP', (buf: Buffer | ArrayBuffer) => {
        if (!players[socket.id]) return;
        
        try {
          // Socket.IO receives Node 'Buffer' in the backend
          const arrayBuffer = Buffer.isBuffer(buf) ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf;
          const view = new DataView(arrayBuffer as ArrayBuffer);
          const px = view.getFloat32(0);
          const py = view.getFloat32(4);
          const pz = view.getFloat32(8);
          const rx = view.getFloat32(12);
          const ry = view.getFloat32(16);
          
          const newPos = { x: px, y: py, z: pz };
          const oldPos = players[socket.id].position;
          
          players[socket.id].position = newPos;
          players[socket.id].rotation = { x: rx, y: ry, z: 0 };
          
          pendingPlayerUpdates.add(socket.id);
        } catch (e) {
          console.error("Invalid moveP buffer length");
        }
      });
      
      socket.on('playerState', (state: any) => {
        if (!players[socket.id]) return;
        players[socket.id].isFlying = state.isFlying;
        players[socket.id].isSwimming = state.isSwimming;
        players[socket.id].isCrouching = state.isCrouching;
        players[socket.id].isSprinting = state.isSprinting;
        players[socket.id].isSwinging = state.isSwinging;
        players[socket.id].swingSpeed = state.swingSpeed;
        players[socket.id].isGrounded = state.isGrounded;
        players[socket.id].heldItem = state.heldItem;
        players[socket.id].offHandItem = state.offHandItem;
        players[socket.id].defense = state.defense;
        pendingPlayerUpdates.add(socket.id);
      });
      
      // Handle legacy player movement
      socket.on('move', (data) => {
        if (players[socket.id]) {
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
        const { x, y, z, type } = data;
        
        const player = players[socket.id];
        if (!player) return;
        
        const now = Date.now();
        if (player.lastBlockTime && now - player.lastBlockTime < 10) return; // Max 100 blocks per second per player
        player.lastBlockTime = now;

        if (player) {
          const dx = player.position.x - x;
          const dy = player.position.y - y;
          const dz = player.position.z - z;
          if (dx * dx + dy * dy + dz * dz > 144) return; // Range validation (approx 12 blocks)
        }

        // Prevent modifying indestructible blocks
        if (isIndestructible(x, y, z)) {
          return; // Ignore request to modify indestructible block
        }
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = y - WORLD_Y_OFFSET;
        chunkManager.setBlockInChunk(cx, cz, lx, ly, lz, type);
        chunkManager.markChunkDirty(x, z);
        
        // Broadcast to others immediately (blocks are rare compared to movement)
        socket.broadcast.emit('blockChanged', data);
      });
  
      // Handle chat message
      socket.on('chatMessage', (message) => {
        const player = players[socket.id];
        if (player) {
          const now = Date.now();
          if (player.lastChatTime && now - player.lastChatTime < 500) return; // Max 2 messages per second
          player.lastChatTime = now;

          const trimmed = String(message).slice(0, 200); // Max 200 chars
          if (trimmed.length === 0) return;

          ioNamespace.emit('chatMessage', {
            sender: player.name,
            message: trimmed
          });
        }
      });
  
      // Handle dropping items
      socket.on('dropItem', (data) => {
        const player = players[socket.id];
        if (player) {
          const now = Date.now();
          if (player.lastDropTime && now - player.lastDropTime < 100) return;
          player.lastDropTime = now;
        }

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
        const player = players[socket.id];
        if (!player) return;
        
        let playerMinionCount = 0;
        for (const mId in minions) {
          if (minions[mId].ownerId === socket.id) playerMinionCount++;
        }
        
        if (playerMinionCount >= 30) return; // Max 30 minions per player
        if (Object.keys(minions).length >= 500) return; // Global hard cap for the whole instance

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
        
        // Limit total mobs (except for Bosses like Morvane)
        if (Object.keys(mobs).length > Math.min(2000, Object.keys(players).length * 40) && type !== 'Morvane') return;
  
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
  
    // Spatial Hash definitions (reused to prevent GC thrashing)
    const CELL_SIZE = 2;
    const PLAYER_CELL_SIZE = 25;
    const getCellKey = (cx: number, cy: number, cz: number) => ((cx & 0x3FF) | ((cy & 0xFF) << 10) | ((cz & 0x3FF) << 18));
    const spatialHash = new Map<number, any[]>();
    const playerHash = new Map<number, any[]>();

    // Server Tick Loop (20Hz)
    let lastTickTime = Date.now();
    setInterval(() => {
      const now = Date.now();
      let delta = (now - lastTickTime) / 1000;
      if (delta > 0.1) delta = 0.1; // Cap delta to prevent huge jumps
      lastTickTime = now;
      
      // Player updates
      if (pendingPlayerUpdates.size > 0) {
        const updates: Record<string, any[]> = {};
        for (const id of pendingPlayerUpdates) {
          const p = players[id];
          if (p) {
            let stateMask = 0;
            if (p.isFlying) stateMask |= 1;
            if (p.isSwimming) stateMask |= 2;
            if (p.isCrouching) stateMask |= 4;
            if (p.isSprinting) stateMask |= 8;
            if (p.isSwinging) stateMask |= 16;
            if (p.isGrounded) stateMask |= 32;
            if (p.isBlocking) stateMask |= 64;

            updates[id] = [
              Math.round(p.position.x * 100) / 100,
              Math.round(p.position.y * 100) / 100,
              Math.round(p.position.z * 100) / 100,
              Math.round(p.rotation.x * 100) / 100,
              Math.round(p.rotation.y * 100) / 100,
              stateMask,
              p.swingSpeed,
              p.heldItem || 0,
              p.offHandItem || 0,
              Math.round(p.health || 0) // Added Health!
            ];
          }
        }
        ioNamespace.emit('playersUpdate', updates);
        pendingPlayerUpdates.clear();
      }

      if (pendingHits.length > 0) {
        ioNamespace.emit('batchedPlayerHits', pendingHits);
        pendingHits.length = 0;
      }
      if (pendingMobHits.length > 0) {
        ioNamespace.emit('batchedMobHits', pendingMobHits);
        pendingMobHits.length = 0;
      }
  
      // Mob updates
      const gravity = -20;
  
      // Clear spatial hashes instead of reallocating
      for (const cell of spatialHash.values()) cell.length = 0;
      for (const cell of playerHash.values()) cell.length = 0;
      
      for (const mId in mobs) {
         const m = mobs[mId];
         const key = getCellKey(Math.floor(m.position.x/CELL_SIZE), Math.floor(m.position.y/CELL_SIZE), Math.floor(m.position.z/CELL_SIZE));
         let cell = spatialHash.get(key);
         if (!cell) { cell = []; spatialHash.set(key, cell); }
         cell.push(m);
      }

      for (const pId in players) {
        const p = players[pId];
        const key = getCellKey(Math.floor(p.position.x/PLAYER_CELL_SIZE), Math.floor(p.position.y/PLAYER_CELL_SIZE), Math.floor(p.position.z/PLAYER_CELL_SIZE));
        let cell = playerHash.get(key);
        if (!cell) { cell = []; playerHash.set(key, cell); }
        cell.push(p);
      }
      
      for (const id in mobs) {
        const mob = mobs[id];
        
        // Simple AI: Move towards closest player
        let closestPlayer: any = null;
        let minPlayerDist = Infinity;
        
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
        
        const mpCX = Math.floor(mob.position.x / PLAYER_CELL_SIZE);
        const mpCY = Math.floor(mob.position.y / PLAYER_CELL_SIZE);
        const mpCZ = Math.floor(mob.position.z / PLAYER_CELL_SIZE);

        for (let ix = -1; ix <= 1; ix++) {
          for (let iy = -1; iy <= 1; iy++) {
            for (let iz = -1; iz <= 1; iz++) {
              const key = getCellKey(mpCX + ix, mpCY + iy, mpCZ + iz);
              const cellPlayers = playerHash.get(key);
              if (cellPlayers) {
                for (const p of cellPlayers) {
                  const dx = p.position.x - mob.position.x;
                  const dy = p.position.y - mob.position.y;
                  const dz = p.position.z - mob.position.z;
                  const distSq = dx*dx + dy*dy + dz*dz;
                  if (distSq < closestDist * closestDist) {
                    closestDist = Math.sqrt(distSq);
                    closestPlayer = p;
                  }
                }
              }
            }
          }
        }
  
        // Suspend simulation if no players are within 60 blocks (~2.5 chunks)
        // Except for bosses like Morvane who might need to keep track of state, but Morvane stays at 0,0 usually.
        if (closestDist > 60 && mob.type !== 'Morvane') {
          continue;
        }

        // Movement logic
        let moveSpeed = 2.5;
        let wishDirX = 0;
        let wishDirZ = 0;
  
        const hostileMobTypes = ['Zombie', 'Creeper', 'Skeleton', 'Slime', 'Morvane'];
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
        
        for (let ix = -1; ix <= 1; ix++) {
          for (let iy = -1; iy <= 1; iy++) {
            for (let iz = -1; iz <= 1; iz++) {
              const key = getCellKey(mpCX + ix, mpCY + iy, mpCZ + iz);
              const cellPlayers = playerHash.get(key);
              if (cellPlayers) {
                for (const p of cellPlayers) {
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
              }
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
               const key = getCellKey(Math.floor((mx + ix*CELL_SIZE)/CELL_SIZE), Math.floor((my + iy*CELL_SIZE)/CELL_SIZE), Math.floor((mz + iz*CELL_SIZE)/CELL_SIZE));
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
  
        if (mob.type === 'Morvane') {
          wishDirX = 0;
          wishDirZ = 0;
          mob.velocity.y = 0;
        }

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
        let numPackedMobs = 0;
        const packedMobs: Record<string, any[]> = {};
        for(const id in mobs) {
           const m = mobs[id];
           if (Math.abs((m.lastX || 0) - m.position.x) > 0.05 || Math.abs((m.lastY || 0) - m.position.y) > 0.05 || Math.abs((m.lastZ || 0) - m.position.z) > 0.05 || m.lastHealth !== m.health) {
             packedMobs[id] = [
               Number(m.position.x.toFixed(2)),
               Number(m.position.y.toFixed(2)),
               Number(m.position.z.toFixed(2)),
               Math.floor(m.health)
             ];
             m.lastX = m.position.x;
             m.lastY = m.position.y;
             m.lastZ = m.position.z;
             m.lastHealth = m.health;
             numPackedMobs++;
           }
        }
        if (numPackedMobs > 0) ioNamespace.emit('mobsUpdate', packedMobs);
      }
  
      // Update dayTime
      dayTime = (dayTime + delta * dayCycleSpeed) % 1;
  
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
      
      const maxMobs = Math.min(2000, playerIds.length * 40);
      if (Object.keys(mobs).length < maxMobs) {
        const randomPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
        const randomPlayer = players[randomPlayerId];
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        const x = randomPlayer.position.x + Math.cos(angle) * dist;
        const z = randomPlayer.position.z + Math.sin(angle) * dist;
        
        if (isNature(x, z, isSkyCastlesMode)) {
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
        let minPlayerDistSq = Infinity;
        
        for (const pId of playerIds) {
          const p = players[pId];
          const dx = p.position.x - mob.position.x;
          const dz = p.position.z - mob.position.z;
          const distSq = dx*dx + dz*dz;
          if (distSq < minPlayerDistSq) minPlayerDistSq = distSq;
        }

        const minPlayerDist = Math.sqrt(minPlayerDistSq);
  
        const isHostile = ['Zombie', 'Creeper', 'Skeleton', 'Slime', 'Morvane'].includes(mob.type);

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
        if (mob.type !== 'Morvane' && (minPlayerDist > 120 || (isDay && isHostile && isExposed && minPlayerDist > 15))) {
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