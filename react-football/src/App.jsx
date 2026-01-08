import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Scoreboard from './components/Scoreboard';
import Emoji from './components/Emoji';
import Ball from './components/Ball';
import Leaderboard from './components/Leaderboard';
import { submitClick, submitScore } from './services/api';
import kickSound from './assets/sounds/kick.ogg';
import wallSound from './assets/sounds/wall.ogg';
import endSound from './assets/sounds/end.ogg';
import backgroundImg from './assets/background.png';

// Physical variables (tuned for 60fps baseline)
const TARGET_FPS = 60;
const TARGET_FRAME_TIME = 1000 / TARGET_FPS; // ~16.67ms
const gravity = 1.2;
const radius = 48;
const rotationFactor = 4;
const bounceFactor = 0.6;
const friction = 0.99;
const kickStrength = 25;

function App() {
  const [position, setPosition] = useState({
    x: window.innerWidth / 2 - radius,
    y: 100,
  });
  const [velocity, setVelocity] = useState({ vx: 0, vy: 0 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  // Removed squash effect
  const [score, setScore] = useState(0);
  const [miss, setMiss] = useState(0);
  const [standby, setStandby] = useState(true);
  const [best, setBest] = useState(0);
  const [emoji, setEmoji] = useState({ x: 0, y: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const velocityRef = useRef(velocity);
  const positionRef = useRef(position);
  const scoreRef = useRef(score);
  const gameStartedRef = useRef(gameStarted);

  // Keep refs in sync
  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  // Preload all audio and background image before allowing game to start
  useEffect(() => {
    let loaded = 0;
    const total = 4;
    const onAssetLoad = () => {
      loaded++;
      if (loaded === total) setAssetsLoaded(true);
    };

    // Preload audio
    [kickSound, wallSound, endSound].forEach(src => {
      const audio = new window.Audio();
      audio.src = src;
      audio.oncanplaythrough = onAssetLoad;
      audio.load();
    });

    // Preload background image
    const img = new window.Image();
    img.src = backgroundImg;
    img.onload = onAssetLoad;
  }, []);

  // Physics loop with delta time for consistent behavior across frame rates
  useEffect(() => {
    let animationId;
    let lastTime = performance.now();

    const updatePhysics = (currentTime) => {
      // Calculate delta time and normalize to 60fps
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Delta multiplier: 1.0 at 60fps, 0.5 at 120fps, 2.0 at 30fps
      const delta = deltaTime / TARGET_FRAME_TIME;
      
      // Clamp delta to prevent huge jumps (e.g., when tab is inactive)
      const clampedDelta = Math.min(delta, 3);

      if (!gameStartedRef.current) {
        animationId = requestAnimationFrame(updatePhysics);
        return;
      }

      const vel = velocityRef.current;
      const pos = positionRef.current;

      // Apply gravity (scaled by delta)
      let newVy = vel.vy - gravity * clampedDelta;
      
      // Apply friction (adjusted for delta time)
      const frictionMultiplier = Math.pow(friction, clampedDelta);
      let newVx = vel.vx * frictionMultiplier;

      // Update position (scaled by delta)
      let newX = pos.x + newVx * clampedDelta;
      let newY = pos.y + newVy * clampedDelta;

      // Ground collision - bottom of ball touches ground
      if (newY <= 0) {
        newY = 0;
        // Missed the ball - it hit the ground - GAME OVER
        if (scoreRef.current > 0) {
          const finalScore = scoreRef.current;
          setLastScore(finalScore);
          setBest(b => Math.max(b, finalScore));
          setGameOver(true);
          setGameStarted(false);
          setMiss(m => m + 1);
          setScore(0);
          setStandby(true);
          newVy = 0;
          newVx = 0;
          playSound(endSound);
          // Submit final score to backend
          submitScore(finalScore);
        } else {
          // No score yet, just stop the ball
          newVy = 0;
          newVx = 0;
        }
      }

      // Wall collisions
      const maxX = window.innerWidth - radius * 2;
      if (newX < 0) {
        newX = 0;
        newVx = -newVx * bounceFactor;
        playSound(wallSound);
      } else if (newX > maxX) {
        newX = maxX;
        newVx = -newVx * bounceFactor;
        playSound(wallSound);
      }

      // Ceiling collision
      const maxY = window.innerHeight - radius * 2;
      if (newY > maxY) {
        newY = maxY;
        newVy = -newVy * bounceFactor;
      }

      // Update rotation based on horizontal velocity (scaled by delta)
      setRotation(r => r + newVx * rotationFactor * clampedDelta);

    // Update scale based on velocity (squash and stretch)
      const speed = Math.sqrt(newVx * newVx + newVy * newVy);
      const newScale = 1 + Math.min(speed * 0.005, 0.15);
      setScale(newScale);
      
      // No squash effect

      setVelocity({ vx: newVx, vy: newVy });
      setPosition({ x: newX, y: newY });

      animationId = requestAnimationFrame(updatePhysics);
    };

    animationId = requestAnimationFrame(updatePhysics);

    return () => cancelAnimationFrame(animationId);
  }, []);

  // Handle ball kick
  const handleBallKick = useCallback(({ clickOffsetX, clickOffsetY, swipeDx, swipeDy }) => {
    if (gameOver) {
     return;
    }
    if (!gameStarted) {
      setGameStarted(true);
      setStandby(false);
    }

    // Calculate kick direction based on:
    // 1. Where you clicked on the ball (clicking left side pushes ball right)
    // 2. Swipe direction (swiping adds extra velocity)
    
    // Click position effect: clicking left of center pushes right, and vice versa
    const clickEffect = -clickOffsetX / radius; // Normalized: -1 to 1
    
    // Swipe effect: add extra velocity based on swipe
    const swipeEffect = -swipeDx * 0.3;
    
    // Combined horizontal velocity
    const kickVx = (clickEffect * kickStrength * 0.6) + swipeEffect;
    
    // Vertical velocity: always kick upward, stronger if clicked on bottom of ball
    const verticalBoost = Math.max(0, clickOffsetY / radius) * 5; // Clicking bottom gives more lift
    const kickVy = kickStrength + verticalBoost;

    setVelocity(v => ({
      vx: v.vx + kickVx,
      vy: Math.max(v.vy + kickVy, kickVy), // Minimum upward velocity
    }));

    // Play kick sound
    playSound(kickSound);

    // No squash effect

    // Update score
    setScore(s => {
      const newScore = s + 1;
      if (newScore > best) {
        setBest(newScore);
      }
      return newScore;
    });
    setStandby(false);

    // Submit click to backend
    submitClick();

    // Update emoji position
    setEmoji({
      x: positionRef.current.x + radius,
      y: positionRef.current.y + radius,
    });
  }, [gameStarted, best, gameOver]);

  // Handle container click (miss)
  const handleContainerClick = (e) => {
    if (e.target === e.currentTarget && gameStarted) {
      // Clicked outside the ball
    }
  };

  // Handle restart game
  const handleRestart = () => {
    setPosition({
      x: window.innerWidth / 2 - radius,
      y: 100,
    });
    setVelocity({ vx: 0, vy: 0 });
    setRotation(0);
    setScale(1);
    setScore(0);
    setGameOver(false);
    setGameStarted(false);
    setStandby(true);
  };

  function playSound(sound) {
    const audio = new window.Audio(sound);
    audio.currentTime = 0;
    audio.volume = 0.7;
    audio.play();
  }

  if (!assetsLoaded) {
    return (
      <div className="loading-assets">
        <div className="spinner"></div>
        <div>Loading game assets...</div>
      </div>
    );
  }

  return (
    <div className="container" onClick={handleContainerClick}>
      {/* Ground Line */}
      {/* <div className="ground-area"></div>
      <div className="ground-line"></div>
       */}
      {/* Leaderboard Button */}
      <button 
        className="leaderboard-button" 
        onClick={() => setShowLeaderboard(true)}
      >
        <span>🏆</span>
        Leaderboard
      </button>
      
      <Scoreboard
        score={score}
        standby={standby}
        best={best}
      />
      <Ball
        x={position.x}
        y={position.y}
        radius={radius}
        rotate={rotation}
        scale={scale}
        onStart={handleBallKick}
        pulse={!gameStarted && !gameOver}
      />
      <Emoji
        x={emoji.x}
        y={emoji.y}
        score={score}
        miss={miss}
        gameOver={gameOver}
      />
      {/* Ball will pulse when waiting to start */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>Game Over!</h2>
            <div className="score-display">
              <span className="score-label2">Your Score</span>
              <span className="final-score">{lastScore}</span>
            </div>
            <div className="best-display">
              <span className="best-label">Best Score</span>
              <span className="best-score">{best}</span>
            </div>
            <button className="restart-hint" onClick={handleRestart}>Play Again</button>
          </div>
        </div>
      )}
      
      {/* Leaderboard Modal */}
      <Leaderboard 
        isOpen={showLeaderboard} 
        onClose={() => setShowLeaderboard(false)} 
      />
    </div>
  );
}

export default App;
