#!/bin/bash

# Default NATS URL
NATS_URL=${NATS_URL:-"nats://localhost:4222"}

# Build the NEX publisher
echo "Building NEX publisher..."
cd nex-publisher
cargo build --release
cd ..

# Start the NEX publisher
echo "Starting NEX publisher..."
RUST_LOG=info ./nex-publisher/target/release/nex-publisher --nats-url "$NATS_URL" "$@"