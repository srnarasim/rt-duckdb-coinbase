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
    
    // Track price metrics directly for immediate updates
    this.priceMetrics = {
      currentPrice: 0,
      sessionHigh: 0,
      sessionLow: Infinity,
      firstPrice: 0,
      sessionStartTime: Date.now()
    };
  }
  
  async initialize() {
    console.log("🚀 Initializing dashboard...");
    
    // Initialize data processor
    await this.dataProcessor.initialize();
    
    // Initialize UI event listeners
    this.initializeEventListeners();
    
    // Initialize live data connection
    await this.initializeLiveData();
    
    // Start update loop
    this.startUpdateLoop();
    
    console.log("✅ Dashboard initialized");
  }
  
  async initializeLiveData() {
    console.log("🔌 Initializing live data connections...");
    
    // Create data connector with callback
    this.dataConnector = new DataConnector((data) => {
      this.handleLiveData(data);
    });
    
    // Connect to multiple exchanges for redundancy
    // Start with Coinbase (most reliable), add others as fallback
    this.dataConnector.connect(['coinbase']);
    
    // Add Binance after 5 seconds if we want multiple feeds
    setTimeout(() => {
      if (this.dataConnector.getConnectionInfo().connected) {
        console.log("🔌 Adding Binance as secondary data source...");
        this.dataConnector.connect(['binance']);
      }
    }, 5000);
  }
  
  handleLiveData(data) {
    try {
      // Update trade counter
      this.tradeCount++;
      this.updateTradeCounter();
      
      // Update last update time
      this.lastUpdateTime = Date.now();
      this.updateLastUpdateTime();
      
      // Update price metrics directly
      if (data.data && data.data.price) {
        const price = parseFloat(data.data.price);
        
        // Set first price if this is the first trade
        if (this.priceMetrics.firstPrice === 0) {
          this.priceMetrics.firstPrice = price;
        }
        
        // Update current price
        this.priceMetrics.currentPrice = price;
        
        // Update session high
        if (price > this.priceMetrics.sessionHigh) {
          this.priceMetrics.sessionHigh = price;
        }
        
        // Update session low
        if (price < this.priceMetrics.sessionLow) {
          this.priceMetrics.sessionLow = price;
        }
        
        // Update price display immediately
        this.updatePriceMetricsDisplay();
      }
      
      // Add data to processor
      this.dataProcessor.addData(data);
      
      // Also add to in-memory DuckDB for charts
      if (window.addTradeData) {
        window.addTradeData(data);
      }
      
      // Log trade info (throttled)
      if (this.tradeCount % 10 === 0) {
        console.log(`📊 Trade #${this.tradeCount}: ${data.data.exchange} - $${data.data.price.toFixed(2)} (${data.data.size.toFixed(4)} BTC)`);
      }
    } catch (error) {
      console.error("❌ Error handling live data:", error);
    }
  }
  
  formatPrice(price) {
    // Format price with thousands separators and 2 decimal places
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  updatePriceMetricsDisplay() {
    try {
      // Update current price
      const currentPriceElement = document.getElementById("current-price");
      if (currentPriceElement) {
        currentPriceElement.textContent = this.formatPrice(this.priceMetrics.currentPrice);
      }
      
      // Update session high
      const sessionHighElement = document.getElementById("session-high");
      if (sessionHighElement) {
        sessionHighElement.textContent = this.formatPrice(this.priceMetrics.sessionHigh);
      }
      
      // Update session low (only if we have a valid low price)
      const sessionLowElement = document.getElementById("session-low");
      if (sessionLowElement && this.priceMetrics.sessionLow !== Infinity) {
        sessionLowElement.textContent = this.formatPrice(this.priceMetrics.sessionLow);
      }
      
      // Calculate and update change percentage
      const changeElement = document.getElementById("change-percent");
      if (changeElement && this.priceMetrics.firstPrice > 0) {
        const changePercent = ((this.priceMetrics.currentPrice - this.priceMetrics.firstPrice) / this.priceMetrics.firstPrice) * 100;
        changeElement.textContent = `${changePercent.toFixed(2)}%`;
        
        // Update color based on change
        changeElement.classList.remove("positive", "negative");
        if (changePercent > 0) {
          changeElement.classList.add("positive");
        } else if (changePercent < 0) {
          changeElement.classList.add("negative");
        }
      }
    } catch (error) {
      console.error("❌ Error updating price metrics display:", error);
    }
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
      
      // Price updates are now handled in handleLiveData method
      
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
      // Note: Price metrics are now updated directly in updatePriceMetricsDisplay()
      // This method focuses on chart updates only
      
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
  
  updateTradeCounter() {
    const tradeCounterElement = document.getElementById("trade-counter");
    if (tradeCounterElement) {
      tradeCounterElement.textContent = this.tradeCount.toLocaleString();
    }
  }
  
  updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById("last-update-time");
    if (lastUpdateElement) {
      const now = new Date(this.lastUpdateTime);
      lastUpdateElement.textContent = now.toLocaleTimeString();
    }
  }
  
  generateDemoData() {
    // Generate some demo data to show that DuckDB is working
    console.log("Generating demo data...");
    
    // Simulate receiving some trade data
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const price = 30000 + Math.random() * 2000;
      const time = new Date(now - (10 - i) * 60000).toISOString();
      
      const demoData = {
        subject: "market.btc-usd.trades",
        data: {
          price: price,
          size: Math.random(),
          side: Math.random() > 0.5 ? "buy" : "sell",
          exchange: "demo",
          pair: "BTC-USD"
        },
        timestamp: now - (10 - i) * 60000
      };
      
      // Process the demo data
      this.handleData(demoData);
    }
    
    console.log("Demo data generated");
  }
}