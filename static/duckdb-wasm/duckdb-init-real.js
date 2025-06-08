// Real DuckDB WASM Implementation - CORS-safe version using local files

// Global state
let duckdbInstance = null;
let connectionInstance = null;
let isInitialized = false;
let initializationMode = 'none';

// Helper function to load DuckDB bundles with proper CORS handling
async function initializeDuckDBWithBundle(duckdb, bundle, bundleType) {
  console.log(`🔧 Initializing DuckDB with ${bundleType} bundle...`);
  
  try {
    // Create logger
    const logger = new duckdb.ConsoleLogger();
    
    // Create database instance
    const worker = new Worker(bundle.mainWorker);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    
    // Initialize with bundle
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    console.log(`✅ ${bundleType} DuckDB bundle initialized successfully`);
    return { db, duckdb, worker, isReal: true };
    
  } catch (error) {
    console.error(`❌ ${bundleType} bundle failed:`, error.message);
    throw error;
  }
}

// Mock DuckDB implementation for fallback
function initializeMockDuckDB() {
  console.log("📦 Initializing mock DuckDB implementation...");
  
  const mockDB = {
    connect: async () => ({
      query: async (sql) => {
        console.log("🔍 Mock query:", sql);
        return {
          toArray: () => []
        };
      }
    })
  };
  
  const mockDuckDB = {
    AsyncDuckDB: function() {
      return mockDB;
    }
  };
  
  console.log("✅ Mock DuckDB initialized successfully");
  return { db: mockDB, duckdb: mockDuckDB, isReal: false };
}

