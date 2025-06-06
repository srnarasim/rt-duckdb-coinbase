# 📊 Real-Time BTC/USD Analytics with DuckDB-WASM + Rust + D3

A lightweight, browser-based real-time analytics demo built using:

- 🦀 Rust (compiled to WASM)
- 🧩 DuckDB-WASM (embedded analytical database in browser)
- 📈 D3.js / Observable Plot for charting
- 🌐 Coinbase WebSocket API for live crypto market data
- 🛰️ `trunk` for building and serving the app

---

## 🚀 Live Demo

> _(Optional: Add GitHub Pages link or `localhost` screenshot here)_

---

## 📦 Project Structure

rt-duckdb-coinbase/

├── Cargo.toml # Rust crate config

├── Trunk.toml # Trunk build config

├── index.html # Entry HTML file for app

├── src/

│ └── lib.rs # Rust/WASM code - WebSocket + JS binding

├── static/

│ ├── duckdb-wasm.js # DuckDB-WASM runtime (optional, can use CDN)

│ └── observable-plot.min.js # ObservablePlot for charting



---

## 🛠️ Getting Started

### 1. Install Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [wasm32 target](https://rustwasm.github.io/docs/wasm-pack/installer/)
- [`trunk`](https://trunkrs.dev/) (for Rust WASM builds)

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk

