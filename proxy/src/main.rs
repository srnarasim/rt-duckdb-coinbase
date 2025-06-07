use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::collections::HashMap;
use std::error::Error as StdError;

use tokio::sync::mpsc;
use tokio::time::interval;
use warp::{Filter, ws::{Message, WebSocket}};
use futures::{StreamExt, SinkExt};
use serde::{Serialize, Deserialize};
use rand::{Rng, thread_rng};
use chrono::Utc;
use log::{info, error, warn};
use clap::Parser;

// Command line arguments
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Port to listen on
    #[arg(short, long, default_value_t = 3030)]
    port: u16,

    /// Enable simulated data mode
    #[arg(short, long)]
    simulate: bool,

    /// Real NEX Stream URL (if not simulating)
    #[arg(short, long, default_value = "")]
    nex_url: String,
}

// NEX Stream message structure
#[derive(Serialize, Deserialize, Debug, Clone)]
struct NexStreamMessage {
    subject: String,
    data: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    timestamp: Option<u64>,
}

// Client subscription information
#[derive(Debug, Clone)]
struct Client {
    id: String,
    subscriptions: Vec<String>,
    tx: mpsc::UnboundedSender<Result<Message, warp::Error>>,
}

// Shared state
type Clients = Arc<Mutex<HashMap<String, Client>>>;

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::init();
    
    // Parse command line arguments
    let args = Args::parse();
    
    // Shared state
    let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
    
    // Clone for data generator
    let clients_for_generator = clients.clone();
    
    // Start data generator if in simulation mode
    if args.simulate {
        info!("Starting in simulation mode");
        tokio::spawn(generate_simulated_data(clients_for_generator));
    } else if !args.nex_url.is_empty() {
        info!("Connecting to real NEX Stream at: {}", args.nex_url);
        // TODO: Implement real NEX Stream connection
        // This would connect to the actual NEX Stream and forward messages
    } else {
        warn!("No NEX Stream URL provided and simulation disabled. Proxy will only relay WebSocket connections.");
    }
    
    // WebSocket route
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(with_clients(clients.clone()))
        .map(|ws: warp::ws::Ws, clients| {
            ws.on_upgrade(move |socket| handle_connection(socket, clients))
        });
    
    // CORS configuration
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type", "Authorization"]);
    
    // Health check route
    let health_route = warp::path("health")
        .map(|| "NEX Stream Proxy is running");
    
    // Combine routes
    let routes = ws_route
        .or(health_route)
        .with(cors)
        .with(warp::log("nex_proxy"));
    
    // Start the server
    info!("Starting NEX Stream proxy server on port {}", args.port);
    warp::serve(routes)
        .run(([0, 0, 0, 0], args.port))
        .await;
}

// Helper function to pass clients to route handlers
fn with_clients(clients: Clients) -> impl Filter<Extract = (Clients,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || clients.clone())
}

// Handle WebSocket connection
async fn handle_connection(ws: WebSocket, clients: Clients) {
    // Split the socket into sender and receiver
    let (ws_tx, mut ws_rx) = ws.split();
    
    // Use an unbounded channel to handle buffering and flushing of messages
    let (tx, mut rx) = mpsc::unbounded_channel();
    
    // Generate a client ID
    let client_id = format!("client-{}", rand::thread_rng().gen::<u32>());
    info!("New client connected: {}", client_id);
    
    // Create a new client
    let client = Client {
        id: client_id.clone(),
        subscriptions: vec![],
        tx,
    };
    
    // Add the client to our map
    clients.lock().unwrap().insert(client_id.clone(), client);
    
    // Forward messages from rx to the WebSocket
    tokio::task::spawn(async move {
        let mut ws_tx = ws_tx;
        while let Some(message) = rx.recv().await {
            match message {
                Ok(msg) => {
                    if let Err(e) = ws_tx.send(msg).await {
                        error!("WebSocket send error: {}", e);
                        break;
                    }
                },
                Err(e) => {
                    error!("Message error: {}", e);
                    break;
                }
            }
        }
    });
    
    // Handle incoming messages
    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                // Process the message
                if let Err(e) = process_message(msg, &client_id, &clients).await {
                    error!("Error processing message: {}", e);
                    break;
                }
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
        }
    }
    
    // Client disconnected
    info!("Client disconnected: {}", client_id);
    clients.lock().unwrap().remove(&client_id);
}

// Process incoming WebSocket messages
async fn process_message(msg: Message, client_id: &str, clients: &Clients) -> Result<(), Box<dyn StdError>> {
    // Skip processing non-text messages
    if !msg.is_text() {
        return Ok(());
    }
    
    let text = match msg.to_str() {
        Ok(text) => text,
        Err(_) => return Err("Message is not valid UTF-8".into()),
    };
    info!("Received message from {}: {}", client_id, text);
    
    // Try to parse as a subscription message
    if let Ok(subscription) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(action) = subscription.get("action").and_then(|a| a.as_str()) {
            if action == "subscribe" {
                if let Some(subject) = subscription.get("subject").and_then(|s| s.as_str()) {
                    // Add subscription
                    let mut clients_lock = clients.lock().unwrap();
                    if let Some(client) = clients_lock.get_mut(client_id) {
                        client.subscriptions.push(subject.to_string());
                        info!("Client {} subscribed to {}", client_id, subject);
                        
                        // Send confirmation
                        let confirmation = serde_json::json!({
                            "type": "subscription_confirmed",
                            "subject": subject,
                            "time": Utc::now().to_rfc3339()
                        });
                        
                        client.tx.send(Ok(Message::text(confirmation.to_string())))?;
                    }
                }
            }
        }
    }
    
    Ok(())
}

// Generate simulated NEX Stream data
async fn generate_simulated_data(clients: Clients) {
    let mut interval = interval(Duration::from_millis(1000));
    
    // Initial price (using thread_rng in a way that doesn't hold it across awaits)
    let mut price = 30000.0 + thread_rng().gen_range(0.0..2000.0);
    
    loop {
        interval.tick().await;
        
        // Update price with some random movement (create a new rng each time)
        let change_pct = thread_rng().gen_range(-0.5..0.5);
        price = price * (1.0 + change_pct / 100.0);
        
        // Create NEX Stream message
        let now = Utc::now();
        let timestamp = now.timestamp_millis() as u64;
        
        // Create a new rng for each use
        let mut rng = thread_rng();
        let size = rng.gen_range(0.001..1.0);
        let side = if rng.gen_bool(0.5) { "buy" } else { "sell" };
        
        let message = NexStreamMessage {
            subject: "market.btc-usd.trades".to_string(),
            data: serde_json::json!({
                "price": price,
                "size": size,
                "side": side,
                "exchange": "nex",
                "pair": "BTC-USD"
            }),
            timestamp: Some(timestamp),
        };
        
        // Serialize to JSON
        let message_json = serde_json::to_string(&message).unwrap();
        
        // Send to all subscribed clients
        let clients_lock = clients.lock().unwrap();
        for (_, client) in clients_lock.iter() {
            if client.subscriptions.contains(&message.subject) || 
               client.subscriptions.contains(&"*".to_string()) {
                if let Err(e) = client.tx.send(Ok(Message::text(&message_json))) {
                    error!("Error sending message to client: {}", e);
                }
            }
        }
    }
}