/**
 * Volume Analysis Queries
 * Handles trading volume analysis by side, time periods, and distributions
 */

class VolumeAnalysisQueries {
  /**
   * Get volume by trade side (buy/sell)
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getVolumeBySide(startTime) {
    return `
      SELECT 
        side,
        SUM(size) AS volume,
        COUNT(*) AS trade_count,
        AVG(size) AS avg_trade_size
      FROM trades
      WHERE timestamp >= '${startTime}'
      GROUP BY side
      ORDER BY volume DESC
    `;
  }

  /**
   * Get volume over time with time buckets
   * @param {string} startTime - ISO timestamp string
   * @param {string} interval - Time interval ('minute', 'hour', etc.)
   * @returns {string} SQL query
   */
  static getVolumeOverTime(startTime, interval = 'minute') {
    return `
      SELECT 
        DATE_TRUNC('${interval}', timestamp) AS time_bucket,
        SUM(size) AS total_volume,
        SUM(CASE WHEN side = 'buy' THEN size ELSE 0 END) AS buy_volume,
        SUM(CASE WHEN side = 'sell' THEN size ELSE 0 END) AS sell_volume,
        COUNT(*) AS trade_count
      FROM trades
      WHERE timestamp >= '${startTime}'
      GROUP BY DATE_TRUNC('${interval}', timestamp)
      ORDER BY time_bucket
    `;
  }

  /**
   * Get volume-weighted average price (VWAP)
   * @param {string} startTime - ISO timestamp string
   * @returns {string} SQL query
   */
  static getVWAP(startTime) {
    return `
      SELECT 
        SUM(price * size) / SUM(size) AS vwap,
        SUM(size) AS total_volume,
        COUNT(*) AS total_trades
      FROM trades
      WHERE timestamp >= '${startTime}'
    `;
  }

  /**
   * Get volume distribution by price ranges
   * @param {string} startTime - ISO timestamp string
   * @param {number} bins - Number of price bins
   * @returns {string} SQL query
   */
  static getVolumeDistribution(startTime, bins = 10) {
    return `
      WITH price_stats AS (
        SELECT 
          MIN(price) AS min_price,
          MAX(price) AS max_price
        FROM trades
        WHERE timestamp >= '${startTime}'
      ),
      price_bins AS (
        SELECT 
          min_price + (max_price - min_price) * (generate_series(0, ${bins-1}) / ${bins}.0) AS bin_start,
          min_price + (max_price - min_price) * (generate_series(1, ${bins}) / ${bins}.0) AS bin_end
        FROM price_stats
      )
      SELECT 
        pb.bin_start,
        pb.bin_end,
        COALESCE(SUM(t.size), 0) AS volume,
        COUNT(t.price) AS trade_count
      FROM price_bins pb
      LEFT JOIN trades t ON t.price >= pb.bin_start 
        AND t.price < pb.bin_end 
        AND t.timestamp >= '${startTime}'
      GROUP BY pb.bin_start, pb.bin_end
      ORDER BY pb.bin_start
    `;
  }

  /**
   * Get large trades analysis
   * @param {string} startTime - ISO timestamp string
   * @param {number} sizeThreshold - Minimum size to consider "large"
   * @returns {string} SQL query
   */
  static getLargeTrades(startTime, sizeThreshold = 1.0) {
    return `
      SELECT 
        timestamp,
        price,
        size,
        side,
        (price * size) AS notional_value
      FROM trades
      WHERE timestamp >= '${startTime}'
        AND size >= ${sizeThreshold}
      ORDER BY size DESC
      LIMIT 100
    `;
  }

  /**
   * Get volume analysis configuration
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} analysisType - Type of volume analysis
   * @returns {Object} Query configuration
   */
  static getVolumeAnalysisConfig(timeframeMinutes, analysisType = 'by_side') {
    const now = new Date();
    const timeWindow = timeframeMinutes * 60 * 1000;
    const startTime = new Date(now.getTime() - timeWindow).toISOString();

    const configs = {
      by_side: {
        query: this.getVolumeBySide(startTime),
        description: 'Volume breakdown by buy/sell side'
      },
      over_time: {
        query: this.getVolumeOverTime(startTime),
        description: 'Volume distribution over time'
      },
      vwap: {
        query: this.getVWAP(startTime),
        description: 'Volume-weighted average price'
      },
      distribution: {
        query: this.getVolumeDistribution(startTime),
        description: 'Volume distribution by price ranges'
      },
      large_trades: {
        query: this.getLargeTrades(startTime),
        description: 'Analysis of large trades'
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
   * Validate volume analysis parameters
   * @param {number} timeframeMinutes - Timeframe in minutes
   * @param {string} analysisType - Analysis type
   * @returns {boolean} True if valid
   */
  static validateParams(timeframeMinutes, analysisType) {
    const validTypes = ['by_side', 'over_time', 'vwap', 'distribution', 'large_trades'];
    return typeof timeframeMinutes === 'number' && 
           timeframeMinutes > 0 && 
           validTypes.includes(analysisType);
  }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VolumeAnalysisQueries;
} else {
  window.VolumeAnalysisQueries = VolumeAnalysisQueries;
}