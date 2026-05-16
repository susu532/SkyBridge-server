import * as THREE from 'three';

export interface GameModeDescriptor {
  id: string;
  setupInventory(player: any): void;
  getInitialCoins(): number;
  setupSettings(renderer: THREE.WebGLRenderer, composer: any, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  tick(game: any, delta: number): void;
}

export abstract class BaseGameMode implements GameModeDescriptor {
  constructor(public id: string) {}
  
  setupInventory(player: any): void {
    player.inventory.clear();
  }
  
  getInitialCoins(): number {
    return 500;
  }
  
  setupSettings(renderer: THREE.WebGLRenderer, composer: any, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    renderer.toneMapping = 0; // THREE.NoToneMapping
  }
  
  tick(game: any, delta: number): void {
    // Default no-op
  }
}

// ... other modes will be defined here or in separate files.
