import * as THREE from 'three';
import { BLOCK, getBlockUVs, isTransparent, isCutout, isSolidBlock, isSlab, isWater, ATLAS_TILES, isPlant, isLeaves, isAnyTorch } from './TextureAtlas';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 16;
export const WORLD_Y_OFFSET = -5;

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


  applyMesh(opaque: any, transparent: any, opaqueMaterial: THREE.Material, transparentMaterial: THREE.Material, opaqueDepthMaterial: THREE.MeshDepthMaterial, transparentDepthMaterial: THREE.MeshDepthMaterial, performanceMode: boolean = false) {
    const updateMesh = (layer: any, mesh: THREE.Mesh | null, material: THREE.Material) => {
      if (!layer || layer.positions.length === 0) {
        if (mesh) { mesh.geometry.dispose(); mesh.parent?.remove(mesh); }
        return null;
      }
      
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(layer.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(layer.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(layer.uvs, 2));
      geo.setAttribute('aTileBase', new THREE.BufferAttribute(layer.tileBases, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(layer.colors, 3));
      geo.setAttribute('aSway', new THREE.BufferAttribute(layer.sways, 1));
      geo.setIndex(new THREE.BufferAttribute(layer.indices, 1));

      if (mesh) {
        mesh.geometry.dispose();
        mesh.geometry = geo;
        mesh.castShadow = !performanceMode;
        mesh.receiveShadow = !performanceMode;
        if (layer === opaque) {
          mesh.customDepthMaterial = opaqueDepthMaterial;
        } else if (layer === transparent) {
          mesh.customDepthMaterial = transparentDepthMaterial;
        }
        return mesh;
      }

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

    this.mesh = updateMesh(opaque, this.mesh, opaqueMaterial);
    this.transparentMesh = updateMesh(transparent, this.transparentMesh, transparentMaterial);
    
    if (this.transparentMesh) {
      this.transparentMesh.castShadow = !performanceMode;
      this.transparentMesh.receiveShadow = false;
    }
    this.isMeshing = false;
  }

}
