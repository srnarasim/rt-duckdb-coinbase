// Simplified Real DuckDB WASM Implementation - Direct bundle loading

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
  
  const mockDuckDB = {
    AsyncDuckDB: function() {
      return mockDB;
    }
  };
  
  console.log("✅ Mock DuckDB initialized successfully");
  return { db: mockDB, duckdb: mockDuckDB, isReal: false };
}

// Direct bundle loading approach
async function loadDuckDBBundle() {
  console.log("🦆 Loading DuckDB bundle directly...");
  
  try {
    // Try to load the DuckDB bundle using a different approach
    // Use dynamic import with proper error handling
    const bundleUrl = './static/duckdb-wasm/duckdb-browser.mjs';
    
    console.log("📦 Loading DuckDB module from:", bundleUrl);
    
    // Create a script element to load the module
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import * as duckdb from '${bundleUrl}';
      window.duckdbModule = duckdb;
      window.dispatchEvent(new CustomEvent('duckdb-module-loaded'));
    `;
    
    // Wait for module to load
    const modulePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Module loading timeout'));
      }, 10000);
      
      window.addEventListener('duckdb-module-loaded', () => {
        clearTimeout(timeout);
        resolve(window.duckdbModule);
      }, { once: true });
    });
    
    document.head.appendChild(script);
    const duckdb = await modulePromise;
    
    console.log("✅ DuckDB module loaded successfully");
    
    // Try to create database instance
    console.log("🔧 Creating DuckDB instance...");
    
    const logger = new duckdb.ConsoleLogger();
    
    // Try MVP bundle first (most compatible)
    const mvpBundle = {
      mainModule: './static/duckdb-wasm/duckdb-mvp.wasm',
      mainWorker: './static/duckdb-wasm/duckdb-browser-mvp.worker.js',
      pthreadWorker: './static/duckdb-wasm/duckdb-browser-mvp.pthread.worker.js'
    };
    
    console.log("🔧 Initializing with MVP bundle...");
    
    const worker = new Worker(mvpBundle.mainWorker);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    
    console.log("🔧 Instantiating DuckDB...");
    await db.instantiate(mvpBundle.mainModule, mvpBundle.pthreadWorker);
    
    console.log("✅ Real DuckDB initialized successfully!");
    return { db, duckdb, worker, isReal: true };
    
  } catch (error) {
    console.error("❌ DuckDB bundle loading failed:", error.message);
    throw error;
  }
}

// Main initialization function
window.initializeDuckDB = async function() {
  if (isInitialized) {
    console.log("📦 DuckDB already initialized");
    return { db: duckdbInstance, connection: connectionInstance, isReal: initializationMode === 'real' };
  }
  
  console.log("🦆 Starting simplified real DuckDB WASM initialization...");
  
  try {
    // Try to load real DuckDB
    const result = await loadDuckDBBundle();
    
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
console.log("🚀 Auto-initializing simplified real DuckDB...");
window.initializeDuckDB().catch(error => {
  console.error("❌ Failed to initialize DuckDB:", error);
  window.dispatchEvent(new CustomEvent('duckdb-error', {
    detail: { error: error.message }
  }));
});