// Simplified DuckDB initialization - Mock mode only for reliable operation

// Mock DuckDB implementation
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
  
  // Make available globally
  window.duckdbInstance = { db: mockDB, duckdb: mockDuckDB, isReal: false };
  window.duckdb = mockDuckDB;
  
  console.log("✅ Mock DuckDB initialized successfully");
  
  // Dispatch ready event
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('duckdb-ready', {
      detail: { type: 'mock', message: 'Mock DuckDB ready' }
    }));
  }, 100);
  
  return { db: mockDB, duckdb: mockDuckDB, isReal: false };
}

// Main initialization function
window.initializeDuckDB = async function() {
  console.log("🦆 Starting DuckDB initialization...");
  console.warn("⚠️ Using mock mode for reliable dashboard operation");
  return await initializeMockDuckDB();
};

// Auto-initialize when script loads
console.log("🚀 Auto-initializing DuckDB...");
window.initializeDuckDB().catch(error => {
  console.error("❌ Failed to initialize DuckDB:", error);
  window.dispatchEvent(new CustomEvent('duckdb-error', {
    detail: { error: error.message }
  }));
});