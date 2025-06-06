# 📊 Real-Time BTC/USD Analytics with DuckDB-WASM + Rust + D3

A lightweight, browser-based real-time analytics demo built using:

- 🦀 Rust (compiled to WASM)
- 🧩 DuckDB-WASM (embedded analytical database in browser)
- 📈 Canvas-based charting
- 🌐 Coinbase WebSocket API for live crypto market data
- 🛰️ Simple HTTP server for serving the app

---

## 🚀 Live Demo

The application shows real-time BTC/USD price data in a chart. It connects to the Coinbase WebSocket API to get live market data, or falls back to simulated data if the connection fails.

---

## 📦 Project Structure

rt-duckdb-coinbase/

├── Cargo.toml # Rust crate config

├── Trunk.toml # Trunk build config

├── index.html # Entry HTML file for app

├── build.sh # Build script for compiling Rust to WASM

├── src/

│ └── lib.rs # Rust/WASM code - WebSocket + JS binding

├── pkg/

│ ├── rt_duckdb_coinbase.wasm # Compiled WASM file
│ └── rt_duckdb_coinbase.js # JavaScript bindings for WASM

├── static/

│ ├── duckdb-wasm.js # DuckDB-WASM runtime
│ └── observable-plot.min.js # ObservablePlot for charting

---

## 🛠️ Getting Started

### 1. Build and Run Locally

```bash
# Navigate to the project directory
cd rt-duckdb-coinbase

# Build the Rust code to WASM
./build.sh

# Start a simple HTTP server
python -m http.server 8000
```

### 2. Using Trunk (Alternative)

If you have Trunk installed, you can use it to build and serve the application:

```bash
# Install prerequisites
rustup target add wasm32-unknown-unknown
cargo install trunk

# Build and serve
trunk serve
```

## 🚀 Deployment Options

### GitHub Pages

This application is automatically deployed to GitHub Pages when changes are pushed to the main branch. You can access the live demo at:

[https://srnarasim.github.io/rt-duckdb-coinbase/](https://srnarasim.github.io/rt-duckdb-coinbase/)

The GitHub Actions workflow in `.github/workflows/pages.yml` handles the build and deployment process.

### GitHub Actions Artifacts

The GitHub Actions workflows in this repository also build the application and upload the artifacts. You can download these artifacts and deploy them to any static web server.

### Other Hosting Options

This application can be hosted on any static web hosting service, such as:

- Netlify
- Vercel
- AWS S3 + CloudFront
- Azure Static Web Apps
- Google Cloud Storage

## 📝 Implementation Notes

The application:

1. Connects to the Coinbase WebSocket API to get real-time BTC/USD price data
2. Stores the data in DuckDB-WASM, an in-browser analytical database
3. Visualizes the data using canvas-based charting
4. Updates the chart in real-time as new data arrives
5. Falls back to simulated data if the WebSocket connection fails

The implementation uses Rust compiled to WebAssembly for performance and reliability, with JavaScript bindings for browser integration.
