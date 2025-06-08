/**
 * Real DuckDB-WASM Implementation using Official CDN Method
 * Based on: https://duckdb.org/docs/stable/clients/wasm/instantiation.html
 */

// Import DuckDB-WASM from CDN
import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm';

let globalDB = null;
let globalConnection = null;

/**
 * Initialize DuckDB-WASM using the official CDN method
 */
async function initializeDuckDB() {
  console.log("🚀 Initializing Real DuckDB-WASM...");
  
  try {
    // Get the official bundles from jsDelivr CDN
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    console.log("📦 Available bundles:", JSDELIVR_BUNDLES);
    
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
    
    // Store globally
    globalDB = db;
    globalConnection = connection;
    
    console.log("✅ Real DuckDB-WASM initialized successfully!");
    
    // Create the trades table
    await initializeTradesTable();
    
    return { db, connection };
    
  } catch (error) {
    console.error("❌ Failed to initialize Real DuckDB-WASM:", error);
    throw error;
  }
}

/**
 * Initialize the trades table with proper schema
 */
async function initializeTradesTable() {
  if (!globalConnection) {
    throw new Error("DuckDB connection not available");
  }
  
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
  
  await globalConnection.query(createTableSQL);
  console.log("✅ Trades table created successfully");
}

/**
 * Insert trade data into DuckDB
 */
async function insertTrade(trade) {
  if (!globalConnection) {
    console.warn("DuckDB connection not available, skipping trade insert");
    return;
  }
  
  try {
    const insertSQL = `
      INSERT INTO trades (id, timestamp, price, size, side, exchange, symbol)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const stmt = await globalConnection.prepare(insertSQL);
    await stmt.query([
      trade.id || Date.now(),
      new Date(trade.timestamp),
      parseFloat(trade.price),
      parseFloat(trade.size),
      trade.side,
      trade.exchange,
      trade.symbol
    ]);
    
  } catch (error) {
    console.error("Error inserting trade:", error);
  }
}

/**
 * Execute a query and return results
 */
async function executeQuery(sql) {
  if (!globalConnection) {
    throw new Error("DuckDB connection not available");
  }
  
  try {
    const result = await globalConnection.query(sql);
    return result;
  } catch (error) {
    console.error("Query execution error:", error);
    throw error;
  }
}

/**
 * Get the current connection
 */
function getConnection() {
  return globalConnection;
}

/**
 * Get the current database instance
 */
function getDatabase() {
  return globalDB;
}

// Export the functions
window.DuckDBReal = {
  initialize: initializeDuckDB,
  insertTrade,
  executeQuery,
  getConnection,
  getDatabase
};

console.log("📦 Real DuckDB-WASM module loaded");