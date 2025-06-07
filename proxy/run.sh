#!/bin/bash

# Build the proxy
cargo build --release

# Run the proxy with simulation mode enabled
RUST_LOG=info ./target/release/nex-stream-proxy --simulate --port 3030