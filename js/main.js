/**
 * Main entry point for the dashboard application
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Initializing BTC-USD Analytics Dashboard...");
  
  try {
    // Show loading indicator
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.display = "flex";
    }
    
    // Wait for DuckDB to be ready (either real or mock)
    await waitForDuckDBReady();
    
    // Initialize the dashboard
    const dashboard = new DashboardController();
    await dashboard.initialize();
    
    // Hide loading indicator
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
    
    console.log("✅ Dashboard initialization complete");
  } catch (e) {
    console.error("❌ Error initializing dashboard:", e);
    
    // Show error message but continue with simulation
    const errorMessage = document.getElementById("error-message");
    if (errorMessage) {
      errorMessage.textContent = `DuckDB failed - Starting simulation mode: ${e.message}`;
      errorMessage.style.display = "block";
    }
    
    // Hide loading indicator
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
    
    // Start simulation mode as fallback
    console.log("🎭 Starting simulation mode as fallback...");
    try {
      await startSimulationMode();
    } catch (simError) {
      console.error("❌ Failed to start simulation mode:", simError);
      if (errorMessage) {
        errorMessage.textContent = `Complete initialization failure: ${e.message}`;
      }
    }
  }
});

/**
 * Wait for DuckDB to be ready (either real or mock)
 */
function waitForDuckDBReady() {
  return new Promise((resolve, reject) => {
    // Check if DuckDB is already ready
    if (window.duckdbInstance || window.duckdb) {
      console.log("📦 DuckDB already ready");
      resolve();
      return;
    }
    
    // Listen for DuckDB ready event
    const onReady = (event) => {
      console.log("📦 DuckDB ready event received:", event.detail);
      window.removeEventListener('duckdb-ready', onReady);
      window.removeEventListener('duckdb-error', onError);
      resolve();
    };
    
    const onError = (event) => {
      console.error("❌ DuckDB error event received:", event.detail);
      window.removeEventListener('duckdb-ready', onReady);
      window.removeEventListener('duckdb-error', onError);
      reject(new Error(event.detail.error));
    };
    
    window.addEventListener('duckdb-ready', onReady);
    window.addEventListener('duckdb-error', onError);
    
    // Timeout after 8 seconds (faster fallback to mock mode)
    setTimeout(() => {
      window.removeEventListener('duckdb-ready', onReady);
      window.removeEventListener('duckdb-error', onError);
      reject(new Error("Timeout waiting for DuckDB to initialize"));
    }, 8000);
  });
}

/**
 * Start simulation mode as fallback when DuckDB fails
 */
async function startSimulationMode() {
  console.log("🎭 Initializing simulation mode...");
  
  // Create a simple mock DuckDB for simulation
  window.duckdb = {
    isReal: false,
    isSimulation: true
  };
  
  window.duckdbInstance = {
    isReal: false,
    isSimulation: true,
    query: async (sql) => {
      // Return empty results for simulation
      return { toArray: () => [] };
    }
  };
  
  // Initialize dashboard with simulation
  const dashboard = new DashboardController();
  await dashboard.initialize();
  
  // Update connection status
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = 'Simulation Mode';
    statusElement.className = 'connection-status simulation';
  }
  
  console.log("✅ Simulation mode initialized successfully");
}