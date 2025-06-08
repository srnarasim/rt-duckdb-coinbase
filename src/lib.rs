use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::{MessageEvent, WebSocket, console};
use serde::{Serialize, Deserialize};
use serde_json::json;

mod duckdb_wasm;
pub use duckdb_wasm::*;

// Define NEX Stream message structure
#[derive(Serialize, Deserialize, Debug)]
struct NexStreamMessage {
    subject: String,
    data: serde_json::Value,
    timestamp: Option<u64>,
}

#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    // Connect to NEX Stream via our proxy
    let nex_stream_url = "ws://localhost:3030/ws";
    
    console::log_1(&format!("Connecting to NEX Stream via proxy at {}...", nex_stream_url).into());
    
    let ws = match WebSocket::new(nex_stream_url) {
        Ok(socket) => socket,
        Err(_) => {
            console::error_1(&"Failed to connect to NEX Stream proxy, falling back to Coinbase".into());
            // Fallback to Coinbase if NEX Stream connection fails
            WebSocket::new("wss://ws-feed.exchange.coinbase.com")?
        }
    };
    
    // Set up connection open handler
    let onopen_callback = Closure::<dyn FnMut()>::new(move || {
        console::log_1(&"WebSocket connection established".into());
    });
    ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
    onopen_callback.forget();
    
    // Set up error handler
    let onerror_callback = Closure::<dyn FnMut(_)>::new(move |e: JsValue| {
        console::error_1(&format!("WebSocket error: {:?}", e).into());
    });
    ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
    onerror_callback.forget();
    
    // Set up message handler
    let onmessage_callback = Closure::<dyn FnMut(_)>::new(move |event: MessageEvent| {
        if let Some(data) = event.data().as_string() {
            // Try to parse as NEX Stream message
            match serde_json::from_str::<NexStreamMessage>(&data) {
                Ok(nex_msg) => {
                    // Process NEX Stream message
                    let transformed_data = transform_nex_data(&nex_msg);
                    let _ = send_to_js(&transformed_data);
                },
                Err(_) => {
                    // If not a NEX Stream message, pass through as is (e.g., Coinbase data)
                    let _ = send_to_js(&data);
                }
            }
        }
    });
    ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
    onmessage_callback.forget();

    // Try to subscribe to NEX Stream
    let nex_sub_msg = json!({
        "action": "subscribe",
        "subject": "market.btc-usd.trades"
    }).to_string();
    
    // Also set up a fallback subscription for Coinbase
    let coinbase_sub_msg = r#"{
        "type": "subscribe",
        "channels": [{ "name": "ticker", "product_ids": ["BTC-USD"] }]
    }"#;
    
    // Send subscription message
    match ws.send_with_str(&nex_sub_msg) {
        Ok(_) => console::log_1(&"Sent NEX Stream subscription".into()),
        Err(_) => {
            console::error_1(&"Failed to send NEX Stream subscription, trying Coinbase".into());
            ws.send_with_str(coinbase_sub_msg)?;
        }
    };

    Ok(())
}

// Transform NEX Stream data to a format compatible with our application
fn transform_nex_data(nex_msg: &NexStreamMessage) -> String {
    // Extract relevant data from NEX Stream message
    // This is a simplified example - adjust based on actual NEX Stream data format
    let price = nex_msg.data.get("price")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    
    let timestamp = nex_msg.timestamp
        .unwrap_or_else(|| js_sys::Date::now() as u64);
    
    // Create a timestamp string in ISO format
    let date = js_sys::Date::new_0();
    date.set_time(timestamp as f64);
    let time = date.to_iso_string().as_string().unwrap_or_default();
    
    // Create a message in the format expected by our JavaScript code
    json!({
        "type": "ticker",
        "price": price.to_string(),
        "time": time,
        "source": "nex_stream",
        "subject": nex_msg.subject
    }).to_string()
}

#[wasm_bindgen(module = "/js/duckdb.js")]
extern "C" {
    fn send_to_js(data: &str);
}

