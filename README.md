# 📊 Real-Time BTC/USD Analytics with DuckDB-WASM + Rust + Observable Plot

A lightweight, browser-based real-time analytics demo built using:

- 🦀 Rust (compiled to WASM)
- 🧩 DuckDB-WASM (embedded analytical database in browser)
- 📈 Observable Plot for data visualization
- 🌐 NEX Stream for real-time data (with Coinbase WebSocket API as fallback)
- 🛰️ Simple HTTP server for serving the app

---

## 🚀 Live Demo

The application shows real-time BTC/USD price data in a chart. It connects to a NEX Stream to get live market data, with fallback to the Coinbase WebSocket API or simulated data if the connections fail.

---

## 📦 Project Structure

rt-duckdb-coinbase/

├── Cargo.toml # Rust crate config

├── Trunk.toml # Trunk build config

├── index.html # Entry HTML file for app

├── build.sh # Build script for compiling Rust to WASM

├── start.sh # Script to start both proxy and main app

├── src/

│ └── lib.rs # Rust/WASM code - WebSocket + JS binding

├── proxy/ # NEX Stream proxy server

│ ├── Cargo.toml # Proxy crate config
│ ├── src/main.rs # Proxy server implementation
│ └── run.sh # Script to build and run the proxy

├── pkg/

│ ├── rt_duckdb_coinbase.wasm # Compiled WASM file
│ └── rt_duckdb_coinbase.js # JavaScript bindings for WASM

├── js/

│ └── duckdb.js # JavaScript code for DuckDB integration

├── static/

│ ├── duckdb-wasm.js # DuckDB-WASM runtime
│ └── observable-plot.min.js # ObservablePlot for charting

---

## 🛠️ Getting Started

### 1. Build and Run with NEX Stream Proxy

```bash
# Navigate to the project directory
cd rt-duckdb-coinbase

# Run the start script (builds and runs both the proxy and main app)
./start.sh
```

This will:
1. Start the NEX Stream proxy with simulated data on port 3030
2. Build the main application
3. Start a web server on port 54572

### 2. Build and Run Components Separately

#### Start the NEX Stream Proxy

```bash
# Navigate to the proxy directory
cd rt-duckdb-coinbase/proxy

# Build and run the proxy with simulated data
cargo build --release
RUST_LOG=info ./target/release/nex-stream-proxy --simulate --port 3030
```

#### Start the Main Application

```bash
# In another terminal, navigate to the project directory
cd rt-duckdb-coinbase

# Build the Rust code to WASM
./build.sh

# Start a simple HTTP server
python -m http.server 54572
```

### 3. Using Trunk (Alternative)

If you have Trunk installed, you can use it to build and serve the main application:

```bash
# Install prerequisites
rustup target add wasm32-unknown-unknown
cargo install trunk

# Build and serve
trunk serve
```

Note: When using Trunk, you'll still need to start the NEX Stream proxy separately.

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

1. Connects to a NEX Stream to get real-time BTC/USD price data
2. Falls back to Coinbase WebSocket API if NEX Stream is unavailable
3. Stores the data in DuckDB-WASM, an in-browser analytical database
4. Performs real-time analytics using DuckDB's SQL capabilities
5. Visualizes the data using Observable Plot
6. Updates the charts in real-time as new data arrives
7. Falls back to simulated data if both WebSocket connections fail

The implementation uses Rust compiled to WebAssembly for performance and reliability, with JavaScript bindings for browser integration.

### NEX Stream Integration

The application connects to a NEX Stream for real-time market data. The NEX Stream connection:

- Uses WebSocket protocol for real-time data streaming
- Subscribes to BTC/USD market data
- Transforms incoming data to a consistent format for processing
- Handles connection errors gracefully with fallback options
- Provides source information for data visualization

### NEX Stream Proxy

The application includes a Rust-based proxy server that:

- Simulates a NEX Stream when a real one is not available
- Handles WebSocket connections from the browser
- Manages client subscriptions to specific data subjects
- Generates realistic market data with random price movements
- Provides CORS headers for cross-origin requests
- Can be configured to connect to a real NEX Stream when available

### DuckDB-WASM Analytics

The application leverages DuckDB-WASM for in-browser analytics:

- Stores all incoming data in a structured table
- Creates analytical views with window functions for moving averages
- Supports filtering by data source
- Calculates real-time statistics like price changes and volatility
- Enables complex SQL queries directly in the browser
