/**
 * Price Data Queries
 * Handles price time series data with optional aggregation
 */

class PriceDataQueries {
  /**
   * Get raw price data without aggregation
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getRawPriceData(startTime) {
    return `
      SELECT timestamp, price
      FROM trades
      WHERE timestamp >= '${startTime}'
      ORDER BY timestamp
    `;
  }

  /**
   * Get aggregated price data by time interval
   * @param {string} startTime - ISO timestamp string
   * @param {string} aggregationType - 'second', 'minute', 'hour'
   * @returns {string} SQL query
   */
  static getAggregatedPriceData(startTime, aggregationType = 'second') {
    const validTypes = ['second', 'minute', 'hour'];
    if (!validTypes.includes(aggregationType)) {
      throw new Error(`Invalid aggregation type: ${aggregationType}`);
    }

    return `
      SELECT 
        DATE_TRUNC('${aggregationType}', timestamp) AS timestamp,
        AVG(price) AS price,
        COUNT(*) AS trade_count,
        MIN(price) AS low,
        MAX(price) AS high
      FROM trades
      WHERE timestamp >= '${startTime}'
      GROUP BY DATE_TRUNC('${aggregationType}', timestamp)
      ORDER BY timestamp
    `;
  }

  /**
   * Get OHLC (Open, High, Low, Close) data
   * @param {string} startTime - ISO timestamp string
   * @param {string} interval - Time interval for OHLC bars
   * @returns {string} SQL query
   */
  static getOHLCData(startTime, interval = 'minute') {
    return `
      WITH time_buckets AS (
        SELECT 
          DATE_TRUNC('${interval}', timestamp) AS bucket,
          price,
          timestamp,
          ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('${interval}', timestamp) ORDER BY timestamp ASC) AS first_row,
          ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('${interval}', timestamp) ORDER BY timestamp DESC) AS last_row
        FROM trades
        WHERE timestamp >= '${startTime}'
      )
      SELECT 
        bucket AS timestamp,
        MAX(CASE WHEN first_row = 1 THEN price END) AS open,
        MAX(price) AS high,
        MIN(price) AS low,
        MAX(CASE WHEN last_row = 1 THEN price END) AS close,
        COUNT(*) AS volume
      FROM time_buckets
      GROUP BY bucket
      ORDER BY bucket
    `;
  }

  /**
   * Get price data configuration for different chart types
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} aggregation - Aggregation type or 'none'
   * @returns {Object} Query configuration
   */
  static getPriceDataConfig(timeframeMinutes, aggregation = 'none') {
    const now = new Date();
    const timeWindow = timeframeMinutes * 60 * 1000;
    const startTime = new Date(now.getTime() - timeWindow).toISOString();

    let query;
    let queryType;

    if (aggregation === 'none') {
      query = this.getRawPriceData(startTime);
      queryType = 'raw';
    } else if (aggregation === 'ohlc') {
      query = this.getOHLCData(startTime);
      queryType = 'ohlc';
    } else {
      // Determine aggregation type based on timeframe
      let aggType = 'second';
      if (timeframeMinutes > 60) aggType = 'minute';
      if (timeframeMinutes > 1440) aggType = 'hour';
      
      query = this.getAggregatedPriceData(startTime, aggType);
      queryType = 'aggregated';
    }

    return {
      startTime,
      query,
      queryType,
      timeframeMinutes,
      aggregation
    };
  }

  /**
   * Validate price data parameters
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} aggregation - Aggregation type
   * @returns {boolean} True if valid
   */
  static validateParams(timeframeMinutes, aggregation) {
    const validAggregations = ['none', 'second', 'minute', 'hour', 'ohlc'];
    return typeof timeframeMinutes === 'number' && 
           timeframeMinutes > 0 && 
           validAggregations.includes(aggregation);
  }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriceDataQueries;
} else {
  window.PriceDataQueries = PriceDataQueries;
}