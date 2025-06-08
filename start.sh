#!/bin/bash

# Default NEX Stream URL - can be overridden with environment variable
NEX_URL=${NEX_URL:-"nats://demo.nats.io:4222"}

# Build the main application
echo "Building main application..."
./build.sh

# Build and start the unified Rust server
echo "Building and starting unified Rust server..."
cd proxy
cargo build --release
echo "Starting server..."

# Check if we should use simulation mode or real NEX Stream
if [ "$USE_SIMULATION" = "true" ]; then
  echo "Using simulation mode..."
  RUST_LOG=info ./target/release/rt-duckdb-coinbase-server --simulate --proxy-port 3030 --http-port 54572 --static-dir ".."
else
  echo "Connecting to NEX Stream at $NEX_URL..."
  RUST_LOG=info ./target/release/rt-duckdb-coinbase-server --nex-url "$NEX_URL" --proxy-port 3030 --http-port 54572 --static-dir ".."
fi