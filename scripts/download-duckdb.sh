#!/bin/bash

# Download DuckDB WASM files and include them in the repository
# This script downloads the necessary DuckDB WASM files to avoid CORS issues

set -e  # Exit on any error

echo "🦆 Downloading DuckDB WASM files..."

# Create directories
mkdir -p static/duckdb-wasm
mkdir -p static/duckdb-wasm/dist

# DuckDB WASM version to download
DUCKDB_VERSION="1.29.0"  # Use specific stable version
BASE_URL="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist"

echo "📦 Downloading DuckDB WASM v${DUCKDB_VERSION}..."

# Download core WASM files
echo "  ⬇️  Downloading duckdb-mvp.wasm..."
curl -L "${BASE_URL}/duckdb-mvp.wasm" -o "static/duckdb-wasm/duckdb-mvp.wasm"

echo "  ⬇️  Downloading duckdb-eh.wasm..."
curl -L "${BASE_URL}/duckdb-eh.wasm" -o "static/duckdb-wasm/duckdb-eh.wasm"

# Download JavaScript files
echo "  ⬇️  Downloading duckdb-browser.mjs..."
curl -L "${BASE_URL}/duckdb-browser.mjs" -o "static/duckdb-wasm/duckdb-browser.mjs"

echo "  ⬇️  Downloading duckdb-browser-mvp.worker.js..."
curl -L "${BASE_URL}/duckdb-browser-mvp.worker.js" -o "static/duckdb-wasm/duckdb-browser-mvp.worker.js"

echo "  ⬇️  Downloading duckdb-browser-eh.worker.js..."
curl -L "${BASE_URL}/duckdb-browser-eh.worker.js" -o "static/duckdb-wasm/duckdb-browser-eh.worker.js"

echo "  ⬇️  Downloading duckdb-browser-coi.worker.js..."
curl -L "${BASE_URL}/duckdb-browser-coi.worker.js" -o "static/duckdb-wasm/duckdb-browser-coi.worker.js"

# Download additional files that might be needed
echo "  ⬇️  Downloading duckdb-browser-coi.pthread.worker.js..."
curl -L "${BASE_URL}/duckdb-browser-coi.pthread.worker.js" -o "static/duckdb-wasm/duckdb-browser-coi.pthread.worker.js" || echo "    ⚠️  Optional file not found, skipping..."

echo "  ⬇️  Downloading duckdb-browser-eh.pthread.worker.js..."
curl -L "${BASE_URL}/duckdb-browser-eh.pthread.worker.js" -o "static/duckdb-wasm/duckdb-browser-eh.pthread.worker.js" || echo "    ⚠️  Optional file not found, skipping..."

# Verify downloads
echo "🔍 Verifying downloads..."
for file in "duckdb-mvp.wasm" "duckdb-eh.wasm" "duckdb-browser.mjs" "duckdb-browser-mvp.worker.js" "duckdb-browser-eh.worker.js" "duckdb-browser-coi.worker.js"; do
    if [ -f "static/duckdb-wasm/$file" ]; then
        size=$(stat -f%z "static/duckdb-wasm/$file" 2>/dev/null || stat -c%s "static/duckdb-wasm/$file" 2>/dev/null)
        echo "  ✅ $file (${size} bytes)"
    else
        echo "  ❌ $file - MISSING!"
        exit 1
    fi
done

# Create version info file
echo "📝 Creating version info..."
cat > static/duckdb-wasm/VERSION << EOF
DuckDB WASM Version: ${DUCKDB_VERSION}
Downloaded: $(date)
Source: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/
EOF

# Create bundle configuration
echo "⚙️  Creating bundle configuration..."
cat > static/duckdb-wasm/bundles.js << 'EOF'
/**
 * DuckDB WASM Bundle Configuration
 * This file defines the available bundles for different browser capabilities
 */

window.DUCKDB_BUNDLES = {
  mvp: {
    mainModule: '/static/duckdb-wasm/duckdb-mvp.wasm',
    mainWorker: '/static/duckdb-wasm/duckdb-browser-mvp.worker.js'
  },
  eh: {
    mainModule: '/static/duckdb-wasm/duckdb-eh.wasm',
    mainWorker: '/static/duckdb-wasm/duckdb-browser-eh.worker.js'
  },
  coi: {
    mainModule: '/static/duckdb-wasm/duckdb-eh.wasm',
    mainWorker: '/static/duckdb-wasm/duckdb-browser-coi.worker.js',
    pthreadWorker: '/static/duckdb-wasm/duckdb-browser-coi.pthread.worker.js'
  }
};

// Bundle selection function
window.selectDuckDBBundle = function() {
  // Check for Cross-Origin Isolation support
  if (typeof SharedArrayBuffer !== 'undefined') {
    console.log('🚀 Using COI bundle (fastest)');
    return window.DUCKDB_BUNDLES.coi;
  }
  
  // Check for Exception Handling support
  if (typeof WebAssembly.Exception !== 'undefined') {
    console.log('⚡ Using EH bundle (fast)');
    return window.DUCKDB_BUNDLES.eh;
  }
  
  // Fallback to MVP bundle
  console.log('🐌 Using MVP bundle (compatible)');
  return window.DUCKDB_BUNDLES.mvp;
};
EOF

echo "✅ DuckDB WASM files downloaded successfully!"
echo ""
echo "📁 Files saved to:"
echo "   static/duckdb-wasm/"
echo ""
echo "🔧 Next steps:"
echo "   1. Run: git add static/duckdb-wasm/"
echo "   2. Update HTML to use local files instead of CDN"
echo "   3. Replace mock implementation with real DuckDB"
echo ""
echo "💡 Bundle sizes:"
ls -lh static/duckdb-wasm/ | grep -E '\.(wasm|js)$' | awk '{print "   " $9 ": " $5}'