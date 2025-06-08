/**
 * DuckDB-WASM Mock Implementation
 * This file provides a mock implementation of DuckDB-WASM for use in the browser.
 * It simulates the DuckDB API without requiring the actual WebAssembly module.
 */

// Global duckdb object that mimics the real DuckDB-WASM API
window.duckdb = {
  // Select a bundle based on browser capabilities
  selectBundle: async function(bundles) {
    console.log("DuckDB: Selecting bundle", bundles);
    return {
      mainModule: "local-duckdb-browser.js",
      mainWorker: "local-duckdb-browser-worker.js",
      pthreadWorker: "local-duckdb-browser-pthread.worker.js"
    };
  },
  
  // Logger implementation
  ConsoleLogger: class ConsoleLogger {
    constructor() {}
    
    log(level, message) {
      console.log(`[DuckDB ${level}]`, message);
    }
  },
  
  // AsyncDuckDB implementation
  AsyncDuckDB: class AsyncDuckDB {
    constructor(logger, worker) {
      this.logger = logger;
      this.worker = worker;
      this.tables = {};
      this.views = {};
      this.data = [];
    }
    
    async instantiate(mainModule, pthreadWorker) {
      console.log("DuckDB: Instantiating with", mainModule, pthreadWorker);
      return this;
    }
    
    async connect() {
      console.log("DuckDB: Connected");
      
      return {
        query: async (sql) => {
          console.log("DuckDB: Executing SQL:", sql);
          
          // Handle CREATE TABLE
          if (sql.includes("CREATE TABLE")) {
            const tableName = sql.match(/CREATE TABLE\s+(\w+)/i)[1];
            this.tables[tableName] = [];
            return { success: true };
          }
          
          // Handle CREATE VIEW
          if (sql.includes("CREATE VIEW")) {
            const viewName = sql.match(/CREATE VIEW\s+(\w+)/i)[1];
            this.views[viewName] = { sql };
            return { success: true };
          }
          
          // Handle INSERT
          if (sql.includes("INSERT")) {
            return { success: true };
          }
          
          // Handle SELECT
          if (sql.includes("SELECT")) {
            // Generate mock data for the chart
            const mockData = [];
            const now = Date.now();
            
            // Create more realistic data with price trends
            let price = 30000 + Math.random() * 2000;
            
            for (let i = 0; i < 100; i++) {
              // Add some randomness to the price
              price = price + (Math.random() - 0.5) * 100;
              
              // Create a time point in the past
              const time = new Date(now - (100 - i) * 60000).toISOString();
              
              // Add moving averages and other analytics
              const dataPoint = {
                price,
                time,
                source: "Simulated Data",
                subject: "market.btc-usd.trades",
                moving_avg_5: price + (Math.random() - 0.5) * 20,
                prev_price: price - (Math.random() - 0.5) * 50,
                pct_change: (Math.random() - 0.5) * 1.0
              };
              
              mockData.push(dataPoint);
            }
            
            return {
              toArray: () => mockData
            };
          }
          
          return { success: true };
        },
        
        insertValues: async (table, values) => {
          console.log("DuckDB: Inserting values into", table, values);
          
          if (!this.tables[table]) {
            this.tables[table] = [];
          }
          
          this.tables[table].push(...values);
          this.data.push(...values.map(v => ({
            price: v[0],
            time: v[1],
            source: v[2],
            subject: v[3]
          })));
          
          return { success: true };
        }
      };
    }
  }
};