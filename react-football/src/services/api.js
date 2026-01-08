// API Service for football game

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://94.250.202.189:501/api';

// Get user's country (uses free IP geolocation API)
let cachedCountry = null;

export async function getUserCountry() {
  if (cachedCountry) return cachedCountry;
  
  // Try multiple geolocation APIs as fallbacks
  const apis = [
    { url: 'http://ip-api.com/json/', field: 'country' },
    { url: 'https://ipwho.is/', field: 'country' },
    { url: 'https://freeipapi.com/api/json', field: 'countryName' },
  ];
  
  for (const api of apis) {
    try {
      const response = await fetch(api.url);
      if (response.ok) {
        const data = await response.json();
        cachedCountry = data[api.field] || 'Unknown';
        if (cachedCountry !== 'Unknown') {
          return cachedCountry;
        }
      }
    } catch (error) {
      console.warn(`Geolocation API ${api.url} failed:`, error.message);
    }
  }
  
  console.error('All geolocation APIs failed');
  return 'Unknown';
}

// Submit a click to the backend
export async function submitClick() {
  try {
    const country = await getUserCountry();
    
    const response = await fetch(`${API_BASE_URL}/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country,
        clicks: 1,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit click');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to submit click:', error);
    // Don't throw - clicks should work even if backend fails
    return null;
  }
}

// Submit score when game ends
export async function submitScore(score) {
  try {
    const country = await getUserCountry();
    
    const response = await fetch(`${API_BASE_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country,
        score,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit score');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to submit score:', error);
    return null;
  }
}

// Get leaderboard data
export async function getLeaderboard() {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    // Return mock data for development/offline
    return getMockLeaderboard();
  }
}

// Mock data for development
function getMockLeaderboard() {
  return [
    { country: 'Worldwide', clicks: 656059243590, kps: 121.5 },
    { country: 'Thailand', clicks: 125372654430 },
    { country: 'Hong Kong', clicks: 123544704358 },
    { country: 'Taiwan', clicks: 121641777274 },
    { country: 'Japan', clicks: 108900576886 },
    { country: 'South Korea', clicks: 30896930588 },
    { country: 'Malaysia', clicks: 24306210836 },
    { country: 'Saudi Arabia', clicks: 11543394788 },
    { country: 'United States', clicks: 10979691153 },
    { country: 'Indonesia', clicks: 10214917736 },
    { country: 'Finland', clicks: 9343331012 },
    { country: 'Sweden', clicks: 9049407326 },
    { country: 'Poland', clicks: 6287369734 },
    { country: 'United Arab Emirates', clicks: 4867417348 },
    { country: 'Denmark', clicks: 4393508714 },
    { country: 'Germany', clicks: 3892156789 },
    { country: 'France', clicks: 3654789012 },
    { country: 'United Kingdom', clicks: 3421567890 },
    { country: 'Morocco', clicks: 2987654321 },
  ];
}
