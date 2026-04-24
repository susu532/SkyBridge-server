
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
  renderDistance: 7,
  fov: 75,
  sensitivity: 0.002,
  invertMouse: false,
  volume: 0.5,
  showDebug: false,
  performanceMode: false,
  premiumShaders: true,
  keybinds: { ...DEFAULT_KEYBINDS },
};

class SettingsManager {
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: ((settings: GameSettings) => void)[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem('game_settings');
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
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
      localStorage.setItem('game_settings', JSON.stringify(this.settings));
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
