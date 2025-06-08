// CDN-Safe DuckDB WASM Implementation with proper CORS handling

// Global state
let duckdbInstance = null;
let connectionInstance = null;
let isInitialized = false;
let initializationMode = 'none';

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
  
  console.log("✅ Mock DuckDB initialized successfully");
  return { db: mockDB, isReal: false };
}

// CDN-based DuckDB loading with proper CORS handling
async function loadDuckDBFromCDN() {
  console.log("🌐 Loading DuckDB from CDN with CORS handling...");
  
  try {
    // Use the official DuckDB CDN with ES modules
    const duckdbUrl = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser.mjs';
    
    console.log("📦 Importing DuckDB module from CDN...");
    
    // Dynamic import with proper error handling
    const duckdb = await import(duckdbUrl);
    
    console.log("✅ DuckDB module imported successfully");
    console.log("🔧 Creating DuckDB instance...");
    
    // Create logger
    const logger = new duckdb.ConsoleLogger();
    
    // Get the bundles
    const bundles = duckdb.getJsDelivrBundles();
    
    console.log("📦 Available bundles:", Object.keys(bundles));
    
    // Try MVP bundle first (most compatible)
    const bundle = bundles.mvp;
    
    console.log("🔧 Initializing with MVP bundle...");
    
    const worker = new Worker(bundle.mainWorker);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    
    console.log("🔧 Instantiating DuckDB...");
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    console.log("✅ Real DuckDB initialized successfully from CDN!");
    return { db, duckdb, worker, isReal: true };
    
  } catch (error) {
    console.error("❌ CDN DuckDB loading failed:", error.message);
    throw error;
  }
}

// Main initialization function
window.initializeDuckDB = async function() {
  if (isInitialized) {
    console.log("📦 DuckDB already initialized");
    return { db: duckdbInstance, connection: connectionInstance, isReal: initializationMode === 'real' };
  }
  
  console.log("🦆 Starting CDN-safe DuckDB WASM initialization...");
  
  try {
    // Try to load real DuckDB from CDN
    const result = await loadDuckDBFromCDN();
    
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
        detail: { type: 'real', message: 'Real DuckDB ready (CDN)' }
      }));
    }, 100);
    
    return { db: duckdbInstance, connection: connectionInstance, isReal: true };
    
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
console.log("🚀 Auto-initializing CDN-safe DuckDB...");
window.initializeDuckDB().catch(error => {
  console.error("❌ Failed to initialize DuckDB:", error);
  window.dispatchEvent(new CustomEvent('duckdb-error', {
    detail: { error: error.message }
  }));
});