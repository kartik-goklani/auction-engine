# Auction Engine

An agentic procurement auctions engine built as a module of a larger ERP system.
Buyers run competitive bidding events. Vendors compete to win contracts.
Four LangGraph AI agents advise the buyer before, during, and after every auction
using live data — no hardcoded recommendations, no simulated intelligence.

---

## What This Is

A full-stack procurement auctions platform with two portals:

- **Buyer Portal** — procurement teams create auctions, invite vendors,
  monitor live bidding, and award contracts
- **Vendor Portal** — suppliers receive invitations, place bids in real time,
  and view results

What separates this from a standard auctions tool is the agentic layer —
four LangGraph agents that reason over live system data to advise buyers
at every critical decision point.

---

## Repository Structure

```
auction-engine/
├── auction-frontend/     Next.js 14 — Buyer and Vendor portals
├── auction-backend/      NestJS — API, bid engine, AI agents
├── ARCHITECTURE.md       Full system design document
└── README.md             This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | NestJS, TypeScript |
| Agents | LangGraph JS v1.0 |
| AI Model | OpenAI GPT-4o-mini |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Real-time | Socket.IO |
| Deployment | Railway |
| Observability | LangSmith |

---

## The Four AI Agents

| Agent | When It Fires | What It Does |
|---|---|---|
| Price Intelligence | On auction creation | Suggests ceiling price, decrement, and risk threshold from historical data |
| Vendor Shortlisting | When buyer selects vendors | Ranks vendors by category fit, performance history, and capacity |
| Anomaly Detection | On every accepted bid | Detects collusion patterns and suspiciously low bids in real time |
| Award Recommendation | When auction closes | Recommends winner based on price, performance, and auction flags |

---

## Auction Types

- **Reverse Auction** — one buyer, many vendors, price goes down
- **Forward Auction** — one buyer, many vendors, price goes up
- **Sealed Bid** — vendors bid once privately, all revealed on close

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Supabase project (database, auth, realtime enabled)
- OpenAI API key
- LangSmith API key (free tier)
- Railway account

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/auction-engine.git
cd auction-engine
```

### 2. Set Up the Backend
```bash
cd auction-backend
cp .env.example .env
# Fill in your values in .env
npm install
npm run start:dev
```

### 3. Set Up the Frontend
```bash
cd auction-frontend
cp .env.example .env.local
# Fill in your values in .env.local
npm install
npm run dev
```

### 4. Backend runs on `http://localhost:3001`
### 5. Frontend runs on `http://localhost:3000`

---

## Environment Variables

### Backend (`auction-backend/.env`)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
OPENAI_API_KEY=
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=auction-engine-mvp
PORT=3001
NODE_ENV=development
```

### Frontend (`auction-frontend/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## Key Concepts

### Money
All monetary values are stored and transmitted as integers in paise.
₹1 = 100 paise. Floats are never used for money at any layer.

### Auction Lifecycle
```
DRAFT → PUBLISHED → OPEN → CLOSED → AWARDED
```
Any state can transition to CANCELLED (buyer only, with reason).
Transitions are enforced server-side. Invalid transitions return 422.

### Bid Validation
Every bid passes five checks in sequence:
1. Auction is in OPEN state
2. Vendor is invited and accepted
3. Amount is at or below ceiling price
4. Amount beats current best by at least minimum decrement
5. Vendor has not bid in the last 3 seconds

All bid writes use PostgreSQL row-level locking to prevent race conditions.

### Real-time
Live bid updates are delivered via Socket.IO.
Each auction has its own room. Vendor identity is never broadcast to other vendors.
Visibility mode (Blind / Rank Only / Price Visible) is enforced server-side.

---

## Deployment

Both services deploy to Railway under one project.

```
Railway Project: auction-engine
├── Service: auction-backend
└── Service: auction-frontend
```

External dependencies:
- Supabase — database, auth, realtime
- OpenAI API — all agent reasoning
- LangSmith — agent run observability

---

## Architecture

See `ARCHITECTURE.md` for the full system design including:
- Complete database schema
- All API routes
- WebSocket event contract
- Agent tool definitions
- Module ownership rules
- State machine specification

---

## MVP Scope

### Included
- Full buyer portal (8 screens)
- Full vendor portal (5 screens)
- Three auction types
- Four LangGraph AI agents
- Real-time bidding via WebSocket
- Auto-extension
- Bid validation engine
- Immutable audit trail
- In-app notifications
- Agent trace viewer

### Planned for Phase 2
- Programs and Projects portfolio management
- Auction Simulation Studio
- Spend analysis tools
- Contract generation
- Email and SMS notifications
- Multi-lot auctions
- Weighted scoring auction type
