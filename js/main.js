/**
 * Main entry point for the dashboard application
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Initializing BTC-USD Analytics Dashboard...");
  
  try {
    // Show loading indicator
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.display = "flex";
    }
    
    // Initialize the dashboard
    const dashboard = new DashboardController();
    await dashboard.initialize();
    
    // Hide loading indicator
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
    
    console.log("Dashboard initialization complete");
  } catch (e) {
    console.error("Error initializing dashboard:", e);
    
    // Show error message
    const errorMessage = document.getElementById("error-message");
    if (errorMessage) {
      errorMessage.textContent = `Error initializing dashboard: ${e.message}`;
      errorMessage.style.display = "block";
    }
    
    // Hide loading indicator
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
  }
});