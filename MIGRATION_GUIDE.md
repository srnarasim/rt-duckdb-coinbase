# 🚀 Migration Guide: Mock to Real DuckDB WASM

## Quick Summary

To replace the mock DuckDB implementation with the real one, you need to:

1. **Download real DuckDB WASM files** (3 files: .wasm, .js, .worker.js)
2. **Replace mock implementation** with real DuckDB initialization
3. **Update data processing** to use real SQL queries
4. **Configure server** to serve WASM files properly
5. **Set up WebSocket data ingestion** to insert real data

## 📋 Step-by-Step Migration

### Step 1: Download Real DuckDB WASM Files

```bash
# Option A: Using npm (recommended)
npm install @duckdb/duckdb-wasm

# Option B: Download directly from CDN
wget https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-mvp.wasm
wget https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser.js
wget https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.worker.js
```

### Step 2: Replace Files

**Current Structure:**
```
static/
└── duckdb-wasm.js  # Mock implementation (REMOVE)
```

**New Structure:**
```
static/
├── duckdb-mvp.wasm                    # Real WASM binary
├── duckdb-browser.js                  # Real DuckDB library
├── duckdb-browser-mvp.worker.js       # Web Worker
└── duckdb-real.js                     # Real initialization script
```

### Step 3: Update HTML

**Replace in `fixed-index.html`:**

```html
<!-- OLD: Mock implementation -->
<script src="static/duckdb-wasm.js"></script>

<!-- NEW: Real DuckDB WASM -->
<script src="static/duckdb-browser.js"></script>
<script src="static/duckdb-real.js"></script>
```

### Step 4: Create Real DuckDB Initialization

**Create `static/duckdb-real.js`:**

```javascript
// Real DuckDB WASM Initialization
(async function initializeDuckDB() {
  try {
    console.log("Loading real DuckDB WASM...");
    
    // Get DuckDB bundles
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    
    // Select appropriate bundle
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    // Create worker and database
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    
    // Instantiate DuckDB
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    // Make available globally
    window.duckdbInstance = db;
    window.duckdbWorker = worker;
    
    console.log("Real DuckDB WASM loaded successfully!");
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('duckdb-ready'));
    
  } catch (error) {
    console.error("Failed to load real DuckDB WASM:", error);
    console.log("Consider using mock implementation as fallback");
  }
})();
```

### Step 5: Update DataProcessor

**Replace `js/data-processor.js` initialization:**

```javascript
class DataProcessor {
  async initialize() {
    // Wait for real DuckDB to be ready
    if (!window.duckdbInstance) {
      await new Promise(resolve => {
        window.addEventListener('duckdb-ready', resolve, { once: true });
      });
    }
    
    this.db = window.duckdbInstance;
    
    // Create database schema
    await this.createSchema();
    
    this.initialized = true;
  }
  
  async createSchema() {
    const conn = await this.db.connect();
    
    try {
      // Create trades table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY,
          timestamp TIMESTAMP,
          price DECIMAL(18,8),
          size DECIMAL(18,8),
          side VARCHAR(4),
          exchange VARCHAR(20),
          pair VARCHAR(10)
        )
      `);
      
      // Create indexes
      await conn.query(`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`);
      
    } finally {
      await conn.close();
    }
  }
}
```

### Step 6: Update Query Methods

**Replace mock queries with real SQL:**

```javascript
// OLD: Mock implementation
async getStats(timeframe) {
  return this.generateMockStats();
}

// NEW: Real SQL queries
async getStats(timeframe = '5m') {
  const conn = await this.db.connect();
  
  try {
    const result = await conn.query(`
      SELECT 
        MAX(price) as session_high,
        MIN(price) as session_low,
        LAST(price ORDER BY timestamp) as current_price,
        COUNT(*) as trade_count
      FROM trades 
      WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 MINUTE'
    `);
    
    return result.toArray()[0];
    
  } finally {
    await conn.close();
  }
}
```

### Step 7: Set Up Real Data Ingestion

**Update `js/dashboard-controller.js`:**

```javascript
// OLD: Generate demo data
generateDemoData() {
  // Mock data generation
}

