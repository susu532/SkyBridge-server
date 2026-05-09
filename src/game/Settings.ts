
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
  username: 'Player_' + Math.floor(Math.random() * 10000),
  renderDistance: 7,
  fov: 75,
  sensitivity: 0.002,
  invertMouse: false,
  volume: 0.5,
  showDebug: false,
  performanceMode: false,
  premiumShaders: false,
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
      this.settings.performanceMode = true;
      this.settings.premiumShaders = false;
      this.settings.renderDistance = Math.min(this.settings.renderDistance, 3); // lowering default render distance for mobile
    }

    try {
      const saved = localStorage.getItem('game_settings_v2');
      if (saved) {
        // Deep merge to ensure all defaults are present (like keybinds)
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch (e) {
      console.error('Failed to access or parse localStorage settings', e);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('game_settings_v2', JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
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
