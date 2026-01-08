# ⚽ Kick Challenge — Global Country Competition

A lightweight, high-engagement web application inspired by viral interaction mechanics (Popcat-style), designed to create a **global competition between countries** through a simple, gamified interaction.

👉 **Live demo:** https://kick.codmanaging.com

---

## 🌍 Global Challenge Concept

**This is not a user-based game.**

Each kick contributes to a **country-level score**, creating a worldwide competition.

> **Challenge the world:** which country will kick the ball the most?

No accounts. No profiles. Just pure national competition driven by a single action.

---

## 🎯 Core Idea

**One action. Instant feedback. One nation.**

Users kick a football by clicking or tapping on it.  
Every interaction:
- Triggers immediate visual feedback
- Increments the global score
- Contributes to the country leaderboard

The simplicity is intentional: **maximum engagement with zero friction**.

---

## 🚀 Features

- ⚡ One-click / one-tap interaction
- 🌍 Country-based global leaderboard
- 🧮 Real-time score tracking
- 🏆 Best country ranking
- 📱 Fully responsive (desktop & mobile)
- 🧼 Clean, minimal UI

---

## 🧠 Gamification & Product Principles

- **Zero-friction UX** — no login, no onboarding
- **Instant reward loop** — visual + numeric feedback
- **Collective competition** — play for your country
- **Replay incentive** — push your nation up the leaderboard

Ideal use cases:
- International sports events
- Brand activations
- Live campaigns
- Gamified marketing experiences

---

## 🧱 Tech Stack

### Frontend
- **React**
- Functional components & hooks
- Performance-focused rendering
- Responsive layout

### Backend
- **Go (Golang)**
- Minimal HTTP API
- Country-based score aggregation
- Designed for high concurrency and low latency

---

## 🏗️ Architecture Overview

[Client (React)]
       |
       | HTTP
       v
[Minimal Go API]
       |
       v
[Country Score Logic]


The backend is intentionally lightweight to support:
- High traffic spikes
- Fast response times
- Simple horizontal scaling

---

## 🛠️ Local Development

### Prerequisites
- Node.js ≥ 18
- Go ≥ 1.20

### Frontend
```bash
cd react-football-fe
npm install
npm run build
docker compose up -d
```
### Backend
``` bash
cd react-football-be
docker compose up -d
```
