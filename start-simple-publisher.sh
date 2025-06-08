#!/bin/bash

# Build and start the simple publisher
echo "Building simple publisher..."
cd simple-publisher
cargo build --release
echo "Starting simple publisher..."
RUST_LOG=info ./target/release/simple-publisher "$@"