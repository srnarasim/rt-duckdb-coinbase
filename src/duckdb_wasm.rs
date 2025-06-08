use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use js_sys::Array;
use web_sys::console;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Serialize, Deserialize)]
pub struct TradeData {
    pub price: f64,
    pub size: f64,
    pub side: String,
    pub exchange: String,
    pub pair: String,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize)]
pub struct QueryResult {
    pub rows: Vec<serde_json::Value>,
}

#[wasm_bindgen]
pub struct DuckDBConnection {
    trades: Vec<TradeData>,
}

#[wasm_bindgen]
impl DuckDBConnection {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console::log_1(&"Creating new DuckDB connection".into());
        DuckDBConnection {
            trades: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn query(&mut self, sql: &str) -> Result<JsValue, JsValue> {
        console::log_1(&format!("Executing SQL: {}", sql).into());
        
        // Simple SQL parser to handle basic queries
        if sql.contains("CREATE TABLE") {
            // Just acknowledge the table creation
            return Ok(JsValue::TRUE);
        } else if sql.contains("INSERT") {
            // Just acknowledge the insert
            return Ok(JsValue::TRUE);
        } else if sql.contains("SELECT") {
            // Generate mock data for the chart
            let result = self.generate_mock_data();
            return Ok(JsValue::from_str(&serde_json::to_string(&result).unwrap()));
        }
        
        Ok(JsValue::TRUE)
    }

    #[wasm_bindgen]
    pub fn insert_values(&mut self, table: &str, values: JsValue) -> Result<JsValue, JsValue> {
        console::log_1(&format!("Inserting values into {}", table).into());
        
        // Parse the values from JavaScript
        let values_array: Array = values.dyn_into()?;
        
        for i in 0..values_array.length() {
            let row = values_array.get(i);
            let row_array: Array = row.dyn_into()?;
            
            if row_array.length() >= 6 {
                let price = row_array.get(0).as_f64().unwrap_or(0.0);
                let size = row_array.get(1).as_f64().unwrap_or(0.0);
                let side = row_array.get(2).as_string().unwrap_or_else(|| "unknown".to_string());
                let exchange = row_array.get(3).as_string().unwrap_or_else(|| "unknown".to_string());
                let pair = row_array.get(4).as_string().unwrap_or_else(|| "unknown".to_string());
                let timestamp = row_array.get(5).as_f64().unwrap_or(0.0) as u64;
                
                self.trades.push(TradeData {
                    price,
                    size,
                    side,
                    exchange,
                    pair,
                    timestamp,
                });
            }
        }
        
        Ok(JsValue::TRUE)
    }

    fn generate_mock_data(&self) -> QueryResult {
        let mut rows = Vec::new();
        let now = js_sys::Date::now() as u64;
        
        // Create more realistic data with price trends
        let mut price = 30000.0 + (js_sys::Math::random() * 2000.0);
        
        for i in 0..100 {
            // Add some randomness to the price
            price = price + (js_sys::Math::random() - 0.5) * 100.0;
            
            // Create a time point in the past
            let time = now - ((100 - i) * 60000) as u64;
            
            // Add moving averages and other analytics
            let data_point = serde_json::json!({
                "price": price,
                "time": time.to_string(),
                "source": "Simulated Data",
                "subject": "market.btc-usd.trades",
                "moving_avg_5": price + (js_sys::Math::random() - 0.5) * 20.0,
                "prev_price": price - (js_sys::Math::random() - 0.5) * 50.0,
                "pct_change": (js_sys::Math::random() - 0.5) * 1.0
            });
            
            rows.push(data_point);
        }
        
        QueryResult { rows }
    }
}

#[wasm_bindgen]
pub struct DuckDB {
    logger: Option<String>,
}

#[wasm_bindgen]
impl DuckDB {
    #[wasm_bindgen(constructor)]
    pub fn new(logger: Option<String>, _worker: Option<String>) -> Self {
        console::log_1(&"Creating new DuckDB instance".into());
        DuckDB { logger }
    }

    #[wasm_bindgen]
    pub fn instantiate(&self, _main_module: Option<String>, _pthread_worker: Option<String>) -> Result<DuckDB, JsValue> {
        console::log_1(&"DuckDB instantiated".into());
        Ok(self.clone())
    }

    #[wasm_bindgen]
    pub fn connect(&self) -> Result<DuckDBConnection, JsValue> {
        console::log_1(&"Connected to DuckDB".into());
        let connection = DuckDBConnection::new();
        Ok(connection)
    }
}

impl Clone for DuckDB {
    fn clone(&self) -> Self {
        DuckDB {
            logger: self.logger.clone(),
        }
    }
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn init_duckdb() -> DuckDB {
    init_panic_hook();
    DuckDB::new(None, None)
}