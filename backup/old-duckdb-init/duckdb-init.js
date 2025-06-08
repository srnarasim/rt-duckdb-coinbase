/**
 * Real DuckDB-WASM Initialization using Official CDN Method
 * Based on: https://duckdb.org/docs/stable/clients/wasm/instantiation.html
 */

let duckdbInstance = null;
let connectionInstance = null;
let isInitialized = false;
let initializationMode = 'unknown';

// Timeout for real DuckDB initialization
const REAL_DUCKDB_TIMEOUT = 15000;  // 15 seconds for real DuckDB

/**
 * Initialize DuckDB with official CDN method
 */
async function initializeDuckDB() {
  console.log("🚀 Initializing Real DuckDB-WASM using official CDN method...");
  
  if (isInitialized) {
    console.log("✅ DuckDB already initialized in mode:", initializationMode);
    return { db: duckdbInstance, connection: connectionInstance, mode: initializationMode };
  }
  
  // Try Real DuckDB WASM using official method
  try {
    console.log("🔄 Loading DuckDB-WASM from official CDN...");
    const realResult = await Promise.race([
      initializeRealDuckDB(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Real DuckDB timeout")), REAL_DUCKDB_TIMEOUT)
      )
    ]);
    
    duckdbInstance = realResult.db;
    connectionInstance = realResult.connection;
    isInitialized = true;
    initializationMode = 'real';
    
    // Make available globally
    window.duckdbInstance = duckdbInstance;
    window.duckdbConnection = connectionInstance;
    window.duckdbReal = true;
    
    console.log("✅ Real DuckDB-WASM initialized successfully!");
    
    // Dispatch success event
    window.dispatchEvent(new CustomEvent('duckdb-ready', { 
      detail: { 
        db: duckdbInstance, 
        connection: connectionInstance,
        mode: initializationMode,
        isReal: true
      } 
    }));
    
    return { db: duckdbInstance, connection: connectionInstance, mode: initializationMode };
    
  } catch (realError) {
    console.warn("⚠️ Real DuckDB-WASM failed, falling back to mock:", realError.message);
    
    // Fallback to mock implementation
    try {
      await loadMockDuckDB();
      const mockResult = await initializeMockDuckDB();
      
      duckdbInstance = mockResult.db;
      connectionInstance = mockResult.connection;
      isInitialized = true;
      initializationMode = 'mock';
      
      // Make available globally
      window.duckdbInstance = duckdbInstance;
      window.duckdbConnection = connectionInstance;
      window.duckdbReal = false;
      
      console.log("✅ Mock DuckDB initialized successfully!");
      
      // Dispatch success event
      window.dispatchEvent(new CustomEvent('duckdb-ready', { 
        detail: { 
          db: duckdbInstance, 
          connection: connectionInstance,
          mode: initializationMode,
          isReal: false
        } 
      }));
      
      return { db: duckdbInstance, connection: connectionInstance, mode: initializationMode };
      
    } catch (mockError) {
      console.warn("⚠️ Mock DuckDB failed, falling back to simulation:", mockError.message);
      
      // Final fallback to simulation mode
      const simResult = initializeSimulationMode();
      
      duckdbInstance = simResult.db;
      connectionInstance = simResult.connection;
      isInitialized = true;
      initializationMode = 'simulation';
      
      // Make available globally
      window.duckdbInstance = duckdbInstance;
      window.duckdbConnection = connectionInstance;
      window.duckdbReal = false;
      
      console.log("✅ Simulation mode initialized!");
      
      // Dispatch success event
      window.dispatchEvent(new CustomEvent('duckdb-ready', { 
        detail: { 
          db: duckdbInstance, 
          connection: connectionInstance,
          mode: initializationMode,
          isReal: false
        } 
      }));
      
      return { db: duckdbInstance, connection: connectionInstance, mode: initializationMode };
    }
  }
}

/**
 * Initialize Real DuckDB-WASM using official CDN method
 */
async function initializeRealDuckDB() {
  console.log("📦 Loading Real DuckDB-WASM from official CDN...");
  
  // Import DuckDB-WASM from official CDN
  const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm');
  
  // Get the official bundles from jsDelivr CDN
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  console.log("📦 Available bundles:", Object.keys(JSDELIVR_BUNDLES));
  
  // Select the best bundle for this browser
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  console.log("✅ Selected bundle:", bundle);
  
  // Create a worker URL
  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
  );
  
  // Instantiate the asynchronous version of DuckDB-Wasm
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  
  // Initialize the database
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  
  // Clean up the worker URL
  URL.revokeObjectURL(worker_url);
  
  // Open a connection
  const connection = await db.connect();
  
  console.log("✅ Real DuckDB-WASM connection established!");
  
  // Create the trades table
  await initializeTradesTable(connection);
  
  return { db, connection };
}

/**
 * Initialize the trades table with proper schema
 */
async function initializeTradesTable(connection) {
  console.log("📊 Creating trades table...");
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS trades (
      id BIGINT,
      timestamp TIMESTAMP,
      price DECIMAL(18,8),
      size DECIMAL(18,8),
      side VARCHAR(10),
      exchange VARCHAR(20),
      symbol VARCHAR(20)
    )
  `;
  
  await connection.query(createTableSQL);
  console.log("✅ Trades table created successfully");
}

/**
 * Load mock DuckDB implementation
 */
async function loadMockDuckDB() {
  console.log("📦 Loading mock DuckDB implementation...");
  
  const mockScript = document.createElement('script');
  mockScript.src = '/static/duckdb-wasm.js';
  
  return new Promise((resolve, reject) => {
    mockScript.onload = () => {
      console.log("✅ Mock DuckDB loaded successfully!");
      resolve();
    };
    
    mockScript.onerror = (error) => {
      console.error("❌ Failed to load mock DuckDB:", error);
      reject(error);
    };
    
    document.head.appendChild(mockScript);
  });
}

/**
 * Initialize mock DuckDB
 */
async function initializeMockDuckDB() {
  console.log("🔧 Initializing mock DuckDB...");
  
  // Wait for mock DuckDB to be available
  let attempts = 0;
  while (!window.DuckDB && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!window.DuckDB) {
    throw new Error("Mock DuckDB not available after loading");
  }
  
  const db = new window.DuckDB();
  const connection = {
    query: async (sql) => {
      console.log("Mock query:", sql);
      return { toArray: () => [] };
    }
  };
  
  return { db, connection };
}

/**
 * Initialize simulation mode (final fallback)
 */
function initializeSimulationMode() {
  console.log("🎮 Initializing simulation mode...");
  
  const db = {
    connect: () => Promise.resolve(simulationConnection)
  };
  
  const simulationConnection = {
    query: async (sql) => {
      console.log("Simulation query:", sql);
      return { 
        toArray: () => [],
        numRows: 0
      };
    }
  };
  
  return { db, connection: simulationConnection };
}

// Export the main function
window.initializeDuckDB = initializeDuckDB;

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
  initializeDuckDB().catch(error => {
    console.error("❌ Auto-initialization failed:", error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('duckdb-error', { 
      detail: { error: error.message } 
    }));
  });
});

console.log("📦 DuckDB initialization module loaded");