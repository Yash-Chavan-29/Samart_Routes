# 🚦 SmartRoutes / IntelliRoute: Intelligent Traffic Management & Route Optimization System

> **Problem Statement 01 (PS 01) — Full Stack Web Development**  
> An intelligent, graph-driven traffic management and navigation platform built with **Node.js, Express, MySQL, Leaflet.js, and Chart.js**.

---

## 📖 Overview

In urban centers, traffic congestion, unexpected roadblocks, accidents, and inefficient traffic signal management cause severe transit delays and elevated fuel consumption. 

**IntelliRoute (SmartRoutes)** resolves these challenges by providing:
1. **Multi-Factor Route Optimization & Route Comparison**: Shortest (min distance) vs Fastest (min travel time & congestion-bypassed) routes with real-time ETA, fuel usage, and reliability scoring.
2. **AI-Based Traffic Congestion Prediction (15–30 Mins Ahead)**: Multi-parameter predictive model combining historical traffic logs, rush-hour peak times, weather conditions (Clear, Rain, Storm), and active road incidents.
3. **Intelligent Incident Detection & Network Impact Analysis**: Duplicate incident detection within a 30-minute window, automatic severity assessment (Critical, High, Medium), and graph reachability analysis for traffic spillover and alternate diversions.
4. **Adaptive Traffic Signal Optimization**: Dynamic queue and vehicle density-responsive signal timing using Webster's adaptive formulation, providing empirical pre vs. post waiting time reduction metrics (e.g. 142s ➔ 81s, **43% delay cut**).
5. **Emergency Vehicle Priority Green Corridor**: Automated preemption routing for ambulances, fire engines, and police units with traffic signal preemption (auto-switch to GREEN) and time saved metrics.
6. **Live Interactive Maps & Traffic Heatmap**: OpenStreetMap and Leaflet visualization displaying live incident pins, color-coded congestion levels, and real-time path animation.

---

## 🧠 Algorithms Implemented

| Algorithm | Role & Purpose |
| :--- | :--- |
| **Dijkstra's Algorithm** | Shortest path distance calculations & graph reachability diversion analysis |
| **A\* Search Algorithm** | Heuristic-accelerated pathfinding factoring congestion weights and incident penalties |
| **Adaptive Webster Cycle** | Dynamic traffic signal cycle optimization based on queue length and inflow density |
| **Graph Spillover Analysis** | Network impact analysis evaluating incident effects on neighboring roads |
| **BFS / DFS Traversal** | Network connectivity, cycle verification, and graph traversal |

---

## 💻 Tech Stack

- **Backend**: Node.js, Express.js, RESTful API Architecture
- **Database**: MySQL (Connection Pooling with mysql2)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Leaflet.js, Chart.js, Font Awesome
- **Mapping**: OpenStreetMap Tiles via Leaflet

---

## 📂 Project Structure

```text
intelliroute-traffic/
├── database/
│   ├── schema.sql         # MySQL schema including junctions, roads, signals, logs, incidents
│   └── seed.sql           # Initial seed data for city junctions, road network, & baseline incidents
├── server/
│   ├── algorithms/        # Dijkstra, A*, BFS, DFS implementations
│   ├── client/            # Frontend Web UI
│   │   ├── css/           # Modern UI styling
│   │   ├── js/            # Client scripts (dashboard, route, map, prediction, emergency, heatmap)
│   │   ├── dashboard.html # Administrator dashboard & incident manager
│   │   ├── route.html     # Multi-factor route comparison & ranking
│   │   ├── map.html       # Live map with incident pins & route paths
│   │   ├── prediction.html# 15-30 min AI congestion forecast
│   │   ├── emergency.html # Emergency vehicle green corridor
│   │   ├── heatmap.html   # Traffic density heatmap
│   │   └── index.html     # System login
│   ├── config/            # MySQL database connection pool (db.js)
│   ├── controllers/       # Route, incident, signal, prediction, & emergency controllers
│   ├── routes/            # REST API route declarations
│   ├── services/          # Graph service, recommendation service, traffic prediction
│   ├── .env.example       # Environment template
│   ├── app.js             # Express application & static client routing
│   └── server.js          # Server entry point with uncaught exception handling
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **MySQL / MariaDB** (e.g. XAMPP or native MySQL service on port 3306)

### 2. Database Setup
Import the database schema and seed data into MySQL:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 3. Server Configuration
Navigate to the `server` directory and configure `.env`:
```bash
cd server
cp .env.example .env
```
Ensure your database credentials in `.env` are accurate:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=intelliroute_db
DB_PORT=3306
JWT_SECRET=your_secret_key
```

### 4. Install Dependencies & Start Server
```bash
npm install
node server.js
```

The application will be running at: **http://localhost:5000**

---

## 🔑 Demo Credentials
- **Username**: `admin`
- **Password**: `admin123`
