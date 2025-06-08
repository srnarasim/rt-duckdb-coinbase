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
