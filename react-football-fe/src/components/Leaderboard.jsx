import { useState, useEffect, useRef } from 'react';
import './Leaderboard.css';
import 'flag-icons/css/flag-icons.min.css';
import { getLeaderboard } from '../services/api';

// Country name to ISO 3166-1 alpha-2 code mapping
const countryToCode = {
  'Afghanistan': 'af',
  'Albania': 'al',
  'Algeria': 'dz',
  'Argentina': 'ar',
  'Australia': 'au',
  'Austria': 'at',
  'Bahrain': 'bh',
  'Bangladesh': 'bd',
  'Belgium': 'be',
  'Brazil': 'br',
  'Canada': 'ca',
  'Chile': 'cl',
  'China': 'cn',
  'Colombia': 'co',
  'Czech Republic': 'cz',
  'Denmark': 'dk',
  'Egypt': 'eg',
  'Finland': 'fi',
  'France': 'fr',
  'Germany': 'de',
  'Greece': 'gr',
  'Hong Kong': 'hk',
  'India': 'in',
  'Indonesia': 'id',
  'Ireland': 'ie',
  'Israel': 'il',
  'Italy': 'it',
  'Japan': 'jp',
  'Jordan': 'jo',
  'Kenya': 'ke',
  'Kuwait': 'kw',
  'Lebanon': 'lb',
  'Malaysia': 'my',
  'Mexico': 'mx',
  'Morocco': 'ma',
  'Netherlands': 'nl',
  'New Zealand': 'nz',
  'Nigeria': 'ng',
  'Norway': 'no',
  'Oman': 'om',
  'Pakistan': 'pk',
  'Peru': 'pe',
  'Philippines': 'ph',
  'Poland': 'pl',
  'Portugal': 'pt',
  'Qatar': 'qa',
  'Romania': 'ro',
  'Russia': 'ru',
  'Saudi Arabia': 'sa',
  'Singapore': 'sg',
  'South Africa': 'za',
  'South Korea': 'kr',
  'Spain': 'es',
  'Sweden': 'se',
  'Switzerland': 'ch',
  'Taiwan': 'tw',
  'Thailand': 'th',
  'Turkey': 'tr',
  'Ukraine': 'ua',
  'United Arab Emirates': 'ae',
  'United Kingdom': 'gb',
  'United States': 'us',
  'Vietnam': 'vn',
};

// Get flag class for a country
function getCountryFlag(country) {
  if (country === 'Worldwide') {
    return { type: 'emoji', value: '🌍' };
  }
  if (country === 'Unknown') {
    return { type: 'emoji', value: '🏳️' };
  }
  const code = countryToCode[country];
  if (code) {
    return { type: 'flag-icon', value: code };
  }
  return { type: 'emoji', value: '🏳️' };
}

function formatNumber(num) {
  return num.toLocaleString();
}

function getRankIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

// Animated number component
function AnimatedNumber({ value, duration = 500 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current === value) return;
    
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{displayValue.toLocaleString()}</>;
}

function Leaderboard({ isOpen, onClose }) {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [worldwideData, setWorldwideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
      
      // Auto-refresh every 5 seconds
      const interval = setInterval(() => {
        refreshLeaderboard();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      
      // Separate worldwide from countries
      const worldwide = data.find(item => item.country === 'Worldwide');
      const countries = data.filter(item => item.country !== 'Worldwide');
      
      setWorldwideData(worldwide);
      setLeaderboardData(countries);
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Silent refresh without loading state
  const refreshLeaderboard = async () => {
    setIsRefreshing(true);
    try {
      const data = await getLeaderboard();
      
      const worldwide = data.find(item => item.country === 'Worldwide');
      const countries = data.filter(item => item.country !== 'Worldwide');
      
      setWorldwideData(worldwide);
      setLeaderboardData(countries);
    } catch (err) {
      console.error('Failed to refresh leaderboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-container" onClick={(e) => e.stopPropagation()}>
        <div className="leaderboard-header">
          <span className="leaderboard-icon">🏆</span>
          <h2>Leaderboard</h2>
          <button className="leaderboard-close" onClick={onClose}>
            <span>✕</span>
          </button>
        </div>
        
        {loading ? (
          <div className="leaderboard-loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="leaderboard-error">
            <p>{error}</p>
            <button onClick={fetchLeaderboard}>Retry</button>
          </div>
        ) : (
          <div className="leaderboard-content">
            {/* Worldwide Stats */}
            {worldwideData && (
              <div className="worldwide-row">
                <span className="country-flag">🌍</span>
                <span className="country-name">Worldwide</span>
                <span className="kps-badge" title="Kicks Per Second">{worldwideData.kps?.toFixed(1) || '0'} KPS</span>
                <span className="click-count">
                  <AnimatedNumber value={worldwideData.clicks} /> kicks
                </span>
                {isRefreshing && <span className="refresh-indicator">•</span>}
              </div>
            )}
            
            {/* Country List */}
            <div className="country-list">
              {leaderboardData.map((item, index) => {
                const flag = getCountryFlag(item.country);
                return (
                  <div key={item.country} className="country-row">
                    <span className="rank">{getRankIcon(index + 1)}</span>
                    <span className="country-flag">
                      {flag.type === 'flag-icon' ? (
                        <span className={`fi fi-${flag.value}`}></span>
                      ) : (
                        flag.value
                      )}
                    </span>
                    <span className="country-name">{item.country}</span>
                    <span className="click-count">
                      <AnimatedNumber value={item.clicks} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
