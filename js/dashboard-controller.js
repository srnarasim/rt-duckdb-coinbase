/**
 * Dashboard Controller Module
 * Manages user interactions and updates
 */
class DashboardController {
  constructor() {
    this.dataProcessor = new DataProcessor();
    this.charts = {
      price: new ChartRenderer("price-chart"),
      volatility: new ChartRenderer("volatility-chart"),
      distribution: new ChartRenderer("distribution-chart"),
      movingAverages: new ChartRenderer("moving-averages-chart"),
      volumeProfile: new ChartRenderer("volume-profile-chart"),
      heatmap: new ChartRenderer("heatmap-chart")
    };
    
    this.timeframe = 5; // Default 5 minutes
    this.aggregation = 'none'; // Default no aggregation
    this.paused = false;
    this.updateInterval = null;
    this.lastUpdateTime = 0;
    this.updateFrequency = 1000; // Update every second
    this.tradeCount = 0;
  }
  
  async initialize() {
    console.log("Initializing dashboard...");
    
    // Initialize data processor
    await this.dataProcessor.initialize();
    
    // Initialize UI event listeners
    this.initializeEventListeners();
    
    // Connect to WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = 3030; // Default WebSocket port
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
    
    this.connector = new DataConnector(wsUrl, (data) => this.handleData(data));
    this.connector.connect();
    
    // Start update loop
    this.startUpdateLoop();
    
    console.log("Dashboard initialized");
  }
  
  initializeEventListeners() {
    // Timeframe selector
    const timeframeSelect = document.getElementById("timeframe-select");
    if (timeframeSelect) {
      timeframeSelect.addEventListener("change", (e) => {
        this.timeframe = parseInt(e.target.value);
        this.updateCharts();
      });
    }
    
    // Aggregation selector
    const aggregationSelect = document.getElementById("aggregation-select");
    if (aggregationSelect) {
      aggregationSelect.addEventListener("change", (e) => {
        this.aggregation = e.target.value;
        this.updateCharts();
      });
    }
    
    // Pause button
    const pauseButton = document.getElementById("pause-button");
    if (pauseButton) {
      pauseButton.addEventListener("click", () => {
        this.paused = !this.paused;
        pauseButton.textContent = this.paused ? "Resume" : "Pause";
        pauseButton.classList.toggle("paused", this.paused);
        
        if (!this.paused) {
          this.updateCharts();
        }
      });
    }
    
    // Reset zoom button
    const resetZoomButton = document.getElementById("reset-zoom-button");
    if (resetZoomButton) {
      resetZoomButton.addEventListener("click", () => {
        this.updateCharts();
      });
    }
    
    // Handle window resize
    window.addEventListener("resize", () => {
      this.updateCharts();
    });
  }
  
  async handleData(data) {
    if (this.paused) return;
    
    try {
      await this.dataProcessor.addData(data);
      this.tradeCount++;
      
      // Update trade counter
      const tradeCounter = document.getElementById("trade-counter");
      if (tradeCounter) {
        tradeCounter.textContent = this.tradeCount;
      }
      
      // Update last price immediately
      if (data.data && data.data.price) {
        const currentPrice = document.getElementById("current-price");
        if (currentPrice) {
          currentPrice.textContent = `$${data.data.price.toFixed(2)}`;
        }
      }
      
      // Throttle chart updates to avoid performance issues
      const now = Date.now();
      if (now - this.lastUpdateTime > this.updateFrequency) {
        this.updateCharts();
        this.lastUpdateTime = now;
      }
    } catch (e) {
      console.error("Error handling data:", e);
    }
  }
  
  async updateCharts() {
    if (this.paused) return;
    
    try {
      // Update stats
      const stats = await this.dataProcessor.getStats(this.timeframe);
      
      // Update UI with stats
      document.getElementById("current-price").textContent = `$${stats.current_price ? stats.current_price.toFixed(2) : '0.00'}`;
      document.getElementById("session-high").textContent = `$${stats.session_high ? stats.session_high.toFixed(2) : '0.00'}`;
      document.getElementById("session-low").textContent = `$${stats.session_low ? stats.session_low.toFixed(2) : '0.00'}`;
      
      const changeElement = document.getElementById("change-percent");
      if (changeElement) {
        const changePercent = stats.change_percent || 0;
        changeElement.textContent = `${changePercent.toFixed(2)}%`;
        changeElement.classList.remove("positive", "negative");
        if (changePercent > 0) {
          changeElement.classList.add("positive");
        } else if (changePercent < 0) {
          changeElement.classList.add("negative");
        }
      }
      
      // Get data for charts
      const priceData = await this.dataProcessor.getPriceData(this.timeframe, this.aggregation);
      const volatilityData = await this.dataProcessor.getVolatilityData(this.timeframe);
      const distributionData = await this.dataProcessor.getPriceDistribution(this.timeframe);
      const movingAveragesData = await this.dataProcessor.getMovingAverages(this.timeframe);
      const volumeData = await this.dataProcessor.getVolumeData(this.timeframe);
      
      // Update charts
      this.charts.price.renderPriceChart(priceData);
      this.charts.volatility.renderVolatilityChart(priceData, volatilityData);
      this.charts.distribution.renderDistributionChart(distributionData);
      this.charts.movingAverages.renderMovingAveragesChart(movingAveragesData);
      this.charts.volumeProfile.renderVolumeProfileChart(priceData, volumeData);
      this.charts.heatmap.renderHeatmapChart(priceData);
      
      // Update last update time
      const lastUpdateElement = document.getElementById("last-update-time");
      if (lastUpdateElement) {
        const now = new Date();
        lastUpdateElement.textContent = now.toLocaleTimeString();
      }
    } catch (e) {
      console.error("Error updating charts:", e);
    }
  }
  
  startUpdateLoop() {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Set up new interval
    this.updateInterval = setInterval(() => {
      if (!this.paused) {
        this.updateCharts();
      }
    }, 5000); // Update every 5 seconds
  }
  
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}