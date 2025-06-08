#!/bin/bash

# Default to use local NATS server
USE_LOCAL_NATS=${USE_LOCAL_NATS:-"true"}
LOCAL_NATS_URL="nats://localhost:4222"

# Default NEX Stream URL - can be overridden with environment variable
# If USE_LOCAL_NATS is true, use the local NATS server
if [ "$USE_LOCAL_NATS" = "true" ]; then
  NEX_URL=${NEX_URL:-"$LOCAL_NATS_URL"}
else
  NEX_URL=${NEX_URL:-"nats://demo.nats.io:4222"}
fi

# Build the main application
echo "Building main application..."
./build.sh

# Build the simple publisher
echo "Building simple publisher..."
cd simple-publisher
if ! cargo build --release; then
  echo "Failed to build simple publisher. Will use simulation mode instead."
  USE_SIMULATION="true"
fi
cd ..

# Build the unified Rust server
echo "Building unified Rust server..."
cd proxy
cargo build --release
cd ..

# Start the local NATS server if needed
if [ "$USE_LOCAL_NATS" = "true" ]; then
  echo "Starting local NATS server..."
  if ! ./start-nats.sh; then
    echo "Failed to start local NATS server. Will use demo NATS server instead."
    NEX_URL="nats://demo.nats.io:4222"
  fi
fi

# Start the simple publisher instead of NEX publisher
echo "Starting simple publisher..."
RUST_LOG=info ./simple-publisher/target/release/simple-publisher &
PUBLISHER_PID=$!
echo "Simple publisher started with PID: $PUBLISHER_PID"

# Give the publisher a moment to connect
sleep 2

# Start the unified Rust server
echo "Starting unified Rust server..."
cd proxy

# Check if we should use simulation mode or NEX Stream
if [ "$USE_SIMULATION" = "true" ]; then
  echo "Using simulation mode..."
  RUST_LOG=info ./target/release/rt-duckdb-coinbase-server --simulate --proxy-port 3030 --http-port 54572 --static-dir ".."
else
  echo "Connecting to NEX Stream at $NEX_URL..."
  RUST_LOG=info ./target/release/rt-duckdb-coinbase-server --nex-url "$NEX_URL" --proxy-port 3030 --http-port 54572 --static-dir ".."
fi

# Clean up the publisher when the server exits
if [ -n "$PUBLISHER_PID" ]; then
  echo "Stopping publisher..."
  kill $PUBLISHER_PID
fi