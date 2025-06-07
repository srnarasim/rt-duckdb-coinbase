#!/bin/bash

echo "Preparing files for GitHub Pages deployment..."

# Make a backup of the original index.html
cp index.html index.original.html

# Copy the GitHub Pages specific index to index.html
cp github-pages-index.html index.html

# Make sure all necessary files are present
echo "Checking for required files..."

if [ ! -f "pkg/rt_duckdb_coinbase.wasm" ]; then
  echo "ERROR: WebAssembly file missing!"
else
  echo "WebAssembly file found."
fi

if [ ! -f "pkg/rt_duckdb_coinbase.js" ]; then
  echo "ERROR: JavaScript bindings file missing!"
else
  echo "JavaScript bindings file found."
fi

if [ ! -f "static/observable-plot.min.js" ]; then
  echo "ERROR: Observable Plot library missing!"
else
  echo "Observable Plot library found."
fi

if [ ! -f "static/duckdb-wasm.js" ]; then
  echo "ERROR: DuckDB-WASM library missing!"
else
  echo "DuckDB-WASM library found."
fi

# Create a .nojekyll file to prevent GitHub Pages from ignoring files that begin with an underscore
touch .nojekyll

echo "Creating a test file to verify GitHub Pages is working..."
echo "<html><body><h1>GitHub Pages Test</h1><p>If you can see this, GitHub Pages is working correctly.</p></body></html>" > test.html

echo "Done! Files are ready for GitHub Pages deployment."
echo "After pushing to GitHub, your site should be available at: https://srnarasim.github.io/rt-duckdb-coinbase/"