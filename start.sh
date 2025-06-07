#!/bin/bash

# Start the NEX Stream proxy in the background
echo "Starting NEX Stream proxy..."
cd proxy
cargo build --release
RUST_LOG=info ./target/release/nex-stream-proxy --simulate --port 3030 &
PROXY_PID=$!

# Wait for the proxy to start
sleep 2

# Build the main application
cd ..
echo "Building main application..."
./build.sh

# Start the web server
echo "Starting web server..."
python -m http.server 54572 --bind 0.0.0.0

# Clean up when the web server is stopped
kill $PROXY_PID