#!/bin/bash

# Build the main application
echo "Building main application..."
./build.sh

# Build and start the unified Rust server
echo "Building and starting unified Rust server..."
cd proxy
cargo build --release
echo "Starting server..."
RUST_LOG=info ./target/release/rt-duckdb-coinbase-server --simulate --proxy-port 3030 --http-port 54572 --static-dir ".."