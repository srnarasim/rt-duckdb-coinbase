# Real DuckDB WASM Implementation Setup

## Current State vs Required State

### Current (Mock Implementation)
- `static/duckdb-wasm.js` - Mock implementation that simulates DuckDB API
- Generates fake data for demonstration
- No real database operations

### Required (Real DuckDB WASM)
- Actual DuckDB WASM files from npm package `@duckdb/duckdb-wasm`
- Real database with SQL operations
- Proper WASM module loading

## 1. 📦 Install Real DuckDB WASM Package

```bash
# Option 1: NPM (recommended)
npm install @duckdb/duckdb-wasm

# Option 2: CDN (for quick setup)
# Include in HTML:
<script src="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.worker.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-mvp.wasm"></script>
<script src="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser.js"></script>
```

## 2. 🗂️ Required Files Structure

```
static/
├── duckdb-mvp.wasm                    # Core WASM binary
├── duckdb-browser.js                  # Main browser bundle
├── duckdb-browser-mvp.worker.js       # Web Worker
├── duckdb-browser-coi.worker.js       # Cross-Origin Isolated Worker (optional)
└── duckdb-browser-eh.worker.js        # Exception Handling Worker (optional)
```

## 3. 🔄 Replace Mock Implementation

### Current Mock File: `static/duckdb-wasm.js`
```javascript
// Mock implementation - REMOVE THIS
window.duckdb = {
  AsyncDuckDB: class MockAsyncDuckDB {
    // Fake implementation
  }
};
```

### Real Implementation: `static/duckdb-wasm.js`
```javascript
// Real DuckDB WASM implementation
import * as duckdb from '@duckdb/duckdb-wasm';

// Bundle configuration
const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

// Select appropriate bundle
const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

// Initialize DuckDB
const worker = new Worker(bundle.mainWorker);
const logger = new duckdb.ConsoleLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

// Export for global use
window.duckdb = duckdb;
window.duckdbInstance = db;
```

## 4. 🏗️ Database Schema Setup

### Create Tables for Market Data
```sql
-- Create trades table
CREATE TABLE trades (
    id INTEGER PRIMARY KEY,
    timestamp TIMESTAMP,
    price DECIMAL(18,8),
    size DECIMAL(18,8),
    side VARCHAR(4),
    exchange VARCHAR(20),
    pair VARCHAR(10)
);

-- Create aggregated data table
CREATE TABLE price_aggregates (
    timestamp TIMESTAMP,
    timeframe VARCHAR(10),
    open_price DECIMAL(18,8),
    high_price DECIMAL(18,8),
    low_price DECIMAL(18,8),
    close_price DECIMAL(18,8),
    volume DECIMAL(18,8),
    trade_count INTEGER
);

-- Create indexes for performance
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_trades_pair ON trades(pair);
CREATE INDEX idx_aggregates_timeframe ON price_aggregates(timeframe, timestamp);
```

## 5. 🔌 Update Data Processor

### Current Mock Queries
```javascript
// Mock implementation returns fake data
async getRecentTrades(limit = 100) {
    return this.generateMockData(limit);
}
```

### Real SQL Queries
```javascript
async getRecentTrades(limit = 100) {
    const conn = await this.db.connect();
    const result = await conn.query(`
        SELECT timestamp, price, size, side, exchange, pair
        FROM trades 
        ORDER BY timestamp DESC 
        LIMIT ${limit}
    `);
    await conn.close();
    return result.toArray();
}

async getStats(timeframe = '5m') {
    const conn = await this.db.connect();
    const result = await conn.query(`
        SELECT 
            MAX(price) as session_high,
            MIN(price) as session_low,
            LAST(price ORDER BY timestamp) as current_price,
            (LAST(price ORDER BY timestamp) - FIRST(price ORDER BY timestamp)) / FIRST(price ORDER BY timestamp) * 100 as change_percent,
            COUNT(*) as trade_count,
            AVG(price) as avg_price
        FROM trades 
        WHERE timestamp >= NOW() - INTERVAL '${timeframe}'
    `);
    await conn.close();
    return result.toArray()[0];
}
```

## 6. 📊 Real Data Ingestion

### Current Mock Data Generation
```javascript
generateDemoData() {
    // Creates fake data
}
```

### Real WebSocket Data Insertion
```javascript
async insertTrade(tradeData) {
    const conn = await this.db.connect();
    await conn.query(`
        INSERT INTO trades (timestamp, price, size, side, exchange, pair)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        new Date(tradeData.timestamp),
        tradeData.data.price,
        tradeData.data.size,
        tradeData.data.side,
        tradeData.data.exchange || 'coinbase',
        tradeData.data.pair || 'BTC-USD'
    ]);
    await conn.close();
}
```

## 7. 🌐 WASM File Serving Configuration

### Server Configuration (for Python HTTP server)
```python
# Add MIME type for WASM files
import mimetypes
mimetypes.add_type('application/wasm', '.wasm')

# Enable CORS headers
class CORSHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()
```

### Nginx Configuration (for production)
```nginx
location ~* \.wasm$ {
    add_header Content-Type application/wasm;
    add_header Cross-Origin-Embedder-Policy require-corp;
    add_header Cross-Origin-Opener-Policy same-origin;
}
```

## 8. 🔧 Memory Management

### Configure WASM Memory Limits
```javascript
const config = {
    query: {
        castBigIntToDouble: true,
        castTimestampToDate: true,
    },
    memory: {
        maximum: 1024 * 1024 * 1024, // 1GB limit
    }
};

await db.instantiate(bundle.mainModule, bundle.pthreadWorker, config);
```

## 9. 🚨 Error Handling

### Robust Error Handling
```javascript
class DataProcessor {
    async initialize() {
        try {
            // Real DuckDB initialization
            const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
            this.worker = new Worker(bundle.mainWorker);
            this.db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), this.worker);
            await this.db.instantiate(bundle.mainModule);
            
            // Create schema
            await this.createSchema();
            
        } catch (error) {
            console.error('Failed to initialize DuckDB:', error);
            // Fallback to mock implementation
            this.useMockImplementation = true;
        }
    }
    
    async query(sql, params = []) {
        if (this.useMockImplementation) {
            return this.mockQuery(sql, params);
        }
        
        const conn = await this.db.connect();
        try {
            const result = await conn.query(sql, params);
            return result.toArray();
        } finally {
            await conn.close();
        }
    }
}
```

## 10. 🔄 Migration Steps

### Step-by-Step Migration
1. **Download real DuckDB WASM files**
2. **Replace mock implementation**
3. **Update HTML to load real WASM files**
4. **Modify DataProcessor to use real SQL**
5. **Set up proper database schema**
6. **Update WebSocket data ingestion**
7. **Configure server for WASM serving**
8. **Test with real data**

## 11. 📋 Testing Checklist

- [ ] DuckDB WASM files load without errors
- [ ] Database initializes successfully
- [ ] Tables are created properly
- [ ] Data insertion works from WebSocket
- [ ] Queries return real data
- [ ] Charts display actual market data
- [ ] Memory usage is reasonable
- [ ] Error handling works correctly
- [ ] Performance is acceptable

## 12. 🎯 Expected Benefits

### Performance
- Real SQL query optimization
- Efficient data storage and retrieval
- Better memory management

### Functionality
- Complex analytical queries
- Real-time aggregations
- Historical data analysis
- Advanced filtering and grouping

### Scalability
- Handle larger datasets
- Better query performance
- Proper indexing support