// NEW: Insert real WebSocket data
async handleData(data) {
  try {
    // Insert real trade data into DuckDB
    await this.dataProcessor.insertTrade({
      timestamp: data.timestamp,
      price: data.data.price,
      size: data.data.size,
      side: data.data.side,
      exchange: 'coinbase',
      pair: 'BTC-USD'
    });
    
    // Update UI with real data
    this.updateUI();
    
  } catch (error) {
    console.error("Error processing real data:", error);
  }
}
```

### Step 8: Configure Server for WASM

**For Python HTTP Server:**

```python
import mimetypes
from http.server import SimpleHTTPRequestHandler, HTTPServer

# Add WASM MIME type
mimetypes.add_type('application/wasm', '.wasm')

class CORSHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Required headers for WASM
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

# Start server
httpd = HTTPServer(('0.0.0.0', 12000), CORSHTTPRequestHandler)
httpd.serve_forever()
```

### Step 9: Test Real Implementation

**Create test script:**

```javascript
// Test real DuckDB functionality
async function testRealDuckDB() {
  try {
    // Wait for DuckDB to be ready
    await new Promise(resolve => {
      if (window.duckdbInstance) resolve();
      else window.addEventListener('duckdb-ready', resolve, { once: true });
    });
    
    const db = window.duckdbInstance;
    const conn = await db.connect();
    
    // Test basic query
    const result = await conn.query("SELECT 42 as answer");
    console.log("Real DuckDB test result:", result.toArray());
    
    await conn.close();
    console.log("✅ Real DuckDB is working!");
    
  } catch (error) {
    console.error("❌ Real DuckDB test failed:", error);
  }
}

// Run test
testRealDuckDB();
```

## 🔍 Verification Checklist

- [ ] **WASM files load without 404 errors**
- [ ] **No MIME type errors in browser console**
- [ ] **DuckDB initializes successfully**
- [ ] **Database tables are created**
- [ ] **Real data can be inserted**
- [ ] **Queries return actual data (not mock)**
- [ ] **Charts display real market data**
- [ ] **Performance is acceptable**
- [ ] **Memory usage is reasonable**
- [ ] **Error handling works properly**

## 🚨 Common Issues & Solutions

### Issue 1: WASM Loading Errors
```
Error: Failed to fetch WASM module
```
**Solution:** Ensure server serves WASM files with correct MIME type and CORS headers.

### Issue 2: Worker Loading Errors
```
Error: Failed to load worker script
```
**Solution:** Check that worker files are in the correct path and accessible.

### Issue 3: Memory Errors
```
Error: Out of memory
```
**Solution:** Configure WASM memory limits and implement data cleanup.

### Issue 4: Query Errors
```
Error: SQL syntax error
```
**Solution:** Ensure SQL queries are compatible with DuckDB syntax.

## 📊 Performance Comparison

| Aspect | Mock Implementation | Real DuckDB WASM |
|--------|-------------------|-------------------|
| **Data Storage** | In-memory arrays | Efficient columnar storage |
| **Query Performance** | O(n) linear scans | Optimized SQL execution |
| **Memory Usage** | High (all data in RAM) | Efficient compression |
| **Analytics** | Limited calculations | Full SQL capabilities |
| **Scalability** | Poor (browser limits) | Good (up to 4GB) |

## 🎯 Expected Benefits

### Functionality
- **Real SQL queries** with joins, aggregations, window functions
- **Efficient data storage** with compression
- **Advanced analytics** capabilities
- **Better performance** for large datasets

### Development
- **Standard SQL** instead of custom JavaScript logic
- **Easier maintenance** with declarative queries
- **Better testing** with SQL unit tests
- **Future-proof** architecture

## 🔄 Rollback Plan

If real DuckDB WASM doesn't work:

1. **Keep mock files** as backup
2. **Use feature flags** to switch between implementations
3. **Implement graceful fallback** in DataProcessor
4. **Monitor performance** and user experience

```javascript
// Fallback implementation
class DataProcessor {
  constructor() {
    this.useRealDuckDB = false;
    this.mockImplementation = new MockDataProcessor();
  }
  
  async initialize() {
    try {
      await this.initializeRealDuckDB();
      this.useRealDuckDB = true;
    } catch (error) {
      console.warn("Falling back to mock implementation");
      await this.mockImplementation.initialize();
    }
  }
  
  async getStats(timeframe) {
    if (this.useRealDuckDB) {
      return this.getRealStats(timeframe);
    } else {
      return this.mockImplementation.getStats(timeframe);
    }
  }
}
```

This migration guide provides a complete path from the current mock implementation to a fully functional real DuckDB WASM integration! 🚀