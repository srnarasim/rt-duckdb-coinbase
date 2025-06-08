/**
 * Query Manager
 * Centralized query execution and management system
 */

class QueryManager {
  constructor(duckdbConnection) {
    this.connection = duckdbConnection;
    this.queryCache = new Map();
    this.queryStats = {
      totalQueries: 0,
      totalExecutionTime: 0,
      errorCount: 0
    };
  }

  /**
   * Execute a single query with error handling and timing
   * @param {string} query - SQL query string
   * @param {string} queryName - Name for logging/debugging
   * @returns {Promise<Array>} Query results
   */
  async executeQuery(query, queryName = 'unnamed') {
    const startTime = performance.now();
    
    try {
      console.log(`🔍 Executing query: ${queryName}`);
      console.log(`📝 SQL: ${query.trim()}`);
      
      const result = await this.connection.query(query);
      const data = result.toArray();
      
      const executionTime = performance.now() - startTime;
      this.queryStats.totalQueries++;
      this.queryStats.totalExecutionTime += executionTime;
      
      console.log(`✅ Query "${queryName}" completed in ${executionTime.toFixed(2)}ms, returned ${data.length} rows`);
      
      return data;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.queryStats.errorCount++;
      
      console.error(`❌ Query "${queryName}" failed after ${executionTime.toFixed(2)}ms:`, error);
      console.error(`📝 Failed SQL: ${query.trim()}`);
      
      throw new Error(`Query "${queryName}" failed: ${error.message}`);
    }
  }

  /**
   * Execute multiple queries in sequence
   * @param {Array} queries - Array of {query, name} objects
   * @returns {Promise<Object>} Results keyed by query name
   */
  async executeQueries(queries) {
    const results = {};
    
    for (const {query, name} of queries) {
      try {
        results[name] = await this.executeQuery(query, name);
      } catch (error) {
        console.error(`Failed to execute query "${name}":`, error);
        results[name] = null;
      }
    }
    
    return results;
  }

  /**
   * Execute queries in parallel (use with caution)
   * @param {Array} queries - Array of {query, name} objects
   * @returns {Promise<Object>} Results keyed by query name
   */
  async executeQueriesParallel(queries) {
    const promises = queries.map(async ({query, name}) => {
      try {
        const result = await this.executeQuery(query, name);
        return {name, result, error: null};
      } catch (error) {
        return {name, result: null, error};
      }
    });

    const results = {};
    const outcomes = await Promise.all(promises);
    
    for (const {name, result, error} of outcomes) {
      if (error) {
        console.error(`Parallel query "${name}" failed:`, error);
      }
      results[name] = result;
    }
    
    return results;
  }

  /**
   * Get trade statistics using modular queries
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @returns {Promise<Object>} Trade statistics
   */
  async getTradeStats(timeframeMinutes) {
    if (!window.TradeStatsQueries) {
      throw new Error('TradeStatsQueries module not loaded');
    }

    if (!TradeStatsQueries.validateTimeframe(timeframeMinutes)) {
      throw new Error('Invalid timeframe for trade stats');
    }

    const config = TradeStatsQueries.getComprehensiveStats(timeframeMinutes);
    
    const queries = [
      {query: config.queries.main, name: 'main_stats'},
      {query: config.queries.first, name: 'first_price'},
      {query: config.queries.current, name: 'current_price'}
    ];

    const results = await this.executeQueries(queries);
    
    // Combine results
    const mainStats = results.main_stats?.[0] || {};
    const firstPrice = results.first_price?.[0]?.first_price || 0;
    const currentPrice = results.current_price?.[0]?.current_price || 0;

    const finalStats = {
      ...mainStats,
      first_price: firstPrice,
      current_price: currentPrice
    };

    // Calculate change percentage
    if (finalStats.first_price && finalStats.current_price) {
      finalStats.change_percent = ((finalStats.current_price - finalStats.first_price) / finalStats.first_price) * 100;
    } else {
      finalStats.change_percent = 0;
    }

    return finalStats;
  }

