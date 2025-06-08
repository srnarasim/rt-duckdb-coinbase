/**
 * Simple DuckDB WASM Initialization
 * Bypasses Apache Arrow issues by using in-memory data processing
 */

let duckdbInstance = null;
let connectionInstance = null;
let isInitialized = false;
let initializationMode = 'memory';

// In-memory data store for chart data
let tradeDataBuffer = [];
const MAX_BUFFER_SIZE = 1000;

// Simple in-memory database that provides chart data
function createMemoryDuckDB() {
  console.log("🧠 Creating in-memory data processor...");
  
  const memoryConnection = {
    async query(sql, params = []) {
      console.log("🧠 Memory query:", sql.substring(0, 50) + "...");
      
      // Handle different query types
      if (sql.includes('COUNT(*)')) {
        return {
          toArray: () => [{ count: tradeDataBuffer.length }],
          numRows: 1,
          numCols: 1
        };
      }
      
      if (sql.includes('MAX(price)') || sql.includes('MIN(price)')) {
        const prices = tradeDataBuffer.map(t => t.price).filter(p => p > 0);
        if (prices.length === 0) {
          return { toArray: () => [], numRows: 0, numCols: 0 };
        }
        
        const result = {
          session_high: Math.max(...prices),
          session_low: Math.min(...prices),
          current_price: prices[prices.length - 1] || 0,
          first_price: prices[0] || 0,
          trade_count: prices.length,
          avg_price: prices.reduce((a, b) => a + b, 0) / prices.length
        };
        
        return {
          toArray: () => [result],
          numRows: 1,
          numCols: Object.keys(result).length
        };
      }
      
      if (sql.includes('SELECT timestamp, price')) {
        // Return price data for charts
        const priceData = tradeDataBuffer
          .filter(t => t.timestamp && t.price)
          .map(t => ({
            timestamp: t.timestamp,
            price: t.price
          }))
          .slice(-100); // Last 100 points for performance
        
        return {
          toArray: () => priceData,
          numRows: priceData.length,
          numCols: 2
        };
      }
      
      if (sql.includes('SELECT timestamp, size') || sql.includes('volume')) {
        // Return volume data for charts
        const volumeData = tradeDataBuffer
          .filter(t => t.timestamp && t.size)
          .map(t => ({
            timestamp: t.timestamp,
            volume: t.size,
            price: t.price
          }))
          .slice(-100);
        
        return {
          toArray: () => volumeData,
          numRows: volumeData.length,
          numCols: 3
        };
      }
      
      if (sql.includes('volatility') || sql.includes('STDDEV')) {
        // Calculate simple volatility from price changes
        const prices = tradeDataBuffer.map(t => t.price).filter(p => p > 0);
        if (prices.length < 2) {
          return { toArray: () => [], numRows: 0, numCols: 0 };
        }
        
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
          changes.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const volatility = Math.sqrt(changes.reduce((sum, change) => sum + change * change, 0) / changes.length);
        
        return {
          toArray: () => [{ volatility: volatility * 100 }], // Convert to percentage
          numRows: 1,
          numCols: 1
        };
      }
      
      // Default empty result
      return {
        toArray: () => [],
        numRows: 0,
        numCols: 0
      };
    },
    
    async close() {
      console.log("🧠 Memory connection closed");
    }
  };
  
  const memoryDB = {
    async connect() {
      return memoryConnection;
    },
    
    async close() {
      console.log("🧠 Memory database closed");
    },
    
    // Add method to insert data
    addTradeData(data) {
      if (data && data.data && data.data.price) {
        tradeDataBuffer.push({
          timestamp: data.timestamp || Date.now(),
          price: parseFloat(data.data.price),
          size: parseFloat(data.data.size || 0),
          side: data.data.side || 'unknown',
          exchange: data.data.exchange || 'coinbase',
          pair: data.data.pair || 'BTC-USD'
        });
        
        // Keep buffer size manageable
        if (tradeDataBuffer.length > MAX_BUFFER_SIZE) {
          tradeDataBuffer = tradeDataBuffer.slice(-MAX_BUFFER_SIZE);
        }
      }
    },
    
    getTradeData() {
      return tradeDataBuffer;
    }
  };
  
  return { db: memoryDB, isReal: false };
}

// Main initialization function
window.initializeDuckDB = async function() {
  if (isInitialized) {
    console.log("📦 DuckDB already initialized");
    return { db: duckdbInstance, connection: connectionInstance, isReal: false };
  }
  
  console.log("🧠 Starting simple in-memory DuckDB initialization...");
  
  try {
    // Use in-memory solution directly
    const result = createMemoryDuckDB();
    duckdbInstance = result.db;
    connectionInstance = await duckdbInstance.connect();
    initializationMode = 'memory';
    isInitialized = true;
    
    console.log("✅ In-memory DuckDB initialized successfully!");
    
    // Dispatch success event
    window.dispatchEvent(new CustomEvent('duckdb-ready', {
      detail: { 
        type: 'memory',
        db: duckdbInstance,
        connection: connectionInstance
      }
    }));
    
    return { db: duckdbInstance, connection: connectionInstance, isReal: false };
    
  } catch (error) {
    console.error("❌ Memory DuckDB initialization failed:", error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('duckdb-error', {
      detail: { error: error.message }
    }));
    
    throw error;
  }
};

// Expose method to add trade data
window.addTradeData = function(data) {
  if (duckdbInstance && duckdbInstance.addTradeData) {
    duckdbInstance.addTradeData(data);
  }
};

// Auto-initialize when script loads
console.log("🧠 DuckDB simple initialization script loaded");

// Initialize immediately when script loads
(async function() {
  try {
    await window.initializeDuckDB();
    console.log("🚀 Auto-initialization completed successfully");
  } catch (error) {
    console.error("❌ Auto-initialization failed:", error);
  }
})();