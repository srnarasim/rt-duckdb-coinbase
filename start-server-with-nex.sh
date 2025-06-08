#!/bin/bash

# Default NEX URL
NEX_URL=${NEX_URL:-"nats://localhost:4222"}

# Build the server
echo "Building server..."
cd proxy
cargo build --release
cd ..

# Start the server with NEX Stream
echo "Starting server with NEX Stream at $NEX_URL..."
cd proxy
RUST_LOG=info ./target/release/rt-duckdb-coinbase-server --nex-url "$NEX_URL" --proxy-port 3030 --http-port 54572 --static-dir ".." "$@"