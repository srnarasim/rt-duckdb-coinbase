/**
 * Volatility Analysis Queries
 * Handles price volatility calculations, standard deviations, and risk metrics
 */

class VolatilityAnalysisQueries {
  /**
   * Get basic volatility metrics using price changes
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getBasicVolatility(startTime) {
    return `
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
        AVG(ABS(pct_change)) AS avg_change,
        MIN(pct_change) AS min_change,
        MAX(pct_change) AS max_change,
        COUNT(*) AS sample_size
      FROM price_changes
      WHERE prev_price IS NOT NULL
    `;
  }

  /**
   * Get rolling volatility over time windows
   * @param {string} startTime - ISO timestamp string
   * @param {number} windowSize - Number of trades for rolling window
   * @returns {string} SQL query
   */
  static getRollingVolatility(startTime, windowSize = 20) {
    return `
      WITH price_changes AS (
        SELECT 
          timestamp,
          price,
          LAG(price) OVER (ORDER BY timestamp) AS prev_price,
          (price - LAG(price) OVER (ORDER BY timestamp)) / LAG(price) OVER (ORDER BY timestamp) * 100 AS pct_change
        FROM trades
        WHERE timestamp >= '${startTime}'
      ),
      rolling_stats AS (
        SELECT 
          timestamp,
          price,
          pct_change,
          STDDEV(pct_change) OVER (
            ORDER BY timestamp 
            ROWS BETWEEN ${windowSize-1} PRECEDING AND CURRENT ROW
          ) AS rolling_volatility,
          AVG(ABS(pct_change)) OVER (
            ORDER BY timestamp 
            ROWS BETWEEN ${windowSize-1} PRECEDING AND CURRENT ROW
          ) AS rolling_avg_change
        FROM price_changes
        WHERE prev_price IS NOT NULL
      )
      SELECT 
        timestamp,
        price,
        pct_change,
        rolling_volatility,
        rolling_avg_change
      FROM rolling_stats
      WHERE rolling_volatility IS NOT NULL
      ORDER BY timestamp
    `;
  }

  /**
   * Get volatility by time periods (hourly, daily patterns)
   * @param {string} startTime - ISO timestamp string
   * @param {string} timeUnit - 'hour', 'minute', etc.
   * @returns {string} SQL query
   */
  static getVolatilityByTimePeriod(startTime, timeUnit = 'hour') {
    return `
      WITH price_changes AS (
        SELECT 
          timestamp,
          price,
          EXTRACT(${timeUnit} FROM timestamp) AS time_period,
          LAG(price) OVER (ORDER BY timestamp) AS prev_price,
          (price - LAG(price) OVER (ORDER BY timestamp)) / LAG(price) OVER (ORDER BY timestamp) * 100 AS pct_change
        FROM trades
        WHERE timestamp >= '${startTime}'
      )
      SELECT 
        time_period,
        STDDEV(pct_change) AS volatility,
        AVG(ABS(pct_change)) AS avg_change,
        COUNT(*) AS trade_count,
        MIN(pct_change) AS min_change,
        MAX(pct_change) AS max_change
      FROM price_changes
      WHERE prev_price IS NOT NULL
      GROUP BY time_period
      ORDER BY time_period
    `;
  }

  /**
   * Get volatility clustering analysis
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getVolatilityClustering(startTime) {
    return `
      WITH price_changes AS (
        SELECT 
          timestamp,
          price,
          LAG(price) OVER (ORDER BY timestamp) AS prev_price,
          ABS((price - LAG(price) OVER (ORDER BY timestamp)) / LAG(price) OVER (ORDER BY timestamp) * 100) AS abs_pct_change
        FROM trades
        WHERE timestamp >= '${startTime}'
      ),
      volatility_levels AS (
        SELECT 
          timestamp,
          price,
          abs_pct_change,
          CASE 
            WHEN abs_pct_change > 1.0 THEN 'high'
            WHEN abs_pct_change > 0.5 THEN 'medium'
            ELSE 'low'
          END AS volatility_level
        FROM price_changes
        WHERE prev_price IS NOT NULL
      )
      SELECT 
        volatility_level,
        COUNT(*) AS occurrence_count,
        AVG(abs_pct_change) AS avg_volatility,
        MIN(abs_pct_change) AS min_volatility,
        MAX(abs_pct_change) AS max_volatility
      FROM volatility_levels
      GROUP BY volatility_level
      ORDER BY 
        CASE volatility_level 
          WHEN 'high' THEN 3 
          WHEN 'medium' THEN 2 
          ELSE 1 
        END
    `;
  }

  /**
   * Get Value at Risk (VaR) estimation
   * @param {string} startTime - ISO timestamp string
   * @param {number} confidenceLevel - Confidence level (e.g., 0.95 for 95%)
   * @returns {string} SQL query
   */
  static getValueAtRisk(startTime, confidenceLevel = 0.95) {
    const percentile = (1 - confidenceLevel) * 100;
    
    return `
      WITH price_changes AS (
        SELECT 
          timestamp,
          price,
          (price - LAG(price) OVER (ORDER BY timestamp)) / LAG(price) OVER (ORDER BY timestamp) * 100 AS pct_change
        FROM trades
        WHERE timestamp >= '${startTime}'
      )
      SELECT 
        PERCENTILE_CONT(${percentile/100}) WITHIN GROUP (ORDER BY pct_change) AS var_${Math.round(confidenceLevel*100)},
        STDDEV(pct_change) AS volatility,
        AVG(pct_change) AS mean_return,
        COUNT(*) AS sample_size
      FROM price_changes
      WHERE pct_change IS NOT NULL
    `;
  }

  /**
   * Get volatility analysis configuration
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} analysisType - Type of volatility analysis
   * @returns {Object} Query configuration
   */
  static getVolatilityAnalysisConfig(timeframeMinutes, analysisType = 'basic') {
    const now = new Date();
    const timeWindow = timeframeMinutes * 60 * 1000;
    const startTime = new Date(now.getTime() - timeWindow).toISOString();

    const configs = {
      basic: {
        query: this.getBasicVolatility(startTime),
        description: 'Basic volatility metrics'
      },
      rolling: {
        query: this.getRollingVolatility(startTime),
        description: 'Rolling volatility over time'
      },
      by_time: {
        query: this.getVolatilityByTimePeriod(startTime),
        description: 'Volatility patterns by time period'
      },
      clustering: {
        query: this.getVolatilityClustering(startTime),
        description: 'Volatility clustering analysis'
      },
      var: {
        query: this.getValueAtRisk(startTime),
        description: 'Value at Risk estimation'
      }
    };

    if (!configs[analysisType]) {
      throw new Error(`Invalid analysis type: ${analysisType}`);
    }

    return {
      startTime,
      timeframeMinutes,
      analysisType,
      ...configs[analysisType]
    };
  }

  /**
   * Validate volatility analysis parameters
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} analysisType - Analysis type
   * @returns {boolean} True if valid
   */
  static validateParams(timeframeMinutes, analysisType) {
    const validTypes = ['basic', 'rolling', 'by_time', 'clustering', 'var'];
    return typeof timeframeMinutes === 'number' && 
           timeframeMinutes > 0 && 
           validTypes.includes(analysisType);
  }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VolatilityAnalysisQueries;
} else {
  window.VolatilityAnalysisQueries = VolatilityAnalysisQueries;
}