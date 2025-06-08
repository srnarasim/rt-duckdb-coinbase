/**
 * Modern DuckDB WASM Initialization
 * Based on official DuckDB WASM best practices (2024/2025)
 * 
 * This implementation follows the official documentation from:
 * https://duckdb.org/docs/stable/clients/wasm/instantiation.html
 */

// Global state
let duckdbInstance = null;
let connectionInstance = null;
let isInitialized = false;
let initializationMode = 'none';

// Configuration
const DUCKDB_CONFIG = {
  // CDN configuration
  cdnEnabled: true,
  
  // Local files configuration
  localBundles: {
    mvp: {
      mainModule: './static/duckdb-wasm/duckdb-mvp.wasm',
      mainWorker: './static/duckdb-wasm/duckdb-browser-mvp.worker.js',
      pthreadWorker: './static/duckdb-wasm/duckdb-browser-mvp.pthread.worker.js'
    },
    eh: {
      mainModule: './static/duckdb-wasm/duckdb-eh.wasm',
      mainWorker: './static/duckdb-wasm/duckdb-browser-eh.worker.js',
      pthreadWorker: './static/duckdb-wasm/duckdb-browser-eh.pthread.worker.js'
    }
  },
  
  // Logging configuration
  logLevel: 'INFO', // DEBUG, INFO, WARN, ERROR
  
  // Performance configuration
  enableThreads: false, // Set to true for experimental threading support
  maxMemory: 1024 * 1024 * 1024 // 1GB memory limit
};

/**
 * Load DuckDB module from CDN using official jsdelivr bundles
 */
async function loadDuckDBFromCDN() {
  console.log('🌐 Loading DuckDB from CDN...');
  
  try {
    // First, try to load the DuckDB module using a script tag approach
    // This avoids ES module import issues with dependencies
    const duckdbScript = document.createElement('script');
    duckdbScript.src = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser.js';
    duckdbScript.type = 'text/javascript';
    
    await new Promise((resolve, reject) => {
      duckdbScript.onload = resolve;
      duckdbScript.onerror = () => reject(new Error('Failed to load DuckDB script'));
      document.head.appendChild(duckdbScript);
    });
    
    // Access DuckDB from the global scope
    const duckdb = window.duckdb;
    if (!duckdb) {
      throw new Error('DuckDB not found in global scope');
    }
    
    console.log('✅ DuckDB module loaded from CDN');
    
    // Get the official jsdelivr bundles
    const bundles = duckdb.getJsDelivrBundles();
    console.log('📦 Available bundles:', Object.keys(bundles));
    
    // Let DuckDB select the best bundle for this browser
    const bundle = await duckdb.selectBundle(bundles);
    console.log('🎯 Selected bundle:', bundle);
    
    return { duckdb, bundle };
    
  } catch (error) {
    console.error('❌ CDN loading failed:', error);
    throw new Error(`CDN loading failed: ${error.message}`);
  }
}

/**
 * Load DuckDB module from local files
 */
async function loadDuckDBFromLocal() {
  console.log('💾 Loading DuckDB from local files...');
  
  try {
    // Try to load local DuckDB module using script tag
    const duckdbScript = document.createElement('script');
    duckdbScript.src = './static/duckdb-wasm/duckdb-browser.js';
    duckdbScript.type = 'text/javascript';
    
    await new Promise((resolve, reject) => {
      duckdbScript.onload = resolve;
      duckdbScript.onerror = () => reject(new Error('Failed to load local DuckDB script'));
      document.head.appendChild(duckdbScript);
    });
    
    // Access DuckDB from the global scope
    const duckdb = window.duckdb;
    if (!duckdb) {
      throw new Error('Local DuckDB not found in global scope');
    }
    
    console.log('✅ Local DuckDB module loaded');
    
    // Use local bundles configuration
    const bundles = DUCKDB_CONFIG.localBundles;
    
    // Let DuckDB select the best bundle for this browser
    const bundle = await duckdb.selectBundle(bundles);
    console.log('🎯 Selected local bundle:', bundle);
    
    return { duckdb, bundle };
    
  } catch (error) {
    console.error('❌ Local loading failed:', error);
    throw new Error(`Local loading failed: ${error.message}`);
  }
}

/**
 * Initialize DuckDB instance with the given module and bundle
 */
async function initializeDuckDBInstance(duckdb, bundle) {
  console.log('🔧 Initializing DuckDB instance...');
  
  try {
    // Create logger with configured level
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel[DUCKDB_CONFIG.logLevel]);
    
    // Create worker with proper blob URL handling
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    
    const worker = new Worker(workerUrl);
    
    // Create AsyncDuckDB instance
    const db = new duckdb.AsyncDuckDB(logger, worker);
    
    // Instantiate with the selected bundle
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    // Clean up the worker URL
    URL.revokeObjectURL(workerUrl);
    
    console.log('✅ DuckDB instance initialized successfully');
    
    return { db, worker, duckdb };
    
  } catch (error) {
    console.error('❌ DuckDB instantiation failed:', error);
    throw new Error(`DuckDB instantiation failed: ${error.message}`);
  }
}

