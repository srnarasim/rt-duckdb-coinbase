/**
 * Data Processor Module
 * Uses DuckDB-WASM to process and analyze data
 */
class DataProcessor {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.initPromise = null;
    this.dataBuffer = [];
    this.bufferSize = 1000; // Maximum number of trades to keep in memory
    this.processingData = false;
    this.isRealDuckDB = false;
    this.queryManager = null;
  }
  
  async waitForDuckDB() {
    return new Promise((resolve, reject) => {
      // Check if DuckDB is already ready
      if (window.duckdbInstance) {
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
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('duckdb-ready', onReady);
        window.removeEventListener('duckdb-error', onError);
        reject(new Error("Timeout waiting for DuckDB to initialize"));
      }, 30000);
    });
  }
  
  async createSchema() {
    try {
      const conn = await this.db.connect();
      
      // Create trades table with proper schema for both real and mock DuckDB
      await conn.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER,
          timestamp TIMESTAMP,
          price DECIMAL(18,8),
          size DECIMAL(18,8),
          side VARCHAR(4),
          exchange VARCHAR(20),
          pair VARCHAR(10)
        )
      `);
      
      // Create indexes for better performance (only for real DuckDB)
      if (this.isRealDuckDB) {
        try {
          await conn.query(`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`);
          await conn.query(`CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair)`);
          console.log("📊 Created database indexes for real DuckDB");
        } catch (indexError) {
          console.warn("⚠️ Could not create indexes (not critical):", indexError.message);
        }
      }
      
      await conn.close();
      console.log("📊 Database schema created successfully");
      
    } catch (error) {
      console.error("❌ Error creating database schema:", error);
      throw error;
    }
  }
  
  async initialize() {
    if (this.initialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    console.log("Initializing DataProcessor with DuckDB...");
    
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        // Try to wait for DuckDB to be ready
        try {
          await this.waitForDuckDB();
          
          // Use the globally available DuckDB instance
          this.db = window.duckdbInstance;
          this.isRealDuckDB = window.duckdbReal || false;
          
          console.log(`📊 DataProcessor using ${this.isRealDuckDB ? 'Real' : 'Mock'} DuckDB`);
          
          // Create database schema
          await this.createSchema();
          
        } catch (duckdbError) {
          console.warn("⚠️ DuckDB initialization failed, using simulation mode:", duckdbError.message);
          
          // Fallback to simulation mode
          this.db = {
            isSimulation: true,
            query: async () => ({ toArray: () => [] }),
            connect: async () => ({
              query: async () => ({ toArray: () => [] }),
              close: () => {}
            })
          };
          this.isRealDuckDB = false;
          this.isSimulation = true;
          
          console.log("🎭 DataProcessor using simulation mode");
        }
        
        // Initialize QueryManager if we have a real DuckDB connection
        if (this.isRealDuckDB && window.duckdbConnection && window.QueryManager) {
          this.queryManager = new QueryManager(window.duckdbConnection);
          console.log("📊 QueryManager initialized");
        }
        
        console.log("✅ DataProcessor initialized successfully");
        this.initialized = true;
        resolve();
      } catch (e) {
        console.error("❌ Critical error initializing DataProcessor:", e);
        reject(e);
      }
    });
    
    return this.initPromise;
  }
  
  async insertTradeData(trades) {
    try {
      const conn = await this.db.connect();
      
      // Use string concatenation for DuckDB WASM (parameterized queries not fully supported)
      const values = trades.map(trade => {
        const timestamp = new Date(trade.timestamp).toISOString();
        const price = parseFloat(trade.data.price);
        const size = parseFloat(trade.data.size);
        const side = trade.data.side || 'unknown';
        const exchange = trade.data.exchange || 'coinbase';
        const pair = trade.data.pair || 'BTC-USD';
        
        return `('${timestamp}', ${price}, ${size}, '${side}', '${exchange}', '${pair}')`;
      }).join(', ');
      
      if (values) {
        await conn.query(`INSERT INTO trades (timestamp, price, size, side, exchange, pair) VALUES ${values}`);
      }
      
      await conn.close();
      console.log(`📊 Inserted ${trades.length} trades into ${this.isRealDuckDB ? 'Real' : 'Mock'} DuckDB`);
      
    } catch (error) {
      console.error("❌ Error inserting trade data:", error);
      throw error;
    }
  }
  
  async addData(data) {
    // Add to buffer first
    this.dataBuffer.push(data);
    
    // Trim buffer if it gets too large
    if (this.dataBuffer.length > this.bufferSize) {
      this.dataBuffer = this.dataBuffer.slice(-this.bufferSize);
    }
    
    // In simulation mode, just keep the data in memory
    if (this.isSimulation) {
      return;
    }
    
    // Process in batches to avoid too many DB operations
    if (!this.processingData) {
      this.processingData = true;
      
      try {
        await this.initialize();
        
        // Clear existing data if we have too much
        const count = await this.getTradeCount();
        if (count > this.bufferSize) {
          const conn = await this.db.connect();
          await conn.query(`DELETE FROM trades WHERE timestamp NOT IN (SELECT timestamp FROM trades ORDER BY timestamp DESC LIMIT ${this.bufferSize})`);
        }
        
        // Insert new data
        if (this.dataBuffer.length > 0) {
          await this.insertTradeData(this.dataBuffer);
          this.dataBuffer = [];
        }
      } catch (e) {
        console.error("Error adding data to DuckDB:", e);
      } finally {
        this.processingData = false;
      }
    }
  }
  
  async getTradeCount() {
    await this.initialize();
    const conn = await this.db.connect();
    const result = await conn.query(`SELECT COUNT(*) as count FROM trades`);
    const resultArray = result.toArray();
    return resultArray && resultArray.length > 0 ? resultArray[0].count : 0;
  }
  
  async getStats(timeframe) {
    await this.initialize();
    
    // Use modular query system if available
    if (this.queryManager && window.TradeStatsQueries) {
      try {
        return await this.queryManager.getTradeStats(timeframe);
      } catch (error) {
        console.warn("⚠️ Modular query failed, falling back to legacy method:", error.message);
      }
    }
    
    // Legacy fallback method
    try {
      const conn = await this.db.connect();
      let result;
      
      // Use compatible SQL for DuckDB WASM
      const now = new Date();
      const timeWindow = timeframe * 60 * 1000;
      const startTime = new Date(now.getTime() - timeWindow).toISOString();
      
      result = await conn.query(`
        SELECT 
          MAX(price) AS session_high,
          MIN(price) AS session_low,
          COUNT(*) AS trade_count,
          AVG(price) AS avg_price
        FROM trades
        WHERE timestamp >= '${startTime}'
      `);
      
      // Get first and last prices separately (FIRST/LAST functions may not be available)
      const firstResult = await conn.query(`
        SELECT price AS first_price FROM trades 
        WHERE timestamp >= '${startTime}' 
        ORDER BY timestamp ASC LIMIT 1
      `);
      
      const lastResult = await conn.query(`
        SELECT price AS current_price FROM trades 
        WHERE timestamp >= '${startTime}' 
        ORDER BY timestamp DESC LIMIT 1
      `);
      
      const resultArray = result.toArray();
      const firstResultArray = firstResult.toArray();
      const lastResultArray = lastResult.toArray();
      
      const stats = resultArray && resultArray.length > 0 ? resultArray[0] : {};
      const firstPrice = firstResultArray && firstResultArray.length > 0 ? firstResultArray[0]?.first_price || 0 : 0;
      const currentPrice = lastResultArray && lastResultArray.length > 0 ? lastResultArray[0]?.current_price || 0 : 0;
      
      stats.first_price = firstPrice;
      stats.current_price = currentPrice;
      
      result = { toArray: () => [stats] };
      

      
      const finalResultArray = result.toArray();
      const finalStats = finalResultArray && finalResultArray.length > 0 ? finalResultArray[0] : {};
      
      // Calculate change percentage
      if (finalStats.first_price && finalStats.current_price) {
        finalStats.change_percent = ((finalStats.current_price - finalStats.first_price) / finalStats.first_price) * 100;
      } else {
        finalStats.change_percent = 0;
      }
      
      await conn.close();
      return finalStats;
      
    } catch (e) {
      console.error("❌ Error getting stats:", e);
      return {
        session_high: 0,
        session_low: 0,
        first_price: 0,
        current_price: 0,
        change_percent: 0,
        trade_count: 0,
        avg_price: 0
      };
    }
  }
  
  async getPriceData(timeframe, aggregation = 'none') {
    await this.initialize();
    
    // In simulation mode, return data from buffer
    if (this.isSimulation) {
      return this.getSimulatedPriceData(timeframe, aggregation);
    }
    
    // Calculate time window
    const now = new Date();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = new Date(now.getTime() - timeWindow).toISOString();
    
    try {
      let query;
      
      if (aggregation === 'none') {
        // No aggregation, return all data points
        query = `
          SELECT timestamp, price
          FROM trades
          WHERE timestamp >= '${startTime}'
          ORDER BY timestamp
        `;
      } else {
        // Aggregate by time interval (simplified for DuckDB WASM)
        const intervalSeconds = parseInt(aggregation);
        query = `
          SELECT 
            DATE_TRUNC('second', timestamp) AS timestamp,
            AVG(price) AS price
          FROM trades
          WHERE timestamp >= '${startTime}'
          GROUP BY DATE_TRUNC('second', timestamp)
          ORDER BY timestamp
        `;
      }
      
      const conn = await this.db.connect();
      const result = await conn.query(query);
      return result.toArray();
    } catch (e) {
      console.error("Error getting price data:", e);
      return [];
    }
  }
  
  async getVolumeData(timeframe) {
    await this.initialize();
    
    // In simulation mode, return data from buffer
    if (this.isSimulation) {
      return this.getSimulatedVolumeData(timeframe);
    }
    
    // Calculate time window
    const now = new Date();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = new Date(now.getTime() - timeWindow).toISOString();
    
    try {
      const query = `
        SELECT 
          side,
          SUM(size) AS volume
        FROM trades
        WHERE timestamp >= '${startTime}'
        GROUP BY side
      `;
      
      const conn = await this.db.connect();
      const result = await conn.query(query);
      return result.toArray();
    } catch (e) {
      console.error("Error getting volume data:", e);
      return [];
    }
  }
  
  async getVolatilityData(timeframe) {
    await this.initialize();
    
    // In simulation mode, return data from buffer
    if (this.isSimulation) {
      return this.getSimulatedVolatilityData(timeframe);
    }
    
    // Calculate time window
    const now = new Date();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = new Date(now.getTime() - timeWindow).toISOString();
    
    try {
      // Calculate volatility as standard deviation of price changes
      const query = `
        WITH price_changes AS (
          SELECT 
            timestamp,
            price,
            LAG(price) OVER (ORDER BY timestamp) AS prev_price,
            (price - LAG(price) OVER (ORDER BY timestamp)) / LAG(price) OVER (ORDER BY timestamp) * 100 AS pct_change
          FROM trades
          WHERE timestamp >= '${startTime}'
        )
        SELECT 
          STDDEV(pct_change) AS volatility,
          AVG(ABS(pct_change)) AS avg_change
        FROM price_changes
        WHERE prev_price IS NOT NULL
      `;
      
      const conn = await this.db.connect();
      const result = await conn.query(query);
      const resultArray = result.toArray();
      return resultArray && resultArray.length > 0 ? resultArray[0] : { volatility: 0, avg_change: 0 };
    } catch (e) {
      console.error("Error getting volatility data:", e);
      return { volatility: 0, avg_change: 0 };
    }
  }
  
  async getPriceDistribution(timeframe, bins = 10) {
    await this.initialize();
    
    // In simulation mode, return data from buffer
    if (this.isSimulation) {
      return this.getSimulatedPriceDistribution(timeframe, bins);
    }
    
    // Calculate time window
    const now = new Date();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = new Date(now.getTime() - timeWindow).toISOString();
    
    try {
      // First get min and max price
      const rangeQuery = `
        SELECT 
          MIN(price) AS min_price,
          MAX(price) AS max_price
        FROM trades
        WHERE timestamp >= '${startTime}'
      `;
      
      const conn = await this.db.connect();
      const rangeResult = await conn.query(rangeQuery);
      const rangeArray = rangeResult.toArray();
      
      if (!rangeArray || rangeArray.length === 0 || !rangeArray[0]) {
        console.log("No data available for price distribution, falling back to simulation");
        return this.getSimulatedPriceDistribution(bins);
      }
      
      const { min_price, max_price } = rangeArray[0];
      
      if (min_price === null || max_price === null || min_price === undefined || max_price === undefined) {
        console.log("Price range is null/undefined, falling back to simulation");
        return this.getSimulatedPriceDistribution(bins);
      }
      
      // Calculate bin width
      const binWidth = (max_price - min_price) / bins;
      
      // Create bins and count trades in each bin
      const distributionQuery = `
        WITH bins AS (
          SELECT 
            ${min_price} + (${binWidth} * bin_number) AS bin_start,
            ${min_price} + (${binWidth} * (bin_number + 1)) AS bin_end,
            bin_number
          FROM (
            SELECT ROW_NUMBER() OVER () - 1 AS bin_number
            FROM trades
            LIMIT ${bins}
          )
        )
        SELECT 
          bins.bin_start,
          bins.bin_end,
          COUNT(trades.price) AS count
        FROM bins
        LEFT JOIN trades ON trades.price >= bins.bin_start AND trades.price < bins.bin_end
          AND trades.timestamp >= '${startTime}'
        GROUP BY bins.bin_start, bins.bin_end, bins.bin_number
        ORDER BY bins.bin_number
      `;
      
      const result = await conn.query(distributionQuery);
      return result.toArray();
    } catch (e) {
      console.error("Error getting price distribution:", e);
      console.log("Falling back to simulated price distribution");
      return this.getSimulatedPriceDistribution(bins);
    }
  }
  
  async getMovingAverages(timeframe) {
    await this.initialize();
    
    // In simulation mode, return data from buffer
    if (this.isSimulation) {
      return this.getSimulatedMovingAverages(timeframe);
    }
    
    // Calculate time window
    const now = new Date();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = new Date(now.getTime() - timeWindow).toISOString();
    
    try {
      // Calculate moving averages with window functions
      const query = `
        SELECT 
          timestamp,
          price,
          AVG(price) OVER (
            ORDER BY timestamp
            ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
          ) AS ma_10,
          AVG(price) OVER (
            ORDER BY timestamp
            ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
          ) AS ma_20,
          AVG(price) OVER (
            ORDER BY timestamp
            ROWS BETWEEN 49 PRECEDING AND CURRENT ROW
          ) AS ma_50
        FROM trades
        WHERE timestamp >= '${startTime}'
        ORDER BY timestamp
      `;
      
      const conn = await this.db.connect();
      const result = await conn.query(query);
      return result.toArray();
    } catch (e) {
      console.error("Error getting moving averages:", e);
      console.log("Falling back to simulated moving averages");
      return this.getSimulatedMovingAverages();
    }
  }
  
  getSimulatedPriceData(timeframe, aggregation = 'none') {
    // Return data from buffer for simulation mode
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000;
    const startTime = now - timeWindow;
    
    // Filter buffer data by timeframe
    const filteredData = this.dataBuffer
      .filter(item => item.timestamp >= startTime)
      .map(item => ({
        timestamp: item.timestamp,
        price: item.data.price
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return filteredData;
  }
  
  /**
   * Generate simulated price distribution for fallback
   */
  getSimulatedPriceDistribution(bins = 10) {
    // Generate a realistic Bitcoin price distribution
    const basePrice = 95000; // Current BTC price range
    const priceRange = 2000; // $2000 range
    const minPrice = basePrice - priceRange / 2;
    const maxPrice = basePrice + priceRange / 2;
    const binWidth = (maxPrice - minPrice) / bins;
    
    const distribution = [];
    
    for (let i = 0; i < bins; i++) {
      const binStart = minPrice + (i * binWidth);
      const binEnd = binStart + binWidth;
      const binCenter = (binStart + binEnd) / 2;
      
      // Create a normal distribution-like pattern
      const distanceFromCenter = Math.abs(binCenter - basePrice);
      const normalizedDistance = distanceFromCenter / (priceRange / 2);
      const frequency = Math.max(1, Math.round(50 * Math.exp(-2 * normalizedDistance * normalizedDistance)));
      
      distribution.push({
        bin_start: binStart,
        bin_end: binEnd,
        bin_number: i,
        frequency: frequency
      });
    }
    
    return distribution;
  }
  
  /**
   * Generate simulated moving averages for fallback
   */
  getSimulatedMovingAverages() {
    const now = Date.now();
    const basePrice = 95000;
    const data = [];
    
    // Generate 50 data points over the last hour
    for (let i = 0; i < 50; i++) {
      const timestamp = now - (50 - i) * 60000; // 1 minute intervals
      const price = basePrice + Math.sin(i * 0.1) * 500 + Math.random() * 200 - 100;
      
      // Calculate simple moving averages
      const ma_10 = price + Math.random() * 50 - 25;
      const ma_20 = price + Math.random() * 100 - 50;
      const ma_50 = price + Math.random() * 150 - 75;
      
      data.push({
        timestamp,
        price,
        ma_10,
        ma_20,
        ma_50
      });
    }
    
    return data;
  }
  
  /**
   * Generate simulated volume data for fallback
   */
  getSimulatedVolumeData(timeframe) {
    console.log("🔍 getSimulatedVolumeData called with timeframe:", timeframe, "buffer size:", this.dataBuffer.length);
    
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000;
    const startTime = now - timeWindow;
    
    // Filter buffer data by timeframe
    const filteredData = this.dataBuffer
      .filter(item => item.timestamp >= startTime)
      .map(item => ({
        timestamp: item.timestamp,
        volume: item.data.size || Math.random() * 0.5,
        price: item.data.price
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log("📊 Volume data returned:", filteredData.length, "items");
    return filteredData;
  }
  
  /**
   * Generate simulated volatility data for fallback
   */
  getSimulatedVolatilityData(timeframe) {
    console.log("🔍 getSimulatedVolatilityData called with timeframe:", timeframe);
    
    const priceData = this.getSimulatedPriceData(timeframe);
    
    console.log("📊 Price data for volatility:", priceData.length, "items");
    
    if (priceData.length < 2) {
      console.log("⚠️ Not enough price data for volatility calculation");
      return [];
    }
    
    // Calculate price changes
    const changes = [];
    for (let i = 1; i < priceData.length; i++) {
      const change = (priceData[i].price - priceData[i-1].price) / priceData[i-1].price;
      changes.push(change);
    }
    
    // Calculate volatility (standard deviation of returns)
    const mean = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const variance = changes.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / changes.length;
    const volatility = Math.sqrt(variance) * 100; // Convert to percentage
    
    const result = [{
      timestamp: Date.now(),
      volatility: volatility
    }];
    
    console.log("📊 Volatility result:", result);
    return result;
  }
  
  /**
   * Generate simulated price distribution with timeframe support
   */
  getSimulatedPriceDistribution(timeframe, bins = 10) {
    console.log("🔍 getSimulatedPriceDistribution called with timeframe:", timeframe, "bins:", bins);
    
    const priceData = this.getSimulatedPriceData(timeframe);
    
    console.log("📊 Price data for distribution:", priceData.length, "items");
    
    if (priceData.length === 0) {
      console.log("⚠️ No price data, using fallback distribution");
      return this.getSimulatedPriceDistribution(bins); // Fallback to original method
    }
    
    const prices = priceData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const binWidth = (maxPrice - minPrice) / bins;
    
    const distribution = [];
    
    for (let i = 0; i < bins; i++) {
      const binStart = minPrice + (i * binWidth);
      const binEnd = binStart + binWidth;
      
      // Count prices in this bin
      const frequency = prices.filter(price => 
        price >= binStart && (i === bins - 1 ? price <= binEnd : price < binEnd)
      ).length;
      
      distribution.push({
        bin_start: binStart,
        bin_end: binEnd,
        bin_number: i,
        frequency: frequency
      });
    }
    
    return distribution;
  }
  
  /**
   * Generate simulated moving averages with timeframe support
   */
  getSimulatedMovingAverages(timeframe) {
    const priceData = this.getSimulatedPriceData(timeframe);
    
    if (priceData.length === 0) {
      return this.getSimulatedMovingAverages(); // Fallback to original method
    }
    
    const data = [];
    
    for (let i = 0; i < priceData.length; i++) {
      const item = priceData[i];
      
      // Calculate moving averages (simple approximation)
      const ma_10 = i >= 9 ? 
        priceData.slice(Math.max(0, i - 9), i + 1).reduce((sum, d) => sum + d.price, 0) / Math.min(10, i + 1) :
        item.price;
        
      const ma_20 = i >= 19 ? 
        priceData.slice(Math.max(0, i - 19), i + 1).reduce((sum, d) => sum + d.price, 0) / Math.min(20, i + 1) :
        item.price;
        
      const ma_50 = i >= 49 ? 
        priceData.slice(Math.max(0, i - 49), i + 1).reduce((sum, d) => sum + d.price, 0) / Math.min(50, i + 1) :
        item.price;
      
      data.push({
        timestamp: item.timestamp,
        price: item.price,
        ma_10,
        ma_20,
        ma_50
      });
    }
    
    return data;
  }
}