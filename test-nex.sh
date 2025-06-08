#!/bin/bash

# Test script for NEX Stream connection
echo "Testing NEX Stream connection..."

# Default NEX Stream URL - can be overridden with environment variable
NEX_URL=${NEX_URL:-"nats://demo.nats.io:4222"}

# Start the server with NEX Stream connection
cd proxy
cargo run -- --nex-url "$NEX_URL" --proxy-port 3030 --http-port 54572 --static-dir ".."