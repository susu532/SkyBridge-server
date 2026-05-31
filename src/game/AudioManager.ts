import * as THREE from 'three';
import { settingsManager } from './Settings';
import { SOUND_URLS } from './SoundConfig';

class AudioManager {
  private listener: THREE.AudioListener;
  private sounds: Map<string, THREE.Audio | THREE.PositionalAudio> = new Map();
  private audioLoader: THREE.AudioLoader;
  private initialized: boolean = false;
  private ambientSounds: Map<string, THREE.Audio> = new Map();

  // Background Music (BGM) management
  private currentMusic: HTMLAudioElement | null = null;
  private musicVolume: number = 0.4;

  private positionalPool: THREE.PositionalAudio[] = [];
  private audioPool: THREE.Audio[] = [];

  constructor() {
    this.audioLoader = new THREE.AudioLoader();
    
    if (typeof window !== 'undefined') {
      this.listener = new THREE.AudioListener();
      
      // Subscribe to settings for global volume
      settingsManager.subscribe((settings) => {
        if (this.listener) this.listener.setMasterVolume(settings.volume);
        if (this.currentMusic) this.currentMusic.volume = settings.volume * this.musicVolume;
      });
      // Set initial volume
      const initialVolume = settingsManager.getSettings().volume;
      if (this.listener) this.listener.setMasterVolume(initialVolume);

      // Initialize pools
      for (let i = 0; i < 30; i++) {
        const pAudio = new THREE.PositionalAudio(this.listener);
        pAudio.setRefDistance(5);
        pAudio.setMaxDistance(50);
        pAudio.setRolloffFactor(1);
        this.positionalPool.push(pAudio);
      }
      for (let i = 0; i < 20; i++) {
        this.audioPool.push(new THREE.Audio(this.listener));
      }

      // Unbreakable brute-force unlocking to guarantee audio context resumes
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

  public setMuted(muted: boolean) {
    if (this.listener) {
      if (muted) {
        this.listener.setMasterVolume(0);
        if (this.currentMusic) this.currentMusic.volume = 0;
      } else {
        const volume = settingsManager.getSettings().volume;
        this.listener.setMasterVolume(volume);
        if (this.currentMusic) this.currentMusic.volume = volume * this.musicVolume;
      }
    }
  }

  public getMuted(): boolean {
    if (this.listener) {
      return this.listener.getMasterVolume() === 0;
    }
    return false;
  }

  public init(camera: THREE.Camera) {
    if (this.listener.parent) {
      this.listener.parent.remove(this.listener);
    }
    camera.add(this.listener);
    
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
    
    this.loadSound('click', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/click.ogg');
    this.loadSound('pop', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/pop.ogg');
    this.loadSound('hit', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit1.ogg');
    this.loadSound('hurt', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/damage/hit2.ogg');
    this.loadSound('level_up', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/levelup.ogg');
    this.loadSound('explosion', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/explode1.ogg');
    this.loadSound('orb', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/orb.ogg');
    this.loadSound('bow_shoot', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/bow.ogg');
    this.loadSound('bow_hit', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/bowhit1.ogg');
    this.loadSound('chest_open', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/chestopen.ogg');
    this.loadSound('chest_close', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/random/chestclosed.ogg');
    
    // Ambient sounds from config
    Object.entries(SOUND_URLS).forEach(([name, url]) => {
      if (name.startsWith('ambient_')) {
        this.loadAmbient(name, url);
      }
    });

    // Default ambient
    this.loadAmbient('rain', 'https://raw.githubusercontent.com/susu532/sounds/main/minecraft/sounds/Remastered/ambient/weather/rain1.ogg', 0);
    
    // Mob sounds
    this.loadSound('zombie_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/zombie/say1.ogg');
    this.loadSound('zombie_hurt', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/zombie/hurt1.ogg');
    this.loadSound('zombie_death', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/zombie/death.ogg');
    this.loadSound('skeleton_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/skeleton/say1.ogg');
    this.loadSound('skeleton_hurt', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/skeleton/hurt1.ogg');
    this.loadSound('skeleton_death', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/skeleton/death.ogg');
    this.loadSound('cow_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/cow/say1.ogg');
    this.loadSound('sheep_idle', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/sheep/say1.ogg');
    this.loadSound('creeper_fuse', 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19/assets/minecraft/sounds/mob/creeper/say1.ogg');
  }

  public playMusic(key: keyof typeof SOUND_URLS) {
    const url = SOUND_URLS[key];
    if (!url) return;

    if (this.currentMusic) {
      if (this.currentMusic.src === url) return; // Already playing
      this.currentMusic.pause();
      this.currentMusic = null;
    }

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = settingsManager.getSettings().volume * this.musicVolume;
    audio.play().catch(e => console.warn("Music playback failed, waiting for interaction:", e));
    this.currentMusic = audio;
  }

  public stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }
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

  public setAmbientVolume(name: string, volume: number) {
    const sound = this.ambientSounds.get(name);
    if (sound) {
      sound.setVolume(volume);
    }
  }

  public isAmbientPlaying(name: string): boolean {
    const sound = this.ambientSounds.get(name);
    return sound ? sound.isPlaying : false;
  }

  public play(name: string, volume: number = 0.5, pitch: number = 1.0) {
    this.resume();
    const baseSound = this.sounds.get(name);
    if (!baseSound || !baseSound.buffer) return;

    let audio = this.audioPool.find(a => !a.isPlaying);
    if (!audio) {
      audio = this.audioPool[0];
      if (audio.isPlaying) audio.stop();
    }

    audio.setBuffer(baseSound.buffer);
    audio.setVolume(volume);
    
    if (audio.setPlaybackRate) {
      audio.setPlaybackRate(pitch);
    }
    
    audio.play();
  }

  public playPositional(name: string, position: THREE.Vector3, volume: number = 0.5, pitch: number = 1.0, distance: number = 20) {
    this.resume();
    const baseSound = this.sounds.get(name);
    if (!baseSound || !baseSound.buffer) return;

    let pAudio = this.positionalPool.find(p => !p.isPlaying);
    if (!pAudio) {
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

  public playPositionalStep(surface: string, position: THREE.Vector3) {
    const pitch = 0.8 + Math.random() * 0.4;
    switch (surface) {
      case 'grass': this.playPositional('step_grass', position, 0.3, pitch); break;
      case 'stone': this.playPositional('step_stone', position, 0.3, pitch); break;
      case 'sand': this.playPositional('step_sand', position, 0.3, pitch); break;
      case 'wood': this.playPositional('step_wood', position, 0.3, pitch); break;
      default: this.playPositional('step_grass', position, 0.3, pitch);
    }
  }
}

export const audioManager = new AudioManager();

