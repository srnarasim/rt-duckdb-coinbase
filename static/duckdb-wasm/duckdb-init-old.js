/**
 * Optimized DuckDB WASM Initialization
 * This file initializes DuckDB WASM with progressive loading and better error handling
 */

// Global initialization function
window.initializeDuckDB = async function() {
  try {
    console.log("🦆 Starting DuckDB WASM initialization...");
    
    // Step 1: Load DuckDB module
    console.log("📦 Loading DuckDB module...");
    const duckdbModule = await import('./duckdb-browser.mjs');
    const duckdb = duckdbModule.default || duckdbModule;
    console.log("✅ DuckDB module loaded successfully");
    
    // Step 2: Try CDN bundles first (faster, cached)
    console.log("🌐 Attempting CDN bundles (faster loading)...");
    try {
      const cdnBundles = await duckdb.selectBundle({
        mvp: {
          mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-mvp.wasm',
          mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.worker.js'
        },
        eh: {
          mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-eh.wasm',
          mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-eh.worker.js'
        }
      });
      
      if (cdnBundles) {
        console.log("✅ Using CDN bundle:", cdnBundles);
        return await initializeWithBundle(duckdb, cdnBundles, "CDN");
      }
    } catch (cdnError) {
      console.warn("⚠️ CDN bundles failed, trying local bundles:", cdnError.message);
    }
    
    // Step 3: Fallback to local bundles
    console.log("💾 Using local bundles...");
    const localBundles = await duckdb.selectBundle({
      mvp: {
        mainModule: '/static/duckdb-wasm/duckdb-mvp.wasm',
        mainWorker: '/static/duckdb-wasm/duckdb-browser-mvp.worker.js'
      },
      eh: {
        mainModule: '/static/duckdb-wasm/duckdb-eh.wasm',
        mainWorker: '/static/duckdb-wasm/duckdb-browser-eh.worker.js'
      }
    });
    
    return await initializeWithBundle(duckdb, localBundles, "Local");
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
      try {
        await loadMockDuckDB();
        return { db: window.duckdbInstance, duckdb: window.duckdb, isReal: false };
      } catch (mockError) {
        console.error("❌ Failed to load mock DuckDB as well:", mockError.message);
        throw new Error("Failed to load both real and mock DuckDB");
      }
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