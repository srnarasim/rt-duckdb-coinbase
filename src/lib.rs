use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::{MessageEvent, WebSocket};

#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    let ws = WebSocket::new("wss://ws-feed.exchange.coinbase.com")?;
    
    let onmessage_callback = Closure::<dyn FnMut(_)>::new(move |event: MessageEvent| {
        if let Ok(data) = event.data().as_string() {
            let _ = send_to_js(&data);
        }
    });
    ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
    onmessage_callback.forget();

    // Subscribe to BTC-USD ticker
    let sub_msg = r#"{
        "type": "subscribe",
        "channels": [{ "name": "ticker", "product_ids": ["BTC-USD"] }]
    }"#;
    ws.send_with_str(sub_msg)?;

    Ok(())
}

#[wasm_bindgen(module = "/js/duckdb.js")]
extern "C" {
    fn send_to_js(data: &str);
}

