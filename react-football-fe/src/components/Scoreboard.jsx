import './Scoreboard.css';

function Scoreboard({ score, standby, best }) {
  return (
    <div className="score-container">
      <span className="score-label">
        {standby ? 'Current best' : '\u00A0'}
      </span>
      <span 
        className="score-value"
        style={{ color: standby ? '#3ba05c' : 'white' }}
      >
        {standby ? best : score}
      </span>
    </div>
  );
}

export default Scoreboard;
