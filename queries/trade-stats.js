/**
 * Trade Statistics Queries
 * Handles session statistics, price ranges, and trade counts
 */

class TradeStatsQueries {
  /**
   * Get session statistics for a given timeframe
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getSessionStats(startTime) {
    return `
      SELECT 
        MAX(price) AS session_high,
        MIN(price) AS session_low,
        COUNT(*) AS trade_count,
        AVG(price) AS avg_price
      FROM trades
      WHERE timestamp >= '${startTime}'
    `;
  }

  /**
   * Get first price in timeframe
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getFirstPrice(startTime) {
    return `
      SELECT price AS first_price 
      FROM trades 
      WHERE timestamp >= '${startTime}' 
      ORDER BY timestamp ASC 
      LIMIT 1
    `;
  }

  /**
   * Get current (latest) price in timeframe
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getCurrentPrice(startTime) {
    return `
      SELECT price AS current_price 
      FROM trades 
      WHERE timestamp >= '${startTime}' 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
  }

  /**
   * Get comprehensive trade statistics
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @returns {Object} Query configuration
   */
  static getComprehensiveStats(timeframeMinutes) {
    const now = new Date();
    const timeWindow = timeframeMinutes * 60 * 1000;
    const startTime = new Date(now.getTime() - timeWindow).toISOString();

    return {
      startTime,
      queries: {
        main: this.getSessionStats(startTime),
        first: this.getFirstPrice(startTime),
        current: this.getCurrentPrice(startTime)
      }
    };
  }

  /**
   * Validate query parameters
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @returns {boolean} True if valid
   */
  static validateTimeframe(timeframeMinutes) {
    return typeof timeframeMinutes === 'number' && 
           timeframeMinutes > 0 && 
           timeframeMinutes <= 1440; // Max 24 hours
  }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TradeStatsQueries;
} else {
  window.TradeStatsQueries = TradeStatsQueries;
}