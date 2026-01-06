
import React, { useRef, useEffect, useState } from 'react';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import { Bullet, Enemy, Particle, Point, HandData } from '../types';
import { isPinching, isOpenPalm, mapHandToScreen } from '../utils/gestureDetection';

interface GameCanvasProps {
  videoElement: HTMLVideoElement;
  handLandmarker: HandLandmarker;
  onGameOver: (score: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ videoElement, handLandmarker, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const scoreRef = useRef(0);
  
  // Game State Refs (to avoid re-renders)
  const playerRef = useRef({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    shield: 0, // 0 to 100
    isShieldActive: false,
    hp: 100,
    fireCooldown: 0
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastHandPosRef = useRef<Point | null>(null);

  const [displayScore, setDisplayScore] = useState(0);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      playerRef.current.x = canvas.width / 2;
      playerRef.current.y = canvas.height * 0.8;
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, []);

  // Main Game Loop
  const animate = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 1. Process Hand Tracking
    const results = handLandmarker.detectForVideo(videoElement, performance.now());
    let currentHandData: HandData | null = null;

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      // Landmark 9 is middle finger MCP - good center point
      const pos = mapHandToScreen(landmarks[9], canvas.width, canvas.height, lastHandPosRef.current);
      lastHandPosRef.current = pos;
      
      currentHandData = {
        x: pos.x,
        y: pos.y,
        isPinching: isPinching(landmarks),
        isOpenPalm: isOpenPalm(landmarks)
      };

      // Move player to hand
      playerRef.current.x = pos.x;
      playerRef.current.y = pos.y;
      playerRef.current.isShieldActive = currentHandData.isOpenPalm && playerRef.current.shield > 0;
    }

    // 2. Logic Updates
    updateGame(canvas, currentHandData);

    // 3. Drawing
    drawGame(ctx, canvas, currentHandData);

    requestRef.current = requestAnimationFrame(animate);
  };

