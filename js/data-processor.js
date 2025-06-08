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
  }
  
  async initialize() {
    if (this.initialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    console.log("Initializing DuckDB...");
    
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        // Wait for DuckDB WASM to be initialized
        let attempts = 0;
        const maxAttempts = 10;
        
        while (typeof duckdb === 'undefined' && attempts < maxAttempts) {
          console.log(`Waiting for DuckDB WASM to be initialized (attempt ${attempts + 1}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        // Check if duckdb is available
        if (typeof duckdb === 'undefined') {
          console.error("DuckDB is not defined. Make sure the DuckDB WASM library is properly loaded.");
          reject(new Error("DuckDB is not defined"));
          return;
        }
        
        // Create a new DuckDB instance
        const logger = null; // No logger needed
        const worker = null; // No worker needed
        
        this.db = new duckdb.AsyncDuckDB(logger, worker);
        await this.db.instantiate();
        
        // Create trades table
        const conn = await this.db.connect();
        await conn.query(`
          CREATE TABLE trades (
            price DOUBLE,
            size DOUBLE,
            side VARCHAR,
            exchange VARCHAR,
            pair VARCHAR,
            timestamp BIGINT
          )
        `);
        
        console.log("DuckDB initialized successfully");
        this.initialized = true;
        resolve();
      } catch (e) {
        console.error("Error initializing DuckDB:", e);
        reject(e);
      }
    });
    
    return this.initPromise;
  }
  
  async addData(data) {
    // Add to buffer first
    this.dataBuffer.push(data);
    
    // Trim buffer if it gets too large
    if (this.dataBuffer.length > this.bufferSize) {
      this.dataBuffer = this.dataBuffer.slice(-this.bufferSize);
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
          const values = this.dataBuffer.map(d => {
            return `(${d.data.price}, ${d.data.size}, '${d.data.side}', '${d.data.exchange}', '${d.data.pair}', ${d.timestamp})`;
          }).join(', ');
          
          const conn = await this.db.connect();
          await conn.query(`INSERT INTO trades VALUES ${values}`);
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
    return result.toArray()[0].count;
  }
  
  async getStats(timeframe) {
    await this.initialize();
    
    // Calculate time window
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = now - timeWindow;
    
    try {
      // Query for stats
      const conn = await this.db.connect();
      const result = await conn.query(`
        SELECT 
          MAX(price) AS session_high,
          MIN(price) AS session_low,
          FIRST_VALUE(price) OVER (ORDER BY timestamp) AS first_price,
          LAST_VALUE(price) OVER (ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS current_price
        FROM trades
        WHERE timestamp >= ${startTime}
      `);
      
      const stats = result.toArray()[0];
      
      // Calculate change percentage
      if (stats.first_price && stats.current_price) {
        stats.change_percent = ((stats.current_price - stats.first_price) / stats.first_price) * 100;
      } else {
        stats.change_percent = 0;
      }
      
      return stats;
    } catch (e) {
      console.error("Error getting stats:", e);
      return {
        session_high: 0,
        session_low: 0,
        first_price: 0,
        current_price: 0,
        change_percent: 0
      };
    }
  }
  
  async getPriceData(timeframe, aggregation = 'none') {
    await this.initialize();
    
    // Calculate time window
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = now - timeWindow;
    
    try {
      let query;
      
      if (aggregation === 'none') {
        // No aggregation, return all data points
        query = `
          SELECT timestamp, price
          FROM trades
          WHERE timestamp >= ${startTime}
          ORDER BY timestamp
        `;
      } else {
        // Aggregate by time interval
        const interval = parseInt(aggregation) * 1000; // Convert seconds to milliseconds
        query = `
          SELECT 
            (timestamp / ${interval}) * ${interval} AS interval_start,
            AVG(price) AS price
          FROM trades
          WHERE timestamp >= ${startTime}
          GROUP BY interval_start
          ORDER BY interval_start
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
    
    // Calculate time window
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = now - timeWindow;
    
    try {
      const query = `
        SELECT 
          side,
          SUM(size) AS volume
        FROM trades
        WHERE timestamp >= ${startTime}
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
    
    // Calculate time window
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = now - timeWindow;
    
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
          WHERE timestamp >= ${startTime}
        )
        SELECT 
          STDDEV(pct_change) AS volatility,
          AVG(ABS(pct_change)) AS avg_change
        FROM price_changes
        WHERE prev_price IS NOT NULL
      `;
      
      const conn = await this.db.connect();
      const result = await conn.query(query);
      return result.toArray()[0];
    } catch (e) {
      console.error("Error getting volatility data:", e);
      return { volatility: 0, avg_change: 0 };
    }
  }
  
  async getPriceDistribution(timeframe, bins = 10) {
    await this.initialize();
    
    // Calculate time window
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = now - timeWindow;
    
    try {
      // First get min and max price
      const rangeQuery = `
        SELECT 
          MIN(price) AS min_price,
          MAX(price) AS max_price
        FROM trades
        WHERE timestamp >= ${startTime}
      `;
      
      const conn = await this.db.connect();
      const rangeResult = await conn.query(rangeQuery);
      const { min_price, max_price } = rangeResult.toArray()[0];
      
      if (min_price === null || max_price === null) {
        return [];
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
          AND trades.timestamp >= ${startTime}
        GROUP BY bins.bin_start, bins.bin_end, bins.bin_number
        ORDER BY bins.bin_number
      `;
      
      const result = await conn.query(distributionQuery);
      return result.toArray();
    } catch (e) {
      console.error("Error getting price distribution:", e);
      return [];
    }
  }
  
  async getMovingAverages(timeframe) {
    await this.initialize();
    
    // Calculate time window
    const now = Date.now();
    const timeWindow = timeframe * 60 * 1000; // Convert minutes to milliseconds
    const startTime = now - timeWindow;
    
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
        WHERE timestamp >= ${startTime}
        ORDER BY timestamp
      `;
      
      const conn = await this.db.connect();
      const result = await conn.query(query);
      return result.toArray();
    } catch (e) {
      console.error("Error getting moving averages:", e);
      return [];
    }
  }
}