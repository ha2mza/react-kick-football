# Football Game Backend

A Go backend for the Football juggling game with anti-spam protection using encrypted payloads and Redis persistence.

## Features

- **Click tracking by country** - Tracks clicks from users grouped by their country
- **Leaderboard API** - Returns worldwide and per-country click statistics
- **Redis persistence** - Data saved every 10 minutes and on shutdown
- **Crash recovery** - Loads data from Redis on restart
- **Anti-spam protection**:
  - Encrypted payloads (XOR + Base64)
  - HMAC-SHA256 signature verification
  - Timestamp validation (prevents replay attacks)
  - Token-based replay protection
  - Rate limiting per IP
- **CORS enabled** for frontend integration

## API Endpoints

### POST `/api/click`
Submit a click event.

**Headers:**
- `Content-Type: application/json`
- `X-Timestamp: <unix_timestamp_ms>`
- `X-Signature: <hmac_sha256_signature>`

**Body:**
```json
{
  "data": "<encrypted_payload_base64>"
}
```

### POST `/api/score`
Submit a game score.

**Headers:** Same as click endpoint

**Body:**
```json
{
  "data": "<encrypted_payload_base64>"
}
```

### GET `/api/leaderboard`
Get the leaderboard data.

**Response:**
```json
[
  { "country": "Worldwide", "clicks": 656059243590, "pps": 121.5 },
  { "country": "Thailand", "clicks": 125372654430 },
  { "country": "Hong Kong", "clicks": 123544704358 }
]
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "redis": "connected"
}
```

## Running with Docker Compose (Recommended)

```bash
cd backend

# Start Redis and backend
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Running Locally

### Prerequisites
- Go 1.21 or later
- Redis server running

### Development
```bash
cd backend

# Start Redis (if not using Docker)
redis-server

# Run the backend
go mod download
go run main.go
```

### Production Build
```bash
cd backend
go build -o football-backend
./football-backend
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `SECRET_KEY` | football-game-secret-2024 | Encryption/signing key |
| `REDIS_URL` | localhost:6379 | Redis server address |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `REDIS_DB` | 0 | Redis database number |

## Redis Data Structure

The backend stores data in Redis using the following keys:

- `football:clicks` - Hash map of country -> click count
- `football:start_time` - Unix timestamp of when tracking started

Data is automatically:
- **Loaded** from Redis on startup
- **Saved** to Redis every 10 minutes
- **Saved** on graceful shutdown (SIGINT/SIGTERM)

## Security

The backend implements multiple layers of protection:

1. **Payload Encryption**: All sensitive data is XOR encrypted and base64 encoded
2. **Signature Verification**: HMAC-SHA256 signature validates payload integrity
3. **Timestamp Validation**: Requests must be within 5 minutes of server time
4. **Token Replay Protection**: Each request token can only be used once
5. **Rate Limiting**: Maximum 10 clicks per second per IP

## Production Considerations

For production deployment:

1. Set a strong `SECRET_KEY` environment variable
2. Configure proper CORS origins (replace `*` with your domain)
3. Use Redis with persistence enabled (AOF recommended)
4. Add HTTPS/TLS via reverse proxy (nginx, traefik)
5. Set up monitoring and alerting
6. Consider Redis Sentinel or Cluster for HA