/**
 * Configure DuckDB instance with optimal settings
 */
async function configureDuckDB(connection) {
  console.log('⚙️ Configuring DuckDB settings...');
  
  try {
    // Set memory limit
    await connection.query(`SET memory_limit='${Math.floor(DUCKDB_CONFIG.maxMemory / (1024 * 1024))}MB'`);
    
    // Enable/disable threading
    if (DUCKDB_CONFIG.enableThreads) {
      await connection.query('SET threads=4');
      console.log('🧵 Threading enabled');
    } else {
      await connection.query('SET threads=1');
      console.log('🧵 Single-threaded mode');
    }
    
    // Set other performance optimizations
    await connection.query('SET enable_progress_bar=false');
    await connection.query('SET enable_profiling=false');
    
    console.log('✅ DuckDB configuration completed');
    
  } catch (error) {
    console.warn('⚠️ DuckDB configuration warning:', error.message);
    // Don't fail initialization for configuration issues
  }
}

/**
 * Main DuckDB initialization function
 */
async function initializeDuckDB() {
  if (isInitialized) {
    console.log('📦 DuckDB already initialized');
    return { 
      db: duckdbInstance, 
      connection: connectionInstance, 
      isReal: initializationMode === 'real',
      mode: initializationMode
    };
  }
  
  console.log('🦆 Starting modern DuckDB WASM initialization...');
  
  let duckdb, bundle, result;
  
  try {
    // Strategy 1: Try local files first (faster, no network dependency)
    try {
      ({ duckdb, bundle } = await loadDuckDBFromLocal());
      initializationMode = 'local';
    } catch (localError) {
      console.warn('⚠️ Local loading failed, trying CDN...');
      
      // Strategy 2: Fallback to CDN
      if (DUCKDB_CONFIG.cdnEnabled) {
        ({ duckdb, bundle } = await loadDuckDBFromCDN());
        initializationMode = 'cdn';
      } else {
        throw new Error('CDN loading disabled and local loading failed');
      }
    }
    
    // Initialize DuckDB instance
    result = await initializeDuckDBInstance(duckdb, bundle);
    duckdbInstance = result.db;
    
    // Create connection
    connectionInstance = await duckdbInstance.connect();
    
    // Configure DuckDB
    await configureDuckDB(connectionInstance);
    
    isInitialized = true;
    
    // Make available globally for compatibility
    window.duckdbInstance = duckdbInstance;
    window.duckdbConnection = connectionInstance;
    window.duckdb = result.duckdb;
    window.duckdbReal = true;
    
    console.log(`✅ DuckDB initialized successfully (mode: ${initializationMode})`);
    
    // Dispatch success event
    window.dispatchEvent(new CustomEvent('duckdb-ready', {
      detail: {
        type: 'real',
        mode: initializationMode,
        db: duckdbInstance,
        connection: connectionInstance,
        duckdb: result.duckdb
      }
    }));
    
    return {
      db: duckdbInstance,
      connection: connectionInstance,
      isReal: true,
      mode: initializationMode,
      duckdb: result.duckdb
    };
    
  } catch (error) {
    console.error('❌ DuckDB initialization failed:', error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('duckdb-error', {
      detail: { 
        error: error.message,
        mode: 'failed'
      }
    }));
    
    throw error;
  }
}

/**
 * Get DuckDB version information
 */
async function getDuckDBVersion() {
  if (!connectionInstance) {
    throw new Error('DuckDB not initialized');
  }
  
  try {
    const result = await connectionInstance.query('SELECT version()');
    const version = result.toArray()[0].version;
    console.log('🦆 DuckDB version:', version);
    return version;
  } catch (error) {
    console.warn('⚠️ Could not get DuckDB version:', error.message);
    return 'unknown';
  }
}

/**
 * Cleanup function
 */
async function cleanup() {
  console.log('🧹 Cleaning up DuckDB resources...');
  
  try {
    if (connectionInstance) {
      await connectionInstance.close();
      connectionInstance = null;
    }
    
    if (duckdbInstance) {
      await duckdbInstance.close();
      duckdbInstance = null;
    }
    
    isInitialized = false;
    initializationMode = 'none';
    
    console.log('✅ DuckDB cleanup completed');
    
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

// Export functions for global access
window.initializeDuckDB = initializeDuckDB;
window.getDuckDBVersion = getDuckDBVersion;
window.cleanupDuckDB = cleanup;

// Auto-initialize when script loads
console.log('🚀 DuckDB modern initialization script loaded');

// Initialize immediately
(async function() {
  try {
    const result = await initializeDuckDB();
    console.log('🎉 Auto-initialization completed successfully');
    
    // Log version information
    try {
      await getDuckDBVersion();
    } catch (e) {
      // Version check is optional
    }
    
  } catch (error) {
    console.error('❌ Auto-initialization failed:', error);
  }
})();

// Handle page unload
window.addEventListener('beforeunload', cleanup);