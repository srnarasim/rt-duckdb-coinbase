import initDuckDB from '../static/duckdb-wasm.js';

let db, conn;
const rows = [];

export async function send_to_js(raw) {
  try {
    const msg = JSON.parse(raw);
    if (msg.type !== "ticker") return;

    console.log("Received ticker data:", msg);
    
    // Extract price and time
    const price = parseFloat(msg.price);
    const time = new Date(msg.time).toISOString();
    
    rows.push({ price, time });

    if (rows.length > 100) rows.shift(); // keep it small

    // Insert into DuckDB if connection is established
    if (conn) {
      try {
        await conn.insertValues("btc", [[price, time]]);
        const result = await conn.query("SELECT * FROM btc ORDER BY time DESC LIMIT 100");
        drawPlot(result.toArray());
      } catch (dbError) {
        console.error("DuckDB error:", dbError);
        // Fallback to using the rows array directly if DuckDB fails
        drawPlot(rows);
      }
    } else {
      // If DuckDB is not ready yet, just use the rows array
      drawPlot(rows);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    console.log("Raw message:", raw);
  }
}

function drawPlot(data) {
  try {
    const el = document.getElementById("chart");
    if (!el) {
      console.error("Chart element not found");
      return;
    }
    
    // Clear previous content
    el.innerHTML = "";
    
    // Check if Plot is available
    if (typeof Plot !== 'undefined') {
      const plotElement = Plot.plot({
        marks: [Plot.line(data, { x: "time", y: "price" })],
        x: { type: "utc" },
        y: { label: "BTC Price (USD)" },
        height: 300,
        width: 600
      });
      el.appendChild(plotElement);
    } else {
      // Fallback if Plot is not available
      console.error("Plot library not loaded");
      el.textContent = "Chart library not loaded. Data: " + JSON.stringify(data.slice(0, 5));
    }
  } catch (error) {
    console.error("Error drawing plot:", error);
  }
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
    await conn.query("CREATE TABLE btc(price DOUBLE, time TEXT)");

    console.log("DuckDB-WASM ready");
    
    // Generate some initial mock data
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - (10 - i) * 60000).toISOString();
      const price = 30000 + Math.random() * 1000;
      await conn.insertValues("btc", [[price, time]]);
      rows.push({ price, time });
    }
    
    // Draw initial plot
    const result = await conn.query("SELECT * FROM btc ORDER BY time ASC");
    drawPlot(result.toArray());
  } catch (error) {
    console.error("Error initializing DuckDB:", error);
    // If DuckDB fails to initialize, we can still show a chart with mock data
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - (10 - i) * 60000).toISOString();
      const price = 30000 + Math.random() * 1000;
      rows.push({ price, time });
    }
    drawPlot(rows);
  }
})();

