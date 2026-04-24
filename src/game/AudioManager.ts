import * as THREE from 'three';
import { settingsManager } from './Settings';

class AudioManager {
  private listener: THREE.AudioListener;
  private sounds: Map<string, THREE.Audio | THREE.PositionalAudio> = new Map();
  private audioLoader: THREE.AudioLoader;
  private initialized: boolean = false;
  private ambientSounds: Map<string, THREE.Audio> = new Map();

  private positionalPool: THREE.PositionalAudio[] = [];

  constructor() {
    this.audioLoader = new THREE.AudioLoader();
    
    if (typeof window !== 'undefined') {
      this.listener = new THREE.AudioListener();
      
      // Subscribe to settings for global volume
      settingsManager.subscribe((settings) => {
        if (this.listener) this.listener.setMasterVolume(settings.volume);
      });
      // Set initial volume
      if (this.listener) this.listener.setMasterVolume(settingsManager.getSettings().volume);

      // Initialize pool
      for (let i = 0; i < 20; i++) {
        const pAudio = new THREE.PositionalAudio(this.listener);
        pAudio.setRefDistance(5);
        pAudio.setMaxDistance(50);
        pAudio.setRolloffFactor(1);
        this.positionalPool.push(pAudio);
      }

      // Unbreakable brute-force unlocking to guarantee audio context resumes across all game states
      const unlockAudio = () => {
        this.resume();
      };
      window.addEventListener('pointerdown', unlockAudio, { capture: true });
      window.addEventListener('keydown', unlockAudio, { capture: true });
      window.addEventListener('click', unlockAudio, { capture: true });
    } else {
      this.listener = null as any; // Dummy for server
    }
  }

  public init(camera: THREE.Camera) {
    if (this.listener.parent) {
      this.listener.parent.remove(this.listener);
    }
    camera.add(this.listener);
    
    // Check if we need to add to the new scene
    const scene = camera.parent;
    if (scene) {
      this.positionalPool.forEach(p => {
        if (p.parent) p.parent.remove(p);
        scene.add(p);
      });
    }

    if (this.initialized) return;
    this.initialized = true;
    
    // Preload common sounds
    this.loadSound('step_grass', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/grass1.ogg');
    this.loadSound('step_stone', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/stone1.ogg');
    this.loadSound('step_sand', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/sand1.ogg');
    this.loadSound('step_wood', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/step/wood1.ogg');
    this.loadSound('break', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/dig/grass1.ogg');
    this.loadSound('place', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/dig/stone1.ogg');
    this.loadSound('splash', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/splash.ogg');
    this.loadSound('swim', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/liquid/swim1.ogg');
    
    // New sounds
    this.loadSound('click', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/click.ogg');
    this.loadSound('pop', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/pop.ogg');
    this.loadSound('hit', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit1.ogg');
    this.loadSound('hurt', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit2.ogg');
    this.loadSound('level_up', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/levelup.ogg');
    this.loadSound('explosion', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/explode1.ogg');
    this.loadSound('orb', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/orb.ogg');
    this.loadSound('bow_shoot', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/bow.ogg');
    this.loadSound('bow_hit', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/bowhit1.ogg');
    this.loadSound('anvil_land', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/anvil_land.ogg');
    this.loadSound('anvil_use', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/anvil_use.ogg');
    this.loadSound('chest_open', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/chestopen.ogg');
    this.loadSound('chest_close', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/chestclosed.ogg');
    
    // Mob sounds
    this.loadSound('zombie_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/zombie/say1.ogg');
    this.loadSound('zombie_hurt', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/zombie/hurt1.ogg');
    this.loadSound('zombie_death', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/zombie/death.ogg');
    this.loadSound('skeleton_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/skeleton/say1.ogg');
    this.loadSound('skeleton_hurt', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/skeleton/hurt1.ogg');
    this.loadSound('skeleton_death', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/skeleton/death.ogg');
    this.loadSound('cow_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/cow/say1.ogg');
    this.loadSound('pig_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/pig/say1.ogg');
    this.loadSound('sheep_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/sheep/say1.ogg');
    this.loadSound('creeper_fuse', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/creeper/say1.ogg');
  }

  private loadSound(name: string, url: string) {
    const sound = new THREE.Audio(this.listener);
    this.audioLoader.load(url, (buffer) => {
      sound.setBuffer(buffer);
      sound.setVolume(0.5);
      this.sounds.set(name, sound);
    }, undefined, (e) => {
      console.error("Failed to load audio", url, e);
    });
  }

  private loadAmbient(name: string, url: string, volume: number = 0.1) {
    const sound = new THREE.Audio(this.listener);
    this.audioLoader.load(url, (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(volume);
      this.ambientSounds.set(name, sound);
      // Don't play immediately, wait for user interaction or explicit call
    });
  }

  public startAmbient(name: string) {
    const sound = this.ambientSounds.get(name);
    if (sound && !sound.isPlaying) {
      sound.play();
    }
  }

  public stopAmbient(name: string) {
    const sound = this.ambientSounds.get(name);
    if (sound && sound.isPlaying) {
      sound.stop();
    }
  }

  public play(name: string, volume: number = 0.5, pitch: number = 1.0) {
    this.resume();
    const sound = this.sounds.get(name);
    if (sound && sound.buffer) {
      if (sound.isPlaying) {
        sound.stop();
      }
      sound.setVolume(volume);
      if (sound.setPlaybackRate) {
        sound.setPlaybackRate(pitch);
      }
      sound.play();
    }
  }

  public playPositional(name: string, position: THREE.Vector3, volume: number = 0.5, pitch: number = 1.0, distance: number = 20) {
    this.resume();
    const baseSound = this.sounds.get(name);
    if (!baseSound || !baseSound.buffer) return;

    // Find an available positional audio from the pool
    let pAudio = this.positionalPool.find(p => !p.isPlaying);
    if (!pAudio) {
      // If pool is full, grab the one that has been playing the longest (or just the first one)
      pAudio = this.positionalPool[0];
      if (pAudio.isPlaying) pAudio.stop();
    }

    pAudio.setBuffer(baseSound.buffer);
    pAudio.setVolume(volume);
    pAudio.setRefDistance(distance / 4);
    pAudio.setMaxDistance(distance);
    pAudio.position.copy(position);
    pAudio.updateMatrixWorld();
    
    if (pAudio.setPlaybackRate) {
      pAudio.setPlaybackRate(pitch);
    }
    
    pAudio.play();
  }

  public resume() {
    if (this.listener && this.listener.context) {
      if (this.listener.context.state === 'suspended') {
        this.listener.context.resume().catch(e => console.warn("Audio resume failed:", e));
      }
    } else {
      // Fallback in case listener isn't perfectly set up yet but context exists globally
      const ctx = THREE.AudioContext.getContext() as any;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch((e: any) => console.warn("Audio resume fallback failed:", e));
      }
    }
  }

  public playStep(surface: string) {
    const pitch = 0.8 + Math.random() * 0.4;
    switch (surface) {
      case 'grass': this.play('step_grass', 0.3, pitch); break;
      case 'stone': this.play('step_stone', 0.3, pitch); break;
      case 'sand': this.play('step_sand', 0.3, pitch); break;
      case 'wood': this.play('step_wood', 0.3, pitch); break;
      default: this.play('step_grass', 0.3, pitch);
    }
  }
}

export const audioManager = new AudioManager();
