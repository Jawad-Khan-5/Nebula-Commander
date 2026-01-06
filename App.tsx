
import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState } from './types';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    const initTracking = async () => {
      try {
        setLoadingProgress(10);
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        setLoadingProgress(40);
        
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        landmarkerRef.current = handLandmarker;
        setLoadingProgress(70);

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraReady(true);
            setLoadingProgress(100);
          };
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError("Could not access camera or load tracking models. Please ensure camera permissions are granted.");
      }
    };

    initTracking();
    
    // Cleanup
    return () => {
      landmarkerRef.current?.close();
    };
  }, []);

  const handleStartGame = () => {
    if (isCameraReady) {
      setGameState(GameState.PLAYING);
      setScore(0);
    }
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    if (finalScore > highScore) setHighScore(finalScore);
    setGameState(GameState.GAMEOVER);
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Hidden Video Feed for Processing */}
      <video 
        ref={videoRef} 
        className="hidden" 
        playsInline 
        muted 
      />

      {/* Background Stars Effect */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3}px`,
              height: `${Math.random() * 3}px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {gameState === GameState.LOBBY && (
        <div className="z-10 text-center p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-blue-500/30 shadow-2xl max-w-md">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            NEBULA COMMANDER
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Take control of the galaxy's most advanced fighter using only your hands.
          </p>
          
          <div className="space-y-4 mb-10 text-left">
            <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-lg">
              <div className="w-10 h-10 bg-blue-500/20 rounded flex items-center justify-center text-blue-400">👋</div>
              <div>
                <p className="font-bold text-sm">MOVEMENT</p>
                <p className="text-xs text-slate-400">Move your hand to guide your ship</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-lg">
              <div className="w-10 h-10 bg-orange-500/20 rounded flex items-center justify-center text-orange-400">👌</div>
              <div>
                <p className="font-bold text-sm">FIRE WEAPONS</p>
                <p className="text-xs text-slate-400">Pinch thumb and index to shoot</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-lg">
              <div className="w-10 h-10 bg-green-500/20 rounded flex items-center justify-center text-green-400">✋</div>
              <div>
                <p className="font-bold text-sm">ENERGY SHIELD</p>
                <p className="text-xs text-slate-400">Open your palm to activate shields</p>
              </div>
            </div>
          </div>

          {!isCameraReady ? (
            <div className="w-full">
               <p className="text-sm text-blue-400 mb-2 animate-pulse">Initializing Tracking Engines...</p>
               <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-blue-500 transition-all duration-300" 
                   style={{ width: `${loadingProgress}%` }}
                 />
               </div>
               {error && <p className="mt-4 text-red-400 text-sm font-medium">{error}</p>}
            </div>
          ) : (
            <button 
              onClick={handleStartGame}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/40 transform hover:-translate-y-1"
            >
              LAUNCH MISSION
            </button>
          )}
          
          <div className="mt-6 text-slate-500 text-xs uppercase tracking-widest">
            High Score: <span className="text-blue-400">{highScore}</span>
          </div>
        </div>
      )}

      {gameState === GameState.GAMEOVER && (
        <div className="z-10 text-center p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-red-500/30 shadow-2xl max-w-sm">
          <h2 className="text-4xl font-black mb-2 text-red-500">MISSION FAILED</h2>
          <p className="text-slate-400 mb-6">Your ship was destroyed in deep space.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-800/50 p-4 rounded-xl">
              <p className="text-xs text-slate-500 uppercase">Final Score</p>
              <p className="text-2xl font-bold text-white">{score}</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl">
              <p className="text-xs text-slate-500 uppercase">Personal Best</p>
              <p className="text-2xl font-bold text-white">{highScore}</p>
            </div>
          </div>

          <button 
            onClick={handleStartGame}
            className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all mb-3"
          >
            TRY AGAIN
          </button>
          <button 
            onClick={() => setGameState(GameState.LOBBY)}
            className="w-full py-2 text-slate-400 hover:text-white text-sm font-medium transition-all"
          >
            RETURN TO HANGAR
          </button>
        </div>
      )}

      {gameState === GameState.PLAYING && landmarkerRef.current && videoRef.current && (
        <GameCanvas 
          videoElement={videoRef.current}
          handLandmarker={landmarkerRef.current}
          onGameOver={handleGameOver}
        />
      )}
    </div>
  );
};

export default App;
