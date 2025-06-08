import initDuckDB from '../static/duckdb-wasm.js';

let db, conn;
const rows = [];
let dataSource = "unknown";

export async function send_to_js(raw) {
  try {
    const msg = JSON.parse(raw);
    
    // Handle both NEX Stream and Coinbase data formats
    if (msg.type !== "ticker" && !msg.source) return;

    // Identify data source
    dataSource = msg.source === "nex_stream" ? "NEX Stream" : "Coinbase";
    console.log(`Received ${dataSource} data:`, msg);
    
    // Extract price and time
    const price = parseFloat(msg.price);
    const time = new Date(msg.time).toISOString();
    
    // Add source information to the data
    rows.push({ 
      price, 
      time, 
      source: dataSource,
      subject: msg.subject || "ticker" 
    });

    if (rows.length > 100) rows.shift(); // keep it small

    // Insert into DuckDB if connection is established
    if (conn) {
      try {
        // Insert with source information
        await conn.insertValues("market_data", [[price, time, dataSource, msg.subject || "ticker"]]);
        
        // Query with more advanced analytics
        const result = await conn.query(`
          SELECT 
            price, 
            time, 
            source,
            subject,
            AVG(price) OVER (ORDER BY time ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) as moving_avg_5,
            LAG(price, 1) OVER (ORDER BY time) as prev_price
          FROM market_data 
          ORDER BY time DESC 
          LIMIT 100
        `);
        
        // Update UI with the data source
        updateDataSourceInfo(dataSource);
        
        // Draw the plot with the result
        drawPlot(result.toArray());
      } catch (dbError) {
        console.error("DuckDB error:", dbError);
        // Fallback to using the rows array directly if DuckDB fails
        updateDataSourceInfo(dataSource);
        drawPlot(rows);
      }
    } else {
      // If DuckDB is not ready yet, just use the rows array
      updateDataSourceInfo(dataSource);
      drawPlot(rows);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    console.log("Raw message:", raw);
  }
}

// Update UI to show data source information
function updateDataSourceInfo(source) {
  // Update footer text
  const footerDataSource = document.querySelector('footer p:nth-child(2)');
  if (footerDataSource) {
    footerDataSource.textContent = `Data source: ${source}`;
  }
  
  // Update page title to include data source
  document.title = `Real-Time BTC/USD Analytics (${source})`;
}

function drawPlot(data) {
  try {
    // Check for both old and new chart elements
    const legacyEl = document.getElementById("chart");
    const priceChartEl = document.getElementById("price-chart");
    
    // If we can't find either chart element, log an error and return
    if (!legacyEl && !priceChartEl) {
      console.error("No chart elements found");
      return;
    }
    
    // Update stats first
    updateStats(data);
    
    // Handle legacy chart if it's visible
    if (legacyEl && legacyEl.offsetParent !== null) {
      drawLegacyChart(legacyEl, data);
    }
    
    // Handle new chart structure if available
    if (priceChartEl) {
      drawEnhancedCharts(data);
    }
  } catch (error) {
    console.error("Error drawing plot:", error);
  }
}

// Draw chart using the legacy structure
function drawLegacyChart(el, data) {
  // Clear previous content
  el.innerHTML = "";
  
  // Check if Plot is available
  if (typeof Plot !== 'undefined') {
    const plotElement = Plot.plot({
      marks: [
        Plot.line(data, { x: "time", y: "price", stroke: "source", strokeWidth: 2 }),
        Plot.dot(data, { x: "time", y: "price", fill: "source", r: 3 })
      ],
      x: { type: "utc", label: "Time" },
      y: { label: "BTC Price (USD)" },
      color: { legend: true },
      height: 300,
      width: el.clientWidth || 600,
      marginRight: 100
    });
    el.appendChild(plotElement);
  } else {
    // Fallback if Plot is not available
    console.error("Plot library not loaded");
    el.textContent = "Chart library not loaded. Data: " + JSON.stringify(data.slice(0, 5));
  }
}

// Draw enhanced charts for the new UI structure
function drawEnhancedCharts(data) {
  // Price chart (main chart)
  const priceChartEl = document.getElementById("price-chart");
  if (priceChartEl) {
    priceChartEl.innerHTML = "";
    
    if (typeof Plot !== 'undefined') {
      // Create a more advanced price chart with moving average
      const priceChart = Plot.plot({
        marks: [
          Plot.line(data, { x: "time", y: "price", stroke: "source", strokeWidth: 2 }),
          // Add moving average if available
          data[0].moving_avg_5 ? Plot.line(data, { 
            x: "time", 
            y: "moving_avg_5", 
            stroke: d => d.source + " (MA-5)",
            strokeWidth: 1.5,
            strokeDasharray: "4 2"
          }) : null,
          Plot.dot(data, { 
            x: "time", 
            y: "price", 
            fill: "source", 
            r: 3,
            title: d => `${d.source}\nTime: ${new Date(d.time).toLocaleString()}\nPrice: $${d.price.toFixed(2)}`
          })
        ].filter(Boolean),
        x: { type: "utc", label: "Time", tickFormat: "%H:%M:%S" },
        y: { label: "BTC Price (USD)", grid: true },
        color: { legend: true },
        height: 300,
        width: priceChartEl.clientWidth || 800,
        marginRight: 120,
        style: { fontSize: "12px" }
      });
      priceChartEl.appendChild(priceChart);
    }
  }
  
  // Volatility chart
  const volatilityChartEl = document.getElementById("volatility-chart");
  if (volatilityChartEl && data[0].pct_change) {
    volatilityChartEl.innerHTML = "";
    
    if (typeof Plot !== 'undefined') {
      const volatilityChart = Plot.plot({
        marks: [
          Plot.line(data, { 
            x: "time", 
            y: "pct_change", 
            stroke: "source", 
            strokeWidth: 1.5 
          }),
          Plot.ruleY([0], { stroke: "#ccc", strokeWidth: 1, strokeDasharray: "4 2" })
        ],
        x: { type: "utc", label: null },
        y: { 
          label: "% Change", 
          domain: [-2, 2],  // Limit the domain for better visualization
          tickFormat: d => d.toFixed(2) + "%"
        },
        height: 200,
        width: volatilityChartEl.clientWidth || 400,
        marginRight: 40
      });
      volatilityChartEl.appendChild(volatilityChart);
    }
  }
  
  // Distribution chart
  const distributionChartEl = document.getElementById("distribution-chart");
  if (distributionChartEl) {
    distributionChartEl.innerHTML = "";
    
    if (typeof Plot !== 'undefined') {
      const distributionChart = Plot.plot({
        marks: [
          Plot.rectY(data, Plot.binX({ y: "count" }, { x: "price", fill: "source", thresholds: 20 })),
        ],
        x: { label: "Price (USD)" },
        y: { label: "Frequency" },
        height: 200,
        width: distributionChartEl.clientWidth || 400,
        marginRight: 40
      });
      distributionChartEl.appendChild(distributionChart);
    }
  }
  
  // Moving Averages chart
  const maChartEl = document.getElementById("ma-chart");
  if (maChartEl && data[0].moving_avg_5) {
    maChartEl.innerHTML = "";
    
    if (typeof Plot !== 'undefined') {
      const maChart = Plot.plot({
        marks: [
          Plot.line(data, { x: "time", y: "price", stroke: d => d.source + " (Price)", strokeWidth: 1 }),
          Plot.line(data, { x: "time", y: "moving_avg_5", stroke: d => d.source + " (MA-5)", strokeWidth: 2 }),
        ],
        x: { type: "utc", label: "Time" },
        y: { label: "Price (USD)" },
        color: { legend: true },
        height: 200,
        width: maChartEl.clientWidth || 800,
        marginRight: 120
      });
      maChartEl.appendChild(maChart);
    }
  }
}

// Update statistics display
function updateStats(data) {
  if (!data || data.length === 0) return;
  
  // Get the latest data point
  const latest = data[data.length - 1];
  
  // Update current price
  const currentPriceEl = document.getElementById("current-price");
  if (currentPriceEl) {
    currentPriceEl.textContent = `$${latest.price.toFixed(2)}`;
  }
  
  // Calculate price change if we have previous price data
  if (data.length > 1) {
    const first = data[0];
    const priceChange = ((latest.price - first.price) / first.price) * 100;
    
    const priceChangeEl = document.getElementById("price-change");
    if (priceChangeEl) {
      priceChangeEl.textContent = `${priceChange.toFixed(2)}%`;
      priceChangeEl.style.color = priceChange >= 0 ? '#4CAF50' : '#f44336';
    }
  }
  
  // Calculate session high and low
  const prices = data.map(d => d.price);
  const sessionHigh = Math.max(...prices);
  const sessionLow = Math.min(...prices);
  
  const sessionHighEl = document.getElementById("session-high");
  const sessionLowEl = document.getElementById("session-low");
  
  if (sessionHighEl) sessionHighEl.textContent = `$${sessionHigh.toFixed(2)}`;
  if (sessionLowEl) sessionLowEl.textContent = `$${sessionLow.toFixed(2)}`;
}

// Handle data source selection
function setupDataSourceSelector() {
  const dataSourceSelect = document.getElementById('data-source');
  if (!dataSourceSelect) return;
  
  dataSourceSelect.addEventListener('change', async function() {
    const selectedSource = this.value;
    console.log(`Data source changed to: ${selectedSource}`);
    
    if (conn) {
      try {
        let query = '';
        
        switch (selectedSource) {
          case 'nex':
            query = `SELECT * FROM market_analytics WHERE source LIKE 'NEX%' ORDER BY time DESC LIMIT 100`;
            break;
          case 'coinbase':
            query = `SELECT * FROM market_analytics WHERE source LIKE 'Coinbase%' ORDER BY time DESC LIMIT 100`;
            break;
          case 'both':
          default:
            query = `SELECT * FROM market_analytics ORDER BY time DESC LIMIT 100`;
            break;
        }
        
        const result = await conn.query(query);
        drawPlot(result.toArray());
      } catch (error) {
        console.error('Error filtering data source:', error);
      }
    }
  });
}

// Initialize DuckDB
(async () => {
  try {
    console.log("Initializing DuckDB...");
    const JSDELIVR_BUNDLES = await initDuckDB.getJsDelivrBundles();
    const bundle = await initDuckDB.selectBundle(JSDELIVR_BUNDLES);
    const duckdb = await initDuckDB(bundle.mainModule, bundle.pthreadWorker);
    
    db = new duckdb.AsyncDuckDB();
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    conn = await db.connect();
    
    // Create a more comprehensive table schema to handle both NEX Stream and Coinbase data
    await conn.query(`
      CREATE TABLE market_data(
        price DOUBLE, 
        time TEXT, 
        source TEXT, 
        subject TEXT
      )
    `);

    // Create a view for analytics
    await conn.query(`
      CREATE VIEW market_analytics AS
      SELECT 
        price,
        time,
        source,
        subject,
        AVG(price) OVER (PARTITION BY source ORDER BY time ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) as moving_avg_5,
        LAG(price, 1) OVER (PARTITION BY source ORDER BY time) as prev_price,
        (price - LAG(price, 1) OVER (PARTITION BY source ORDER BY time)) / LAG(price, 1) OVER (PARTITION BY source ORDER BY time) * 100 as pct_change
      FROM market_data
    `);

    console.log("DuckDB-WASM ready with enhanced schema");
    
    // Generate some initial mock data
    const now = new Date();
    const sources = ["NEX Stream (simulated)", "Coinbase (simulated)"];
    const subjects = ["market.btc-usd.trades", "ticker"];
    
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - (10 - i) * 60000).toISOString();
      
      // Generate data for both sources
      for (let s = 0; s < sources.length; s++) {
        const price = 30000 + Math.random() * 1000;
        const source = sources[s];
        const subject = subjects[s];
        
        await conn.insertValues("market_data", [[price, time, source, subject]]);
        rows.push({ price, time, source, subject });
      }
    }
    
    // Draw initial plot with analytics
    const result = await conn.query(`
      SELECT * FROM market_analytics 
      WHERE source = 'NEX Stream (simulated)'
      ORDER BY time ASC
    `);
    
    // Update UI to show we're using simulated data initially
    updateDataSourceInfo("NEX Stream (simulated)");
    
    // Draw the initial plot
    drawPlot(result.toArray());
    
    // Setup UI event handlers
    setupDataSourceSelector();
    
    console.log("Initial data loaded and visualized");
  } catch (error) {
    console.error("Error initializing DuckDB:", error);
    // If DuckDB fails to initialize, we can still show a chart with mock data
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - (10 - i) * 60000).toISOString();
      const price = 30000 + Math.random() * 1000;
      const source = "Simulated (fallback)";
      const subject = "ticker";
      rows.push({ price, time, source, subject });
    }
    
    // Update UI to show we're using fallback data
    updateDataSourceInfo("Simulated (fallback)");
    
    // Draw the fallback plot
    drawPlot(rows);
  }
})();

