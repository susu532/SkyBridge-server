import * as THREE from 'three';
import { BLOCK, getBlockUVs, isTransparent, isCutout, isSolidBlock, isSlab, isWater, ATLAS_TILES, isPlant, isLeaves, isAnyTorch } from './TextureAtlas';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const WORLD_Y_OFFSET = -60;

export class Chunk {
  x: number;
  z: number;
  blocks: Uint16Array;
  light: Uint8Array;
  mesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;
  needsUpdate: boolean = true;
  
  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.blocks = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.light = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  getIndex(x: number, y: number, z: number) {
    return x | (z << 4) | (y << 8);
  }

  getBlock(x: number, y: number, z: number) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BLOCK.AIR;
    }
    return this.blocks[x | (z << 4) | (y << 8)];
  }

  getLight(x: number, y: number, z: number) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 15;
    }
    return this.light[x | (z << 4) | (y << 8)];
  }

  setBlockFast(x: number, y: number, z: number, type: number) {
    this.blocks[x | (z << 4) | (y << 8)] = type;
  }

  setLightFast(x: number, y: number, z: number, level: number) {
    this.light[x | (z << 4) | (y << 8)] = level;
  }

  setBlock(x: number, y: number, z: number, type: number) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.blocks[x | (z << 4) | (y << 8)] = type;
    this.needsUpdate = true;
  }

  isMeshing: boolean = false;

  async buildMesh(opaqueMaterial: THREE.Material, transparentMaterial: THREE.Material, opaqueDepthMaterial: THREE.MeshDepthMaterial, transparentDepthMaterial: THREE.MeshDepthMaterial, chunkCache: (Chunk | undefined)[], performanceMode: boolean = false) {
    this.isMeshing = true;
    this.needsUpdate = false;
    
    let allAir = true;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i] !== 0) { // BLOCK.AIR is 0
        allAir = false;
        break;
      }
    }
    
    if (allAir) {
      if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.parent?.remove(this.mesh); this.mesh = null; }
      if (this.transparentMesh) { this.transparentMesh.geometry.dispose(); this.transparentMesh.parent?.remove(this.transparentMesh); this.transparentMesh = null; }
      this.isMeshing = false;
      return { mesh: null, transparentMesh: null };
    }
    
    const opaque = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], tileBases: [] as number[], colors: [] as number[], sways: [] as number[], indices: [] as number[], offset: 0 };
    const transparent = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], tileBases: [] as number[], colors: [] as number[], sways: [] as number[], indices: [] as number[], offset: 0 };

    const getAO = (b1: boolean, b2: boolean, b3: boolean) => {
      if (performanceMode) return 3; // No AO in performance mode
      if (b1 && b2) return 0;
      return 3 - ((b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0));
    };

    const getWaterHeight = (lx: number, lz: number, ly: number) => {
      let b;
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
        b = this.blocks[lx | (lz << 4) | (ly << 8)];
      } else {
        const cdx = Math.floor(lx / 16);
        const cdz = Math.floor(lz / 16);
        const c = chunkCache[(cdx + 1) + (cdz + 1) * 3];
        if (c) {
          b = c.blocks[(lx & 15) | ((lz & 15) << 4) | (ly << 8)];
        } else {
          b = BLOCK.AIR;
        }
      }
      
      if (!isWater(b)) return -1;
      
      let above;
      if (ly + 1 < CHUNK_HEIGHT) {
        if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
          above = this.blocks[lx | (lz << 4) | ((ly + 1) << 8)];
        } else {
          const cdx = Math.floor(lx / 16);
          const cdz = Math.floor(lz / 16);
          const c = chunkCache[(cdx + 1) + (cdz + 1) * 3];
          if (c) {
            above = c.blocks[(lx & 15) | ((lz & 15) << 4) | ((ly + 1) << 8)];
          } else {
            above = BLOCK.AIR;
          }
        }
      } else {
        above = BLOCK.AIR;
      }
      
      if (isWater(above)) return 1.0;
      if (b === BLOCK.WATER) return 0.9;
      return 0.9 - ((b - BLOCK.WATER_1 + 1) * 0.1);
    };

    const getCornerHeight = (vx: number, vz: number, vy: number) => {
      let sum = 0;
      let count = 0;
      let waterAbove = false;
      
      for (let dz = -1; dz <= 0; dz++) {
        for (let dx = -1; dx <= 0; dx++) {
          const h = getWaterHeight(vx + dx, vz + dz, vy);
          if (h >= 0) {
            if (h >= 1.0) waterAbove = true;
            sum += h;
            count++;
          }
        }
      }
      
      if (waterAbove) return 1.0;
      if (count === 0) return 0.9;
      return sum / count;
    };

    const p = [
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]
    ];
    const faceUVs = [[0, 0], [0, 0], [0, 0], [0, 0]];
    const ao = [3, 3, 3, 3];

    const addFace = (x: number, y: number, z: number, dir: number, blockType: number, layer: any) => {
      const uvsCoords = getBlockUVs(blockType)[dir];
      const u = uvsCoords[0] / ATLAS_TILES;
      const v = 1 - (uvsCoords[1] + 1) / ATLAS_TILES;
      const du = 1 / ATLAS_TILES;
      const dv = 1 / ATLAS_TILES;

      p[0][0] = x;     p[0][1] = y;     p[0][2] = z + 1;
      p[1][0] = x + 1; p[1][1] = y;     p[1][2] = z + 1;
      p[2][0] = x + 1; p[2][1] = y + 1; p[2][2] = z + 1;
      p[3][0] = x;     p[3][1] = y + 1; p[3][2] = z + 1;
      p[4][0] = x + 1; p[4][1] = y;     p[4][2] = z;
      p[5][0] = x;     p[5][1] = y;     p[5][2] = z;
      p[6][0] = x;     p[6][1] = y + 1; p[6][2] = z;
      p[7][0] = x + 1; p[7][1] = y + 1; p[7][2] = z;

      if (isSlab(blockType)) {
        p[2][1] = y + 0.5;
        p[3][1] = y + 0.5;
        p[6][1] = y + 0.5;
        p[7][1] = y + 0.5;
      } else if (blockType === BLOCK.LAUNCHER) { // Floor pad
         p[0][0] = x + 0.1; p[0][2] = z + 0.9;
         p[1][0] = x + 0.9; p[1][2] = z + 0.9;
         p[2][0] = x + 0.9; p[2][1] = y + 0.1; p[2][2] = z + 0.9;
         p[3][0] = x + 0.1; p[3][1] = y + 0.1; p[3][2] = z + 0.9;
         p[4][0] = x + 0.9; p[4][2] = z + 0.1;
         p[5][0] = x + 0.1; p[5][2] = z + 0.1;
         p[6][0] = x + 0.1; p[6][1] = y + 0.1; p[6][2] = z + 0.1;
         p[7][0] = x + 0.9; p[7][1] = y + 0.1; p[7][2] = z + 0.1;
      } else if (blockType === BLOCK.LAUNCHER_WALL_X_POS) { // On +X wall
         p[0][0] = x + 0.9; p[0][1] = y + 0.1; p[0][2] = z + 0.9;
         p[1][0] = x + 1.0; p[1][1] = y + 0.1; p[1][2] = z + 0.9;
         p[2][0] = x + 1.0; p[2][1] = y + 0.9; p[2][2] = z + 0.9;
         p[3][0] = x + 0.9; p[3][1] = y + 0.9; p[3][2] = z + 0.9;
         p[4][0] = x + 1.0; p[4][1] = y + 0.1; p[4][2] = z + 0.1;
         p[5][0] = x + 0.9; p[5][1] = y + 0.1; p[5][2] = z + 0.1;
         p[6][0] = x + 0.9; p[6][1] = y + 0.9; p[6][2] = z + 0.1;
         p[7][0] = x + 1.0; p[7][1] = y + 0.9; p[7][2] = z + 0.1;
      } else if (blockType === BLOCK.LAUNCHER_WALL_X_NEG) { // On -X wall
         p[0][0] = x + 0.0; p[0][1] = y + 0.1; p[0][2] = z + 0.9;
         p[1][0] = x + 0.1; p[1][1] = y + 0.1; p[1][2] = z + 0.9;
         p[2][0] = x + 0.1; p[2][1] = y + 0.9; p[2][2] = z + 0.9;
         p[3][0] = x + 0.0; p[3][1] = y + 0.9; p[3][2] = z + 0.9;
         p[4][0] = x + 0.1; p[4][1] = y + 0.1; p[4][2] = z + 0.1;
         p[5][0] = x + 0.0; p[5][1] = y + 0.1; p[5][2] = z + 0.1;
         p[6][0] = x + 0.0; p[6][1] = y + 0.9; p[6][2] = z + 0.1;
         p[7][0] = x + 0.1; p[7][1] = y + 0.9; p[7][2] = z + 0.1;
      } else if (blockType === BLOCK.LAUNCHER_WALL_Z_POS) { // On +Z wall
         p[0][0] = x + 0.1; p[0][1] = y + 0.1; p[0][2] = z + 1.0;
         p[1][0] = x + 0.9; p[1][1] = y + 0.1; p[1][2] = z + 1.0;
         p[2][0] = x + 0.9; p[2][1] = y + 0.9; p[2][2] = z + 1.0;
         p[3][0] = x + 0.1; p[3][1] = y + 0.9; p[3][2] = z + 1.0;
         p[4][0] = x + 0.9; p[4][1] = y + 0.1; p[4][2] = z + 0.9;
         p[5][0] = x + 0.1; p[5][1] = y + 0.1; p[5][2] = z + 0.9;
         p[6][0] = x + 0.1; p[6][1] = y + 0.9; p[6][2] = z + 0.9;
         p[7][0] = x + 0.9; p[7][1] = y + 0.9; p[7][2] = z + 0.9;
      } else if (blockType === BLOCK.LAUNCHER_WALL_Z_NEG) { // On -Z wall
         p[0][0] = x + 0.1; p[0][1] = y + 0.1; p[0][2] = z + 0.1;
         p[1][0] = x + 0.9; p[1][1] = y + 0.1; p[1][2] = z + 0.1;
         p[2][0] = x + 0.9; p[2][1] = y + 0.9; p[2][2] = z + 0.1;
         p[3][0] = x + 0.1; p[3][1] = y + 0.9; p[3][2] = z + 0.1;
         p[4][0] = x + 0.9; p[4][1] = y + 0.1; p[4][2] = z + 0.0;
         p[5][0] = x + 0.1; p[5][1] = y + 0.1; p[5][2] = z + 0.0;
         p[6][0] = x + 0.1; p[6][1] = y + 0.9; p[6][2] = z + 0.0;
         p[7][0] = x + 0.9; p[7][1] = y + 0.9; p[7][2] = z + 0.0;
      }

      if (isWater(blockType) && dir !== 3) {
        let above;
        if (y + 1 < CHUNK_HEIGHT) {
          above = this.blocks[x | (z << 4) | ((y + 1) << 8)];
        } else {
          above = BLOCK.AIR;
        }
        if (!isWater(above)) {
          p[2][1] = y + getCornerHeight(x + 1, z + 1, y);
          p[3][1] = y + getCornerHeight(x, z + 1, y);
          p[6][1] = y + getCornerHeight(x, z, y);
          p[7][1] = y + getCornerHeight(x + 1, z, y);
        }
      }

      faceUVs[0][0] = u;      faceUVs[0][1] = v;
      faceUVs[1][0] = u + du; faceUVs[1][1] = v;
      faceUVs[2][0] = u + du; faceUVs[2][1] = v + dv;
      faceUVs[3][0] = u;      faceUVs[3][1] = v + dv;

      ao[0] = 3; ao[1] = 3; ao[2] = 3; ao[3] = 3;
      const isSolid = (dx: number, dy: number, dz: number) => {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (ny < 0 || ny >= CHUNK_HEIGHT) return false;
        
        if ((nx & ~15) === 0 && (nz & ~15) === 0) {
          return isSolidBlock(this.blocks[nx | (nz << 4) | (ny << 8)]);
        } else {
          const cdx = nx >> 4;
          const cdz = nz >> 4;
          const c = chunkCache[(cdx + 1) + (cdz + 1) * 3];
          if (c) {
            return isSolidBlock(c.blocks[(nx & 15) | ((nz & 15) << 4) | (ny << 8)]);
          }
          return false;
        }
      };

      let p0, p1, p2, p3;
      let nx = 0, ny = 0, nz = 0;

      switch (dir) {
        case 0: p0 = p[1]; p1 = p[4]; p2 = p[7]; p3 = p[2]; nx = 1; break;
        case 1: p0 = p[5]; p1 = p[0]; p2 = p[3]; p3 = p[6]; nx = -1; break;
        case 2: p0 = p[3]; p1 = p[2]; p2 = p[7]; p3 = p[6]; ny = 1; break;
        case 3: p0 = p[5]; p1 = p[4]; p2 = p[1]; p3 = p[0]; ny = -1; break;
        case 4: p0 = p[0]; p1 = p[1]; p2 = p[2]; p3 = p[3]; nz = 1; break;
        case 5: p0 = p[4]; p1 = p[5]; p2 = p[6]; p3 = p[7]; nz = -1; break;
      }

      if (layer === opaque) {
        switch (dir) {
          case 0: ao[0] = getAO(isSolid(1,-1,0), isSolid(1,0,1), isSolid(1,-1,1)); ao[1] = getAO(isSolid(1,-1,0), isSolid(1,0,-1), isSolid(1,-1,-1)); ao[2] = getAO(isSolid(1,1,0), isSolid(1,0,-1), isSolid(1,1,-1)); ao[3] = getAO(isSolid(1,1,0), isSolid(1,0,1), isSolid(1,1,1)); break;
          case 1: ao[0] = getAO(isSolid(-1,-1,0), isSolid(-1,0,-1), isSolid(-1,-1,-1)); ao[1] = getAO(isSolid(-1,-1,0), isSolid(-1,0,1), isSolid(-1,-1,1)); ao[2] = getAO(isSolid(-1,1,0), isSolid(-1,0,1), isSolid(-1,1,1)); ao[3] = getAO(isSolid(-1,1,0), isSolid(-1,0,-1), isSolid(-1,1,-1)); break;
          case 2: ao[0] = getAO(isSolid(-1,1,0), isSolid(0,1,1), isSolid(-1,1,1)); ao[1] = getAO(isSolid(1,1,0), isSolid(0,1,1), isSolid(1,1,1)); ao[2] = getAO(isSolid(1,1,0), isSolid(0,1,-1), isSolid(1,1,-1)); ao[3] = getAO(isSolid(-1,1,0), isSolid(0,1,-1), isSolid(-1,1,-1)); break;
          case 3: ao[0] = getAO(isSolid(-1,-1,0), isSolid(0,-1,-1), isSolid(-1,-1,-1)); ao[1] = getAO(isSolid(1,-1,0), isSolid(0,-1,-1), isSolid(1,-1,-1)); ao[2] = getAO(isSolid(1,-1,0), isSolid(0,-1,1), isSolid(1,-1,1)); ao[3] = getAO(isSolid(-1,-1,0), isSolid(0,-1,1), isSolid(-1,-1,1)); break;
          case 4: ao[0] = getAO(isSolid(-1,0,1), isSolid(0,-1,1), isSolid(-1,-1,1)); ao[1] = getAO(isSolid(1,0,1), isSolid(0,-1,1), isSolid(1,-1,1)); ao[2] = getAO(isSolid(1,0,1), isSolid(0,1,1), isSolid(1,1,1)); ao[3] = getAO(isSolid(-1,0,1), isSolid(0,1,1), isSolid(-1,1,1)); break;
          case 5: ao[0] = getAO(isSolid(1,0,-1), isSolid(0,-1,-1), isSolid(1,-1,-1)); ao[1] = getAO(isSolid(-1,0,-1), isSolid(0,-1,-1), isSolid(-1,-1,-1)); ao[2] = getAO(isSolid(-1,0,-1), isSolid(0,1,-1), isSolid(-1,1,-1)); ao[3] = getAO(isSolid(1,0,-1), isSolid(0,1,-1), isSolid(1,1,-1)); break;
        }
      }

      let lx = 0, ly = 0, lz = 0;
      switch (dir) {
        case 0: lx = 1; break; case 1: lx = -1; break;
        case 2: ly = 1; break; case 3: ly = -1; break;
        case 4: lz = 1; break; case 5: lz = -1; break;
      }
      const light = getLightLevel(x,y,z,lx,ly,lz);
      const isEmissive = blockType === BLOCK.GLOWSTONE || blockType === BLOCK.LAVA || isAnyTorch(blockType);
      const lightMult = isEmissive ? 1.0 : Math.max(0.35, Math.pow(0.85, 15 - light));
      
      const l0 = (layer === transparent || isEmissive) ? lightMult : ((ao[0] + 1) / 4) * lightMult;
      const l1 = (layer === transparent || isEmissive) ? lightMult : ((ao[1] + 1) / 4) * lightMult;
      const l2 = (layer === transparent || isEmissive) ? lightMult : ((ao[2] + 1) / 4) * lightMult;
      const l3 = (layer === transparent || isEmissive) ? lightMult : ((ao[3] + 1) / 4) * lightMult;

      layer.positions.push(
        p0![0], p0![1], p0![2],
        p1![0], p1![1], p1![2],
        p2![0], p2![1], p2![2],
        p3![0], p3![1], p3![2]
      );
      
      layer.normals.push(
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz
      );
      
      layer.tileBases.push(
        u, v,
        u, v,
        u, v,
        u, v
      );
      
      layer.uvs.push(
        0, 0,
        1, 0,
        1, 1,
        0, 1
      );
      
      layer.colors.push(
        l0, l0, l0,
        l1, l1, l1,
        l2, l2, l2,
        l3, l3, l3
      );

      const pushSway = (v: number[]) => {
        let val = 0;
        if (isLeaves(blockType) || isPlant(blockType)) {
          val = (v[1] > y) ? 1.0 : 0.0;
        } else if (isWater(blockType)) {
          val = 2.0;
        } else if (blockType === BLOCK.LAVA) {
          val = 3.0;
        }
        layer.sways.push(val);
      };
      pushSway(p0!); pushSway(p1!); pushSway(p2!); pushSway(p3!);

      if (layer === opaque && ao[0] + ao[2] < ao[1] + ao[3]) {
        layer.indices.push(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }
      layer.offset += 4;
    };

    const addCross = (x: number, y: number, z: number, blockType: number, layer: any) => {
      // Deterministic random behavior based on world position
      const wx = this.x * CHUNK_SIZE + x;
      const wz = this.z * CHUNK_SIZE + z;
      const hash = Math.abs(Math.sin(wx * 12.9898 + (y + WORLD_Y_OFFSET) * 78.233 + wz * 37.719) * 43758.5453) % 1;
      
      const uvsCoords = getBlockUVs(blockType)[0]; // Just use side 0
      const u = uvsCoords[0] / ATLAS_TILES;
      const v = 1 - (uvsCoords[1] + 1) / ATLAS_TILES;
      const du = 1 / ATLAS_TILES;
      const dv = 1 / ATLAS_TILES;

      const isTorch = isAnyTorch(blockType);
      const heightBase = isTorch ? 0.6 : (blockType === BLOCK.WHEAT ? 1.4 : (blockType === BLOCK.TALL_GRASS ? 1.1 : 1.0));
      const height = heightBase * (0.85 + hash * 0.3); // 85% to 115% height variation
      
      const s = isTorch ? 0.125 : 1.0; 
      const inset = (1.0 - s) / 2;
      
      // Natural horizontal jitter (Minecraft style)
      const jitterX = isTorch ? 0 : (hash - 0.5) * 0.3;
      const jitterZ = isTorch ? 0 : ((hash * 10 % 1) - 0.5) * 0.3;
      
      const px = x + jitterX;
      const pz = z + jitterZ;

      let topOffsetX = 0; let topOffsetZ = 0;
      let botOffsetX = 0; let botOffsetZ = 0;
      let botOffsetY = 0;

      if (blockType === BLOCK.TORCH_WALL_X_POS) { topOffsetX = -0.15; botOffsetX = 0.4; botOffsetY = 0.2; }
      else if (blockType === BLOCK.TORCH_WALL_X_NEG) { topOffsetX = 0.15; botOffsetX = -0.4; botOffsetY = 0.2; }
      else if (blockType === BLOCK.TORCH_WALL_Z_POS) { topOffsetZ = -0.15; botOffsetZ = 0.4; botOffsetY = 0.2; }
      else if (blockType === BLOCK.TORCH_WALL_Z_NEG) { topOffsetZ = 0.15; botOffsetZ = -0.4; botOffsetY = 0.2; }

      const p = [
        [px + inset + botOffsetX, y + botOffsetY, pz + inset + botOffsetZ], 
        [px + inset + s + botOffsetX, y + botOffsetY, pz + inset + s + botOffsetZ], 
        [px + inset + s + topOffsetX, y + height + botOffsetY, pz + inset + s + topOffsetZ], 
        [px + inset + topOffsetX, y + height + botOffsetY, pz + inset + topOffsetZ], // Diag 1
        [px + inset + s + botOffsetX, y + botOffsetY, pz + inset + botOffsetZ], 
        [px + inset + botOffsetX, y + botOffsetY, pz + inset + s + botOffsetZ], 
        [px + inset + topOffsetX, y + height + botOffsetY, pz + inset + s + topOffsetZ], 
        [px + inset + s + topOffsetX, y + height + botOffsetY, pz + inset + topOffsetZ]  // Diag 2
      ];

      const pushFace = (p0: number[], p1: number[], p2: number[], p3: number[], reverse: boolean = false) => {
        if (reverse) {
          layer.positions.push(
            p3[0], p3[1], p3[2],
            p2[0], p2[1], p2[2],
            p1[0], p1[1], p1[2],
            p0[0], p0[1], p0[2]
          );
          layer.sways.push(
            (isTorch || p3[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p0[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push(u, v, u, v, u, v, u, v);
          layer.uvs.push(
            0, 1,
            1, 1,
            1, 0,
            0, 0
          );
        } else {
          layer.positions.push(
            p0[0], p0[1], p0[2],
            p1[0], p1[1], p1[2],
            p2[0], p2[1], p2[2],
            p3[0], p3[1], p3[2]
          );
          layer.sways.push(
            (isTorch || p0[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p3[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push(u, v, u, v, u, v, u, v);
          layer.uvs.push(
            0, 0,
            1, 0,
            1, 1,
            0, 1
          );
        }
        layer.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); // Up normal for simplicity
        const light = getLightLevel(x,y,z,0,0,0);
        const lightMult = isTorch ? 1.0 : Math.max(0.35, Math.pow(0.85, 15 - light));
        const color = isTorch ? 1.4 : lightMult;
        
        // Add subtle AO by darkening the bottom vertices
        const cLow = color * 0.75;
        const cHigh = color;

        if (reverse) {
          layer.colors.push(cHigh, cHigh, cHigh, cHigh, cHigh, cHigh, cLow, cLow, cLow, cLow, cLow, cLow);
        } else {
          layer.colors.push(cLow, cLow, cLow, cLow, cLow, cLow, cHigh, cHigh, cHigh, cHigh, cHigh, cHigh);
        }
        layer.indices.push(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
        layer.offset += 4;
      };

      pushFace(p[0], p[1], p[2], p[3]);
      pushFace(p[4], p[5], p[6], p[7]);
    };

    const addGreedyQuad = (x: number, y: number, z: number, w: number, h: number, dir: number, blockType: number, ao0: number, ao1: number, ao2: number, ao3: number, layer: any, light: number) => {
      const uvsCoords = getBlockUVs(blockType)[dir];
      const u = uvsCoords[0] / ATLAS_TILES;
      const v = 1 - (uvsCoords[1] + 1) / ATLAS_TILES;

      let p0, p1, p2, p3;
      let nx = 0, ny = 0, nz = 0;

      switch (dir) {
        case 0: p0 = [x + 1, y, z + w]; p1 = [x + 1, y, z]; p2 = [x + 1, y + h, z]; p3 = [x + 1, y + h, z + w]; nx = 1; break;
        case 1: p0 = [x, y, z]; p1 = [x, y, z + w]; p2 = [x, y + h, z + w]; p3 = [x, y + h, z]; nx = -1; break;
        case 2: p0 = [x, y + 1, z + h]; p1 = [x + w, y + 1, z + h]; p2 = [x + w, y + 1, z]; p3 = [x, y + 1, z]; ny = 1; break;
        case 3: p0 = [x, y, z]; p1 = [x + w, y, z]; p2 = [x + w, y, z + h]; p3 = [x, y, z + h]; ny = -1; break;
        case 4: p0 = [x, y, z + 1]; p1 = [x + w, y, z + 1]; p2 = [x + w, y + h, z + 1]; p3 = [x, y + h, z + 1]; nz = 1; break;
        case 5: p0 = [x + w, y, z]; p1 = [x, y, z]; p2 = [x, y + h, z]; p3 = [x + w, y + h, z]; nz = -1; break;
      }

      const isEmissive = blockType === BLOCK.GLOWSTONE || blockType === BLOCK.LAVA || isAnyTorch(blockType);
      const lightMult = isEmissive ? 1.0 : Math.max(0.35, Math.pow(0.85, 15 - light));
      const l0 = (layer === transparent || isEmissive) ? lightMult : ((ao0 + 1) / 4) * lightMult;
      const l1 = (layer === transparent || isEmissive) ? lightMult : ((ao1 + 1) / 4) * lightMult;
      const l2 = (layer === transparent || isEmissive) ? lightMult : ((ao2 + 1) / 4) * lightMult;
      const l3 = (layer === transparent || isEmissive) ? lightMult : ((ao3 + 1) / 4) * lightMult;
      const swayVal = isLeaves(blockType) ? 1.0 : (blockType === BLOCK.LAVA ? 3.0 : 0.0);
      layer.sways.push(swayVal, swayVal, swayVal, swayVal);

      layer.positions.push(p0![0], p0![1], p0![2], p1![0], p1![1], p1![2], p2![0], p2![1], p2![2], p3![0], p3![1], p3![2]);
      layer.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      layer.tileBases.push(u, v, u, v, u, v, u, v);
      layer.uvs.push(0, 0, w, 0, w, h, 0, h);
      layer.colors.push(l0, l0, l0, l1, l1, l1, l2, l2, l2, l3, l3, l3);

      if (layer === opaque && ao0 + ao2 < ao1 + ao3) {
        layer.indices.push(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }
      layer.offset += 4;
    };

    const masks = [
      new Int32Array(16 * CHUNK_HEIGHT * 16), // 0: Right (+X)
      new Int32Array(16 * CHUNK_HEIGHT * 16), // 1: Left (-X)
      new Int32Array(16 * 16 * CHUNK_HEIGHT), // 2: Top (+Y)
      new Int32Array(16 * 16 * CHUNK_HEIGHT), // 3: Bottom (-Y)
      new Int32Array(16 * CHUNK_HEIGHT * 16), // 4: Front (+Z)
      new Int32Array(16 * CHUNK_HEIGHT * 16)  // 5: Back (-Z)
    ];

    const isSolid = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (ny < 0 || ny >= CHUNK_HEIGHT) return false;
      if ((nx & ~15) === 0 && (nz & ~15) === 0) {
        return isSolidBlock(this.blocks[nx | (nz << 4) | (ny << 8)]);
      } else {
        const cdx = nx >> 4;
        const cdz = nz >> 4;
        const c = chunkCache[(cdx + 1) + (cdz + 1) * 3];
        if (c) return isSolidBlock(c.blocks[(nx & 15) | ((nz & 15) << 4) | (ny << 8)]);
        return false;
      }
    };

    const getLightLevel = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (ny < 0 || ny >= CHUNK_HEIGHT) return 15;
      if ((nx & ~15) === 0 && (nz & ~15) === 0) {
        return this.light[nx | (nz << 4) | (ny << 8)];
      } else {
        const cdx = nx >> 4;
        const cdz = nz >> 4;
        const c = chunkCache[(cdx + 1) + (cdz + 1) * 3];
        if (c) return c.light[(nx & 15) | ((nz & 15) << 4) | (ny << 8)];
        return 15;
      }
    };

    let startTime = performance.now();
    let iterations = 0;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const type = this.blocks[x | (z << 4) | (y << 8)];
          if (type === BLOCK.AIR) continue;
          
          const isTypeTransparent = isTransparent(type);
          const isTypeCutout = isCutout(type);
          const layer = (isTypeTransparent || isTypeCutout) ? transparent : opaque;
          
          if (isPlant(type)) {
            addCross(x, y, z, type, layer);
            continue;
          }

          const typeIsSlab = isSlab(type);
          const typeIsWater = isWater(type);
          const isFullBlock = !typeIsSlab && !typeIsWater && !isCutout(type);
          
          // Right (dir 0)
          let nType;
          if (x < 15) {
            nType = this.blocks[(x + 1) | (z << 4) | (y << 8)];
          } else {
            const c = chunkCache[2 + 1 * 3];
            const isCMeshed = c && (c.mesh || c.transparentMesh || c.isMeshing);
            nType = isCMeshed ? c.blocks[0 | (z << 4) | (y << 8)] : (typeIsWater ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,1,0,1), isSolid(x,y,z,1,-1,1));
                ao1 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,1,0,-1), isSolid(x,y,z,1,-1,-1));
                ao2 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,1,0,-1), isSolid(x,y,z,1,1,-1));
                ao3 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,1,0,1), isSolid(x,y,z,1,1,1));
              }
              const light = getLightLevel(x,y,z,1,0,0);
              masks[0][z + y * 16 + x * 4096] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 0, type, layer);
            }
          }
          
          // Left (dir 1)
          if (x > 0) {
            nType = this.blocks[(x - 1) | (z << 4) | (y << 8)];
          } else {
            const c = chunkCache[0 + 1 * 3];
            const isCMeshed = c && (c.mesh || c.transparentMesh || c.isMeshing);
            nType = isCMeshed ? c.blocks[15 | (z << 4) | (y << 8)] : (typeIsWater ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,-1,-1,-1));
                ao1 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,-1,0,1), isSolid(x,y,z,-1,-1,1));
                ao2 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,-1,0,1), isSolid(x,y,z,-1,1,1));
                ao3 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,-1,1,-1));
              }
              const light = getLightLevel(x,y,z,-1,0,0);
              masks[1][z + y * 16 + x * 4096] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 1, type, layer);
            }
          }
          
          // Top (dir 2)
          nType = y < (CHUNK_HEIGHT - 1) ? this.blocks[x | (z << 4) | ((y + 1) << 8)] : BLOCK.AIR;
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || typeIsSlab || isSlab(nType)) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,0,1,1), isSolid(x,y,z,-1,1,1));
                ao1 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,0,1,1), isSolid(x,y,z,1,1,1));
                ao2 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,1,1,-1));
                ao3 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,-1,1,-1));
              }
              const light = getLightLevel(x,y,z,0,1,0);
              masks[2][x + z * 16 + y * 256] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 2, type, layer);
            }
          }
          
          // Bottom (dir 3)
          nType = y > 0 ? this.blocks[x | (z << 4) | ((y - 1) << 8)] : BLOCK.AIR;
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || isSlab(nType)) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,-1,-1,-1));
                ao1 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,1,-1,-1));
                ao2 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,1,-1,1));
                ao3 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,-1,-1,1));
              }
              const light = getLightLevel(x,y,z,0,-1,0);
              masks[3][x + z * 16 + y * 256] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 3, type, layer);
            }
          }
          
          // Front (dir 4)
          if (z < 15) {
            nType = this.blocks[x | ((z + 1) << 4) | (y << 8)];
          } else {
            const c = chunkCache[1 + 2 * 3];
            const isCMeshed = c && (c.mesh || c.transparentMesh || c.isMeshing);
            nType = isCMeshed ? c.blocks[x | (0 << 4) | (y << 8)] : (typeIsWater ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,0,1), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,-1,-1,1));
                ao1 = getAO(isSolid(x,y,z,1,0,1), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,1,-1,1));
                ao2 = getAO(isSolid(x,y,z,1,0,1), isSolid(x,y,z,0,1,1), isSolid(x,y,z,1,1,1));
                ao3 = getAO(isSolid(x,y,z,-1,0,1), isSolid(x,y,z,0,1,1), isSolid(x,y,z,-1,1,1));
              }
              const light = getLightLevel(x,y,z,0,0,1);
              masks[4][x + y * 16 + z * 4096] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 4, type, layer);
            }
          }
          
          // Back (dir 5)
          if (z > 0) {
            nType = this.blocks[x | ((z - 1) << 4) | (y << 8)];
          } else {
            const c = chunkCache[1 + 0 * 3];
            const isCMeshed = c && (c.mesh || c.transparentMesh || c.isMeshing);
            nType = isCMeshed ? c.blocks[x | (15 << 4) | (y << 8)] : (typeIsWater ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,1,0,-1), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,1,-1,-1));
                ao1 = getAO(isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,-1,-1,-1));
                ao2 = getAO(isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,-1,1,-1));
                ao3 = getAO(isSolid(x,y,z,1,0,-1), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,1,1,-1));
              }
              const light = getLightLevel(x,y,z,0,0,-1);
              masks[5][x + y * 16 + z * 4096] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 5, type, layer);
            }
          }
          
          iterations++;
          if (iterations % 256 === 0 && performance.now() - startTime > 1) {
            await new Promise(resolve => setTimeout(resolve, 0));
            startTime = performance.now();
          }
        }
      }
    }

    // Greedy mesh the masks
    for (let dir = 0; dir < 6; dir++) {
      const mask = masks[dir];
      let sliceMax, iMax, jMax;
      if (dir === 0 || dir === 1) { sliceMax = 16; iMax = CHUNK_HEIGHT; jMax = 16; } // X slices. i=y, j=z
      else if (dir === 2 || dir === 3) { sliceMax = CHUNK_HEIGHT; iMax = 16; jMax = 16; } // Y slices. i=z, j=x
      else { sliceMax = 16; iMax = CHUNK_HEIGHT; jMax = 16; } // Z slices. i=y, j=x

      for (let slice = 0; slice < sliceMax; slice++) {
        for (let i = 0; i < iMax; i++) {
          for (let j = 0; j < jMax; ) {
            const idx = j + i * jMax + slice * jMax * iMax;
            const val = mask[idx];
            if (val !== 0) {
              let w = 1;
              while (j + w < jMax && mask[j + w + i * jMax + slice * jMax * iMax] === val) {
                w++;
              }
              let h = 1;
              let done = false;
              while (i + h < iMax) {
                for (let k = 0; k < w; k++) {
                  if (mask[j + k + (i + h) * jMax + slice * jMax * iMax] !== val) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                h++;
              }

              const blockType = val & 0x3FF;
              const ao0 = (val >> 10) & 0x3;
              const ao1 = (val >> 12) & 0x3;
              const ao2 = (val >> 14) & 0x3;
              const ao3 = (val >> 16) & 0x3;
              const isTransp = (val >> 18) & 0x1;
              const light = (val >> 19) & 0xF;
              const layer = isTransp ? transparent : opaque;

              let x, y, z;
              if (dir === 0 || dir === 1) { x = slice; y = i; z = j; }
              else if (dir === 2 || dir === 3) { y = slice; z = i; x = j; }
              else { z = slice; y = i; x = j; }

              addGreedyQuad(x, y, z, w, h, dir, blockType, ao0, ao1, ao2, ao3, layer, light);

              for (let di = 0; di < h; di++) {
                for (let dj = 0; dj < w; dj++) {
                  mask[j + dj + (i + di) * jMax + slice * jMax * iMax] = 0;
                }
              }
              j += w;
            } else {
              j++;
            }
          }
        }
      }
    }

    const updateMesh = async (layer: any, mesh: THREE.Mesh | null, material: THREE.Material) => {
      if (layer.positions.length === 0) {
        if (mesh) { mesh.geometry.dispose(); mesh.parent?.remove(mesh); }
        return null;
      }
      
      if (performance.now() - startTime > 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
        startTime = performance.now();
      }
      
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(layer.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(layer.normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(layer.uvs, 2));
      geo.setAttribute('aTileBase', new THREE.Float32BufferAttribute(layer.tileBases, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(layer.colors, 3));
      geo.setAttribute('aSway', new THREE.Float32BufferAttribute(layer.sways, 1));
      geo.setIndex(layer.indices);
      if (mesh) { mesh.geometry.dispose(); mesh.geometry = geo; return mesh; }
      const newMesh = new THREE.Mesh(geo, material);
      newMesh.position.set(this.x * CHUNK_SIZE, WORLD_Y_OFFSET, this.z * CHUNK_SIZE);
      newMesh.castShadow = !performanceMode;
      newMesh.receiveShadow = !performanceMode;
      if (layer === opaque) {
        newMesh.customDepthMaterial = opaqueDepthMaterial;
      } else if (layer === transparent) {
        newMesh.customDepthMaterial = transparentDepthMaterial;
      }
      return newMesh;
    };

    this.mesh = await updateMesh(opaque, this.mesh, opaqueMaterial);
      this.transparentMesh = await updateMesh(transparent, this.transparentMesh, transparentMaterial);
      if (this.transparentMesh) {
        this.transparentMesh.castShadow = !performanceMode; // Transparent items cast shadows using alphaTest
        this.transparentMesh.receiveShadow = false; // Disable shadows on water/glass to prevent artifacts
      }
      this.isMeshing = false;
  }
}