  const updateGame = (canvas: HTMLCanvasElement, hand: HandData | null) => {
    // Shield Logic
    if (playerRef.current.isShieldActive) {
      playerRef.current.shield -= 0.5;
    } else {
      playerRef.current.shield = Math.min(100, playerRef.current.shield + 0.1);
    }

    // Fire Logic
    if (hand?.isPinching && playerRef.current.fireCooldown <= 0) {
      bulletsRef.current.push({
        x: playerRef.current.x,
        y: playerRef.current.y - 20,
        width: 4,
        height: 15,
        color: '#60a5fa',
        speed: 12,
        active: true
      });
      playerRef.current.fireCooldown = 10; // Frames between shots
    }
    if (playerRef.current.fireCooldown > 0) playerRef.current.fireCooldown--;

    // Update Bullets
    bulletsRef.current.forEach(b => {
      b.y -= b.speed;
      if (b.y < -20) b.active = false;
    });
    bulletsRef.current = bulletsRef.current.filter(b => b.active);

    // Spawn Enemies
    if (Math.random() < 0.03) {
      const types: Array<'basic' | 'fast' | 'heavy'> = ['basic', 'fast', 'heavy'];
      const type = types[Math.floor(Math.random() * types.length)];
      enemiesRef.current.push({
        x: Math.random() * canvas.width,
        y: -50,
        width: type === 'heavy' ? 60 : 35,
        height: type === 'heavy' ? 60 : 35,
        color: type === 'fast' ? '#f472b6' : type === 'heavy' ? '#f87171' : '#fbbf24',
        speed: type === 'fast' ? 5 : type === 'heavy' ? 2 : 3,
        health: type === 'heavy' ? 3 : 1,
        type
      });
    }

    // Update Enemies
    enemiesRef.current.forEach(e => {
      e.y += e.speed;
      
      // Collision with Player
      const dx = e.x - playerRef.current.x;
      const dy = e.y - playerRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < (e.width / 2 + playerRef.current.width / 2)) {
        if (playerRef.current.isShieldActive) {
          // Bounce off shield
          e.y -= 20;
          createExplosion(e.x, e.y, '#60a5fa', 5);
        } else {
          playerRef.current.hp -= 10;
          e.health = 0; // Destroy enemy on hit
          createExplosion(playerRef.current.x, playerRef.current.y, '#ef4444', 20);
          if (playerRef.current.hp <= 0) {
            onGameOver(scoreRef.current);
          }
        }
      }

      // Collision with Bullets
      bulletsRef.current.forEach(b => {
        if (
          b.x > e.x - e.width/2 && 
          b.x < e.x + e.width/2 && 
          b.y > e.y - e.height/2 && 
          b.y < e.y + e.height/2
        ) {
          b.active = false;
          e.health--;
          if (e.health <= 0) {
            scoreRef.current += e.type === 'heavy' ? 50 : 10;
            setDisplayScore(scoreRef.current);
            createExplosion(e.x, e.y, e.color, 15);
          }
        }
      });
    });
    enemiesRef.current = enemiesRef.current.filter(e => e.health > 0 && e.y < canvas.height + 100);

    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const createExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color,
        size: Math.random() * 4 + 1
      });
    }
  };

  const drawGame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, hand: HandData | null) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Bullets
    bulletsRef.current.forEach(b => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      ctx.shadowBlur = 0;
    });

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.color;
      
      // Simple alien shape
      ctx.beginPath();
      ctx.moveTo(-e.width/2, 0);
      ctx.lineTo(0, e.height/2);
      ctx.lineTo(e.width/2, 0);
      ctx.lineTo(0, -e.height/2);
      ctx.closePath();
      ctx.fill();
      
      // Glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = e.color;
      ctx.stroke();
      ctx.restore();
    });

    // Draw Player Ship
    ctx.save();
    ctx.translate(playerRef.current.x, playerRef.current.y);
    
    // Shield Visual
    if (playerRef.current.isShieldActive) {
      ctx.beginPath();
      ctx.arc(0, 0, playerRef.current.width * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.3 + Math.random() * 0.4})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(96, 165, 250, 0.1)';
      ctx.fill();
    }

    // Ship Body
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -25); // Nose
    ctx.lineTo(20, 15); // Right Wing
    ctx.lineTo(0, 5);  // Back notch
    ctx.lineTo(-20, 15); // Left Wing
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(0, -5, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine Glow
    const flicker = Math.random() * 5;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(0, 20 + flicker);
    ctx.lineTo(10, 10);
    ctx.fill();
    
    ctx.restore();

    // Draw Tracking Indicator (Small dot for hand position)
    if (hand) {
      ctx.strokeStyle = hand.isPinching ? '#f97316' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <canvas ref={canvasRef} />
      
      {/* UI Overlays */}
      <div className="absolute top-8 left-8 flex flex-col gap-2">
        <div className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">Score</div>
        <div className="text-4xl font-black text-white tabular-nums drop-shadow-lg">{displayScore}</div>
      </div>

      <div className="absolute top-8 right-8 flex flex-col gap-4 items-end">
        <div className="w-48">
          <div className="flex justify-between text-[10px] font-bold text-blue-400 mb-1 tracking-wider uppercase">
            <span>Hull Integrity</span>
            <span>{Math.ceil(playerRef.current.hp)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${playerRef.current.hp < 30 ? 'bg-red-500' : 'bg-blue-400'}`}
              style={{ width: `${playerRef.current.hp}%` }}
            />
          </div>
        </div>

        <div className="w-48">
          <div className="flex justify-between text-[10px] font-bold text-cyan-400 mb-1 tracking-wider uppercase">
            <span>Shield Power</span>
            <span>{Math.ceil(playerRef.current.shield)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-cyan-400/20">
            <div 
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${playerRef.current.shield}%` }}
            />
          </div>
        </div>
      </div>

      {/* Control Help Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${playerRef.current.fireCooldown > 0 ? 'bg-orange-500/20 border-orange-500/50' : 'bg-slate-900/40 border-slate-800'}`}>
          <span className="text-xs font-bold text-white uppercase">👌 Fire</span>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${playerRef.current.isShieldActive ? 'bg-blue-500/40 border-blue-400' : 'bg-slate-900/40 border-slate-800'}`}>
          <span className="text-xs font-bold text-white uppercase">✋ Shield</span>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