  /**
   * Get price data using modular queries
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} aggregation - Aggregation type
   * @returns {Promise<Array>} Price data
   */
  async getPriceData(timeframeMinutes, aggregation = 'none') {
    if (!window.PriceDataQueries) {
      throw new Error('PriceDataQueries module not loaded');
    }

    if (!PriceDataQueries.validateParams(timeframeMinutes, aggregation)) {
      throw new Error('Invalid parameters for price data');
    }

    const config = PriceDataQueries.getPriceDataConfig(timeframeMinutes, aggregation);
    return await this.executeQuery(config.query, `price_data_${config.queryType}`);
  }

  /**
   * Get volume analysis using modular queries
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} analysisType - Type of volume analysis
   * @returns {Promise<Array>} Volume analysis results
   */
  async getVolumeAnalysis(timeframeMinutes, analysisType = 'by_side') {
    if (!window.VolumeAnalysisQueries) {
      throw new Error('VolumeAnalysisQueries module not loaded');
    }

    if (!VolumeAnalysisQueries.validateParams(timeframeMinutes, analysisType)) {
      throw new Error('Invalid parameters for volume analysis');
    }

    const config = VolumeAnalysisQueries.getVolumeAnalysisConfig(timeframeMinutes, analysisType);
    return await this.executeQuery(config.query, `volume_${analysisType}`);
  }

  /**
   * Get volatility analysis using modular queries
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} analysisType - Type of volatility analysis
   * @returns {Promise<Object|Array>} Volatility analysis results
   */
  async getVolatilityAnalysis(timeframeMinutes, analysisType = 'basic') {
    if (!window.VolatilityAnalysisQueries) {
      throw new Error('VolatilityAnalysisQueries module not loaded');
    }

    if (!VolatilityAnalysisQueries.validateParams(timeframeMinutes, analysisType)) {
      throw new Error('Invalid parameters for volatility analysis');
    }

    const config = VolatilityAnalysisQueries.getVolatilityAnalysisConfig(timeframeMinutes, analysisType);
    const results = await this.executeQuery(config.query, `volatility_${analysisType}`);
    
    // For basic volatility, return single object; for others, return array
    return analysisType === 'basic' && results.length > 0 ? results[0] : results;
  }

  /**
   * Test query execution with sample data
   * @returns {Promise<Object>} Test results
   */
  async testQueries() {
    const testResults = {
      basic_query: null,
      table_exists: null,
      sample_data: null,
      errors: []
    };

    try {
      // Test basic query
      testResults.basic_query = await this.executeQuery('SELECT 42 as test_value', 'basic_test');
      
      // Test if trades table exists
      testResults.table_exists = await this.executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'trades'", 
        'table_check'
      );
      
      // Test sample data
      testResults.sample_data = await this.executeQuery(
        'SELECT COUNT(*) as trade_count FROM trades LIMIT 1', 
        'sample_data'
      );
      
    } catch (error) {
      testResults.errors.push(error.message);
    }

    return testResults;
  }

  /**
   * Get query execution statistics
   * @returns {Object} Query statistics
   */
  getStats() {
    return {
      ...this.queryStats,
      averageExecutionTime: this.queryStats.totalQueries > 0 
        ? this.queryStats.totalExecutionTime / this.queryStats.totalQueries 
        : 0,
      successRate: this.queryStats.totalQueries > 0 
        ? ((this.queryStats.totalQueries - this.queryStats.errorCount) / this.queryStats.totalQueries) * 100 
        : 0
    };
  }

  /**
   * Clear query statistics
   */
  clearStats() {
    this.queryStats = {
      totalQueries: 0,
      totalExecutionTime: 0,
      errorCount: 0
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
  }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueryManager;
} else {
  window.QueryManager = QueryManager;
}