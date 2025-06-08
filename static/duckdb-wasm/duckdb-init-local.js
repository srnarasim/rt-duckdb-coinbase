/**
 * Local DuckDB WASM Initialization
 * Uses local WASM files to avoid CDN Apache Arrow conflicts
 */

let duckdbInstance = null;
let connectionInstance = null;
let isInitialized = false;
let initializationMode = 'mock';

// Local DuckDB initialization using direct WASM loading
async function initializeLocalDuckDB() {
  try {
    console.log("🦆 Attempting local DuckDB WASM initialization...");
    
    // Try to load DuckDB from local files first
    const duckdbWasm = await import('./duckdb-browser.js');
    
    console.log("📦 DuckDB module loaded, creating database...");
    const db = new duckdbWasm.AsyncDuckDB();
    
    // Initialize with local WASM files
    await db.instantiate({
      mainModule: './duckdb-mvp.wasm',
      mainWorker: './duckdb-browser-mvp.worker.js'
    });
    
    console.log("✅ Local DuckDB initialized successfully!");
    return { db, duckdb: duckdbWasm, isReal: true };
    
  } catch (error) {
    console.error("❌ Local DuckDB loading failed:", error.message);
    throw error;
  }
}

// Simplified mock DuckDB for fallback
function createMockDuckDB() {
  console.log("🎭 Creating simplified mock DuckDB...");
  
  const mockConnection = {
    async query(sql, params = []) {
      console.log("🎭 Mock query:", sql.substring(0, 100) + "...");
      
      // Return empty results for all queries
      return {
        toArray: () => [],
        numRows: 0,
        numCols: 0
      };
    },
    
    async close() {
      console.log("🎭 Mock connection closed");
    }
  };
  
  const mockDB = {
    async connect() {
      return mockConnection;
    },
    
    async close() {
      console.log("🎭 Mock database closed");
    }
  };
  
  return { db: mockDB, isReal: false };
}

// Main initialization function
window.initializeDuckDB = async function() {
  if (isInitialized) {
    console.log("📦 DuckDB already initialized");
    return { db: duckdbInstance, connection: connectionInstance, isReal: initializationMode === 'real' };
  }
  
  console.log("🦆 Starting local DuckDB WASM initialization...");
  
  try {
    // Try local DuckDB first
    const result = await initializeLocalDuckDB();
    duckdbInstance = result.db;
    connectionInstance = await duckdbInstance.connect();
    initializationMode = 'real';
    isInitialized = true;
    
    console.log("✅ Real DuckDB WASM initialized successfully!");
    
    // Dispatch success event
    window.dispatchEvent(new CustomEvent('duckdb-ready', {
      detail: { 
        type: 'real',
        db: duckdbInstance,
        connection: connectionInstance
      }
    }));
    
    return { db: duckdbInstance, connection: connectionInstance, isReal: true };
    
  } catch (realError) {
    console.warn("⚠️ Real DuckDB WASM failed, using mock:", realError.message);
    
    // Fall back to mock
    const mockResult = createMockDuckDB();
    duckdbInstance = mockResult.db;
    connectionInstance = await duckdbInstance.connect();
    initializationMode = 'mock';
    isInitialized = true;
    
    console.log("✅ Mock DuckDB initialized as fallback");
    
    // Dispatch success event with mock
    window.dispatchEvent(new CustomEvent('duckdb-ready', {
      detail: { 
        type: 'mock',
        db: duckdbInstance,
        connection: connectionInstance
      }
    }));
    
    return { db: duckdbInstance, connection: connectionInstance, isReal: false };
  }
};

// Auto-initialize when script loads
console.log("📦 DuckDB local initialization script loaded");