// Main initialization function
window.initializeDuckDB = async function() {
  if (isInitialized) {
    console.log("📦 DuckDB already initialized");
    return { db: duckdbInstance, connection: connectionInstance, isReal: initializationMode === 'real' };
  }
  
  console.log("🦆 Starting real DuckDB WASM initialization...");
  
  try {
    // Step 1: Try to load DuckDB from local files (no CORS issues)
    console.log("📦 Loading DuckDB module from local files...");
    
    // Try local bundles first (no CORS issues)
    const localBundles = [
      {
        mainModule: './static/duckdb-wasm/duckdb-mvp.wasm',
        mainWorker: './static/duckdb-wasm/duckdb-browser-mvp.worker.js',
        pthreadWorker: './static/duckdb-wasm/duckdb-browser-mvp.pthread.worker.js'
      },
      {
        mainModule: './static/duckdb-wasm/duckdb-eh.wasm',
        mainWorker: './static/duckdb-wasm/duckdb-browser-eh.worker.js',
        pthreadWorker: './static/duckdb-wasm/duckdb-browser-eh.pthread.worker.js'
      }
    ];
    
    // Check if we have local DuckDB files
    let duckdb;
    try {
      // Try to import local DuckDB module
      duckdb = await import('./duckdb-browser.mjs');
      console.log("✅ Local DuckDB module loaded successfully");
    } catch (localError) {
      console.warn("⚠️ Local DuckDB module not found, trying CDN with CORS handling...");
      
      // Fallback to CDN with proper CORS handling
      try {
        // Use dynamic import with proper error handling
        const response = await fetch('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser.mjs', {
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (!response.ok) {
          throw new Error(`CDN fetch failed: ${response.status}`);
        }
        
        const moduleText = await response.text();
        const moduleBlob = new Blob([moduleText], { type: 'application/javascript' });
        const moduleUrl = URL.createObjectURL(moduleBlob);
        
        duckdb = await import(moduleUrl);
        console.log("✅ CDN DuckDB module loaded with CORS handling");
        
        // Clean up blob URL
        URL.revokeObjectURL(moduleUrl);
        
      } catch (cdnError) {
        console.error("❌ CDN DuckDB module failed:", cdnError.message);
        throw new Error("Both local and CDN DuckDB modules failed to load");
      }
    }
    
    // Step 2: Try local bundles
    console.log("💾 Attempting local DuckDB bundles...");
    for (const bundle of localBundles) {
      try {
        console.log(`💾 Trying local bundle: ${bundle.mainModule.includes('mvp') ? 'MVP' : 'EH'}`);
        const result = await initializeDuckDBWithBundle(duckdb, bundle, 'Local');
        
        duckdbInstance = result.db;
        connectionInstance = await result.db.connect();
        isInitialized = true;
        initializationMode = 'real';
        
        // Make available globally
        window.duckdbInstance = duckdbInstance;
        window.duckdbConnection = connectionInstance;
        window.duckdbReal = true;
        
        console.log("✅ Real DuckDB initialized successfully!");
        
        // Dispatch success event
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('duckdb-ready', { 
            detail: { type: 'real', message: 'Real DuckDB ready' }
          }));
        }, 100);
        
        return { db: duckdbInstance, connection: connectionInstance, isReal: true };
        
      } catch (e) {
        console.warn(`⚠️ Local bundle failed: ${e.message}`);
      }
    }
    
    // Step 3: Try CDN bundles with CORS handling
    console.log("🌐 Attempting CDN bundles with CORS handling...");
    const cdnBundles = [
      {
        mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-mvp.wasm',
        mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.worker.js',
        pthreadWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.pthread.worker.js'
      }
    ];
    
    for (const bundle of cdnBundles) {
      try {
        console.log(`🌐 Trying CDN bundle with CORS handling: ${bundle.mainModule.includes('mvp') ? 'MVP' : 'EH'}`);
        
        // Test CORS access first
        const testResponse = await fetch(bundle.mainModule, { 
          method: 'HEAD',
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (!testResponse.ok) {
          throw new Error(`CORS preflight failed: ${testResponse.status}`);
        }
        
        const result = await initializeDuckDBWithBundle(duckdb, bundle, 'CDN');
        
        duckdbInstance = result.db;
        connectionInstance = await result.db.connect();
        isInitialized = true;
        initializationMode = 'real';
        
        // Make available globally
        window.duckdbInstance = duckdbInstance;
        window.duckdbConnection = connectionInstance;
        window.duckdbReal = true;
        
        console.log("✅ Real DuckDB initialized successfully with CDN!");
        
        // Dispatch success event
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('duckdb-ready', { 
            detail: { type: 'real', message: 'Real DuckDB ready (CDN)' }
          }));
        }, 100);
        
        return { db: duckdbInstance, connection: connectionInstance, isReal: true };
        
      } catch (e) {
        console.warn(`⚠️ CDN bundle failed: ${e.message}`);
      }
    }
    
    throw new Error("All DuckDB bundles failed to load");
    
  } catch (realError) {
    console.warn("⚠️ Real DuckDB WASM failed, falling back to mock:", realError.message);
    
    // Fallback to mock implementation
    try {
      const mockResult = initializeMockDuckDB();
      
      duckdbInstance = mockResult.db;
      connectionInstance = await mockResult.db.connect();
      isInitialized = true;
      initializationMode = 'mock';
      
      // Make available globally
      window.duckdbInstance = duckdbInstance;
      window.duckdbConnection = connectionInstance;
      window.duckdbReal = false;
      
      console.log("✅ Mock DuckDB initialized successfully!");
      
      // Dispatch success event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('duckdb-ready', { 
          detail: { type: 'mock', message: 'Mock DuckDB ready (fallback)' }
        }));
      }, 100);
      
      return { db: duckdbInstance, connection: connectionInstance, isReal: false };
      
    } catch (mockError) {
      console.error("❌ Mock DuckDB also failed:", mockError.message);
      
      // Dispatch error event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('duckdb-error', {
          detail: { error: `Both real and mock DuckDB failed: ${mockError.message}` }
        }));
      }, 100);
      
      throw mockError;
    }
  }
};

// Auto-initialize when script loads
console.log("🚀 Auto-initializing DuckDB with CORS handling...");
window.initializeDuckDB().catch(error => {
  console.error("❌ Failed to initialize DuckDB:", error);
  window.dispatchEvent(new CustomEvent('duckdb-error', {
    detail: { error: error.message }
  }));
});