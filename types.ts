
export interface Point {
  x: number;
  y: number;
}

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Bullet extends GameObject {
  speed: number;
  active: boolean;
}

export interface Enemy extends GameObject {
  speed: number;
  health: number;
  type: 'basic' | 'fast' | 'heavy';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface HandData {
  x: number;
  y: number;
  isPinching: boolean;
  isOpenPalm: boolean;
}

export enum GameState {
  LOBBY,
  PLAYING,
  GAMEOVER
}
