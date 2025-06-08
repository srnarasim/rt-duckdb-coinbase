/**
 * Real DuckDB WASM Initialization
 * This file initializes the real DuckDB WASM library
 */

// Import DuckDB WASM module
import * as duckdb from './duckdb-browser.mjs';

// Global initialization function
window.initializeDuckDB = async function() {
  try {
    console.log("🦆 Initializing real DuckDB WASM...");
    
    // Define local bundles (no CDN dependencies)
    const LOCAL_BUNDLES = {
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
    
    // Select appropriate bundle based on browser capabilities
    let selectedBundle;
    if (typeof SharedArrayBuffer !== 'undefined') {
      console.log('🚀 Using COI bundle (fastest)');
      selectedBundle = LOCAL_BUNDLES.coi;
    } else if (typeof WebAssembly.Exception !== 'undefined') {
      console.log('⚡ Using EH bundle (fast)');
      selectedBundle = LOCAL_BUNDLES.eh;
    } else {
      console.log('🐌 Using MVP bundle (compatible)');
      selectedBundle = LOCAL_BUNDLES.mvp;
    }
    
    // Create worker and database instance
    const worker = new Worker(selectedBundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    
    // Instantiate DuckDB with WASM module
    await db.instantiate(selectedBundle.mainModule, selectedBundle.pthreadWorker);
    
    // Make available globally
    window.duckdb = duckdb;
    window.duckdbInstance = db;
    window.duckdbWorker = worker;
    
    console.log("✅ Real DuckDB WASM initialized successfully!");
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('duckdb-ready', { 
      detail: { 
        db: db, 
        duckdb: duckdb,
        bundle: selectedBundle 
      } 
    }));
    
    return { db, duckdb, worker };
    
  } catch (error) {
    console.error("❌ Failed to initialize real DuckDB WASM:", error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('duckdb-error', { 
      detail: { error: error.message } 
    }));
    
    throw error;
  }
};

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
  window.initializeDuckDB().catch(error => {
    console.error("Auto-initialization failed:", error);
  });
});

// Export for module usage
export { duckdb };
export default window.initializeDuckDB;