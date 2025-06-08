#!/bin/bash

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack is not installed. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build the WebAssembly module
echo "Building WebAssembly module..."
wasm-pack build --target web

# Create static/wasm directory if it doesn't exist
echo "Creating static/wasm directory..."
mkdir -p static/wasm

# Copy the WebAssembly files to the static/wasm directory
echo "Copying WebAssembly files to static/wasm directory..."
cp -r pkg/* static/wasm/

echo "WebAssembly build complete!"