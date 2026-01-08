import { useState, useEffect, useRef } from 'react';
import './Emoji.css';

const happy = ['🦁', '🏆', '🥅', '🏅', '⚽'];
const sad = ['🏆', '🦁', '🥅', '🏅', '⚽'];
const INITIAL_Y = 5;

function getRandomEmoji(isHappy) {
  if (isHappy) {
    const random = Math.floor(Math.random() * happy.length);
    return happy[random];
  } else {
    const random = Math.floor(Math.random() * sad.length);
    return sad[random];
  }
}

function Emoji({ x, y, score, miss, gameOver }) {
  const [emoji, setEmoji] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [relativeY, setRelativeY] = useState(INITIAL_Y);
  const [opacity, setOpacity] = useState(0);
  const prevScoreRef = useRef(score);
  const prevMissRef = useRef(miss);

  // Fade out when game over
  useEffect(() => {
    if (gameOver) {
      const fadeOutDuration = 300;
      const startTime = Date.now();
      const startOpacity = opacity;
      
      const fadeOut = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / fadeOutDuration, 1);
        setOpacity(startOpacity * (1 - progress));
        
        if (progress < 1) {
          requestAnimationFrame(fadeOut);
        }
      };
      requestAnimationFrame(fadeOut);
    }
  }, [gameOver]);

  useEffect(() => {
    // Check if score or miss changed
    if (score !== prevScoreRef.current || miss !== prevMissRef.current) {
      const isHappy = score !== prevScoreRef.current;
      setEmoji(getRandomEmoji(isHappy));
      setPosition({ x: x - 50, y });
      setRelativeY(INITIAL_Y);
      setOpacity(1);

      // Animate
      const animationDuration = 500;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        setRelativeY(INITIAL_Y + (120 - INITIAL_Y) * progress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);

      prevScoreRef.current = score;
      prevMissRef.current = miss;
    }
  }, [score, miss, x, y]);

  return (
    <div
      className="emoji-container"
      style={{
        bottom: position.y,
        left: position.x,
        width: 100,
        height: 200,
      }}
    >
      <span
        className="emoji-text"
        style={{
          opacity,
          marginBottom: relativeY,
        }}
      >
        {emoji}
      </span>
    </div>
  );
}

export default Emoji;
