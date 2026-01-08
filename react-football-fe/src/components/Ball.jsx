import { useRef } from 'react';
import './Ball.css';
import BallImg from './../assets/soccer-ball.png';

function Ball({ x = 0, y = 0, radius = 48, rotate = 0, scale = 1, onStart = () => {}, pulse = false }) {
  const startX = useRef(null);
  const startY = useRef(null);
  const clickOffsetX = useRef(null);
  const clickOffsetY = useRef(null);

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    e.stopPropagation();
    
    // Get click position relative to ball center
    const rect = e.currentTarget.getBoundingClientRect();
    clickOffsetX.current = e.clientX - (rect.left + rect.width / 2);
    clickOffsetY.current = e.clientY - (rect.top + rect.height / 2);
    
    startX.current = e.clientX;
    startY.current = e.clientY;
  };

  const handlePointerUp = (e) => {
    if (startX.current !== null) {
      // Calculate swipe direction
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      
      // Pass both click position on ball and swipe direction
      onStart({
        clickOffsetX: clickOffsetX.current,
        clickOffsetY: clickOffsetY.current,
        swipeDx: dx,
        swipeDy: dy,
      });

      startX.current = null;
      startY.current = null;
      clickOffsetX.current = null;
      clickOffsetY.current = null;
    }
  };

  return (
    <div
      className="ball-container"
      style={{
        width: radius * 2,
        height: radius * 2,
        left: x,
        bottom: y,
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <img
        src={BallImg}
        alt="Soccer Ball"
        style={{
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          backgroundColor: 'transparent',
          transform: `rotate(${rotate}deg) scale(${scale})`,
          transition: pulse ? 'transform 0.18s ease' : undefined,
          animation: pulse ? 'rotation 3s infinite' : undefined,
        }}
        draggable={false}
      />
    </div>
  );
}

export default Ball;
