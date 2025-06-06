import initDuckDB from '../static/duckdb-wasm.js';

let db, conn, plot;
const rows = [];

export async function send_to_js(raw) {
  const msg = JSON.parse(raw);
  if (msg.type !== "ticker") return;

  rows.push([msg.price, msg.time]);

  if (rows.length > 100) rows.shift(); // keep it small

  await conn.insertValues("btc", [rows[rows.length - 1]]);
  const result = await conn.query("SELECT * FROM btc ORDER BY time DESC LIMIT 100");

  drawPlot(result.toArray());
}

async function drawPlot(data) {
  const el = document.getElementById("chart");
  el.innerHTML = "";
  const plotElement = Plot.plot({
    marks: [Plot.line(data, { x: "time", y: "price" })],
    x: { type: "utc" },
    y: { label: "BTC Price (USD)" },
    height: 300,
    width: 600
  });
  el.appendChild(plotElement);
}

(async () => {
  const JSDELIVR_BUNDLES = await initDuckDB.getJsDelivrBundles();
  const bundle = await initDuckDB.selectBundle(JSDELIVR_BUNDLES);
  const duckdb = await initDuckDB(bundle.mainModule, bundle.pthreadWorker);
  
  db = new duckdb.AsyncDuckDB();
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  await conn.query("CREATE TABLE btc(price DOUBLE, time TEXT)");

  console.log("DuckDB-WASM ready");
})();

