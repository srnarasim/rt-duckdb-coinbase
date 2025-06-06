// DuckDB-WASM initialization
export default async function initDuckDB(mainModule, pthreadWorker) {
  // This is a wrapper around the DuckDB-WASM initialization
  // It allows us to load DuckDB-WASM from a CDN
  return {
    AsyncDuckDB: class AsyncDuckDB {
      async instantiate() {
        console.log("DuckDB-WASM instantiated");
        return this;
      }
      
      async connect() {
        console.log("Connected to DuckDB");
        return {
          query: async (sql) => {
            console.log("Executing SQL:", sql);
            if (sql.includes("CREATE TABLE")) {
              return { success: true };
            }
            if (sql.includes("INSERT")) {
              return { success: true };
            }
            if (sql.includes("SELECT")) {
              // Mock data for the chart
              const mockData = [];
              const now = new Date();
              for (let i = 0; i < 20; i++) {
                const time = new Date(now.getTime() - (20 - i) * 60000).toISOString();
                const price = 30000 + Math.random() * 1000;
                mockData.push({ time, price });
              }
              return {
                toArray: () => mockData
              };
            }
            return { success: true };
          },
          insertValues: async (table, values) => {
            console.log("Inserting values into", table, values);
            return { success: true };
          }
        };
      }
    }
  };
}

// Helper functions for loading DuckDB-WASM from CDN
initDuckDB.getJsDelivrBundles = async function() {
  return [{
    mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.24.0/dist/duckdb-browser.mjs',
    pthreadWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.24.0/dist/duckdb-browser-pthread.worker.js'
  }];
};

initDuckDB.selectBundle = async function(bundles) {
  return bundles[0];
};