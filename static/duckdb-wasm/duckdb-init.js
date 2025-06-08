/**
 * Real DuckDB WASM Initialization
 * This file initializes the real DuckDB WASM library with fallback to mock
 */

// Global initialization function
window.initializeDuckDB = async function() {
  try {
    console.log("🦆 Initializing DuckDB WASM...");
    
    // Check if we can load the real DuckDB WASM
    try {
      // Dynamic import of DuckDB WASM
      const duckdbModule = await import('./duckdb-browser.mjs');
      const duckdb = duckdbModule.default || duckdbModule;
      
      console.log("📦 Real DuckDB WASM module loaded");
      
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
      window.duckdbReal = true;
      
      console.log("✅ Real DuckDB WASM initialized successfully!");
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('duckdb-ready', { 
        detail: { 
          db: db, 
          duckdb: duckdb,
          bundle: selectedBundle,
          isReal: true
        } 
      }));
      
      return { db, duckdb, worker, isReal: true };
      
    } catch (realError) {
      console.warn("⚠️ Failed to load real DuckDB WASM, falling back to mock:", realError.message);
      
      // Fallback to mock implementation
      await loadMockDuckDB();
      
      return { db: window.duckdbInstance, duckdb: window.duckdb, isReal: false };
    }
    
  } catch (error) {
    console.error("❌ Failed to initialize DuckDB:", error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('duckdb-error', { 
      detail: { error: error.message } 
    }));
    
    throw error;
  }
};

// Mock DuckDB fallback implementation
async function loadMockDuckDB() {
  console.log("📦 Loading mock DuckDB implementation...");
  
  // Load the mock implementation
  const mockScript = document.createElement('script');
  mockScript.src = '/static/duckdb-wasm.js';
  
  return new Promise((resolve, reject) => {
    mockScript.onload = () => {
      console.log("✅ Mock DuckDB loaded successfully!");
      window.duckdbReal = false;
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('duckdb-ready', { 
        detail: { 
          db: window.duckdbInstance || window.duckdb,
          duckdb: window.duckdb,
          isReal: false
        } 
      }));
      
      resolve();
    };
    
    mockScript.onerror = (error) => {
      console.error("❌ Failed to load mock DuckDB:", error);
      reject(error);
    };
    
    document.head.appendChild(mockScript);
  });
}

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
  window.initializeDuckDB().catch(error => {
    console.error("Auto-initialization failed:", error);
  });
});