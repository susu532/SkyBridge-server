
import { getRandomCutePlayerName } from "./CuteNames";

export interface Keybinds {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  crouch: string;
  sprint: string;
  inventory: string;
  drop: string;
  zoom: string;
  perspective: string;
  fly: string;
  toggleHUD: string;
  leaderboard: string;
  feedback: string;
  slot1: string;
  slot2: string;
  slot3: string;
  slot4: string;
  slot5: string;
  slot6: string;
  slot7: string;
  slot8: string;
  slot9: string;
}

export interface GameSettings {
  username: string;
  renderDistance: number;
  fov: number;
  sensitivity: number;
  invertMouse: boolean;
  volume: number;
  showDebug: boolean;
  performanceMode: boolean;
  premiumShaders: boolean;
  hideShininess: boolean;
  language: string;
  keybinds: Keybinds;
}

export const DEFAULT_KEYBINDS: Keybinds = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  crouch: 'ShiftLeft',
  sprint: 'ControlLeft',
  inventory: 'KeyE',
  drop: 'KeyQ',
  zoom: 'KeyV',
  perspective: 'KeyB',
  fly: 'KeyP',
  toggleHUD: 'KeyN',
  leaderboard: 'Tab',
  feedback: 'KeyG',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  slot4: 'Digit4',
  slot5: 'Digit5',
  slot6: 'Digit6',
  slot7: 'Digit7',
  slot8: 'Digit8',
  slot9: 'Digit9',
};

export const DEFAULT_SETTINGS: GameSettings = {
  username: getRandomCutePlayerName(),
  renderDistance: 7,
  fov: 75,
  sensitivity: 0.002,
  invertMouse: false,
  volume: 0.5,
  showDebug: false,
  performanceMode: false,
  premiumShaders: false,
  hideShininess: true,
  language: 'en',
  keybinds: { ...DEFAULT_KEYBINDS },
};

class SettingsManager {
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: ((settings: GameSettings) => void)[] = [];

  constructor() {
    // Detect mobile/tablet devices
    const isMobileDevice = typeof window !== 'undefined' && 
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      ('ontouchstart' in window) || 
      (navigator.maxTouchPoints > 0));
    
    if (isMobileDevice) {
      this.settings.premiumShaders = false;
      this.settings.renderDistance = Math.min(this.settings.renderDistance, 3); // lowering default render distance for mobile
      this.settings.sensitivity = 0.005; // 50 in UI
    }

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('game_settings_v2');
        if (saved) {
          // Deep merge to ensure all defaults are present (like keybinds)
          const parsed = JSON.parse(saved);
          this.settings = { ...this.settings, ...parsed };
          
          // Fix for returning mobile users who had performanceMode forced to true by default previously
          if (isMobileDevice && !localStorage.getItem('v2_perf_reset_v3')) {
             this.settings.performanceMode = false;
             localStorage.setItem('v2_perf_reset_v3', 'true');
             localStorage.setItem('game_settings_v2', JSON.stringify(this.settings));
          }
          
          if (isMobileDevice && !localStorage.getItem('v2_mobile_sens_v1')) {
             this.settings.sensitivity = 0.005;
             localStorage.setItem('v2_mobile_sens_v1', 'true');
             localStorage.setItem('game_settings_v2', JSON.stringify(this.settings));
          }
        }
      }
    } catch (e) {
      console.error('Failed to access or parse localStorage settings', e);
    }

    // Try to load from CrazyGames async
    if (typeof window !== 'undefined') {
      setTimeout(async () => {
         try {
           if ((window as any).CrazyGames?.SDK?.data) {
             const cgSaved = await (window as any).CrazyGames.SDK.data.getItem('game_settings_v2');
             if (cgSaved) {
               const parsed = JSON.parse(cgSaved);
               this.settings = { ...this.settings, ...parsed };
               
               if (isMobileDevice && !localStorage.getItem('v2_perf_reset_v3_cg')) {
                  this.settings.performanceMode = false;
                  localStorage.setItem('v2_perf_reset_v3_cg', 'true');
                  try {
                     (window as any).CrazyGames.SDK.data.setItem('game_settings_v2', JSON.stringify(this.settings));
                  } catch(e) {}
               }
               
               if (isMobileDevice && !localStorage.getItem('v2_mobile_sens_v1_cg')) {
                  this.settings.sensitivity = 0.005;
                  localStorage.setItem('v2_mobile_sens_v1_cg', 'true');
                  try {
                     (window as any).CrazyGames.SDK.data.setItem('game_settings_v2', JSON.stringify(this.settings));
                  } catch(e) {}
               }
               
               this.notify();
             }
           }
         } catch(e) {}
      }, 1000);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('game_settings_v2', JSON.stringify(this.settings));
      }
      // CrazyGames Cloud Save
      if (typeof window !== 'undefined' && (window as any).CrazyGames?.SDK?.data) {
        (window as any).CrazyGames.SDK.data.setItem('game_settings_v2', JSON.stringify(this.settings));
      }
    } catch (e) {
      console.error('Failed to save settings to localStorage or Cloud', e);
    }
    this.notify();
  }

  subscribe(listener: (settings: GameSettings) => void) {
    this.listeners.push(listener);
    listener(this.settings);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.settings));
  }
}

export const settingsManager = new SettingsManager();
