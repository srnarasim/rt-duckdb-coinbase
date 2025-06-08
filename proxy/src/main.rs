use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::collections::HashMap;
use std::error::Error as StdError;
use std::path::Path;

use tokio::sync::mpsc;
use tokio::time::interval;
use warp::{Filter, ws::{Message, WebSocket}};
use futures::{StreamExt, SinkExt};
use serde::{Serialize, Deserialize};
use rand::{Rng, thread_rng};
use chrono::Utc;
use log::{info, error, warn, debug};
use clap::Parser;
use url::Url;
use async_nats::jetstream;

// Command line arguments
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Port to listen on for WebSocket proxy
    #[arg(short, long, default_value_t = 3030)]
    proxy_port: u16,

    /// Port to listen on for HTTP server
    #[arg(short = 'P', long, default_value_t = 54572)]
    http_port: u16,

    /// Enable simulated data mode
    #[arg(short, long)]
    simulate: bool,

    /// Real NEX Stream URL (if not simulating)
    #[arg(short, long, default_value = "")]
    nex_url: String,
    
    /// Directory to serve static files from
    #[arg(short, long, default_value = "../")]
    static_dir: String,
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
        let nex_url = args.nex_url.clone();
        tokio::spawn(async move {
            if let Err(e) = connect_to_nex_stream(nex_url, clients_for_generator).await {
                error!("NEX Stream connection error: {}", e);
            }
        });
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
    
    // Combine routes for proxy server
    let proxy_routes = ws_route
        .or(health_route)
        .with(cors.clone())
        .with(warp::log("nex_proxy"));
    
    // Start the proxy server
    info!("Starting NEX Stream proxy server on port {}", args.proxy_port);
    let proxy_server = warp::serve(proxy_routes)
        .run(([0, 0, 0, 0], args.proxy_port));
    
    // Create static file server
    let static_dir = args.static_dir.clone();
    info!("Serving static files from directory: {}", static_dir);
    
    // Favicon handler
    let static_dir_clone = static_dir.clone();
    let favicon_route = warp::path("favicon.ico")
        .and_then(move || {
            let path = Path::new(&static_dir_clone).join("favicon.ico");
            async move {
                if path.exists() {
                    match tokio::fs::read(&path).await {
                        Ok(content) => {
                            Ok(warp::reply::with_header(
                                content,
                                "Content-Type",
                                "image/x-icon",
                            ))
                        },
                        Err(_) => {
                            // Return an empty favicon if we can't read the file
                            Ok(warp::reply::with_header(
                                warp::reply::html(""),
                                "Content-Type",
                                "image/x-icon",
                            ))
                        }
                    }
                } else {
                    // Return an empty favicon to prevent 404 errors
                    Ok(warp::reply::with_header(
                        warp::reply::html(""),
                        "Content-Type",
                        "image/x-icon",
                    ))
                }
            }
        });
    
    // Custom handler for JavaScript files to ensure correct MIME type
    let js_files = warp::path::tail()
        .and(warp::fs::file(static_dir.clone()))
        .and_then(|tail: warp::path::Tail, file: warp::fs::File| async move {
            let path = tail.as_str();
            if path.ends_with(".js") {
                // Set the correct MIME type for JavaScript files
                Ok(warp::reply::with_header(file, "Content-Type", "application/javascript"))
            } else if path.ends_with(".wasm") {
                // Set the correct MIME type for WebAssembly files
                Ok(warp::reply::with_header(file, "Content-Type", "application/wasm"))
            } else {
                // For other files, let warp handle the MIME type
                Ok(file)
            }
        });
    
    // Static file server with custom MIME type handling
    let static_routes = warp::fs::dir(static_dir)
        .or(favicon_route)
        .or(js_files)
        .with(cors)
        .with(warp::log("static_server"));
    
    // Start the static file server
    info!("Starting static file server on port {}", args.http_port);
    let static_server = warp::serve(static_routes)
        .run(([0, 0, 0, 0], args.http_port));
    
    // Run both servers concurrently
    info!("Both servers are running. Press Ctrl+C to stop.");
    futures::join!(proxy_server, static_server);
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

// Connect to a real NEX Stream and forward messages to clients
async fn connect_to_nex_stream(nex_url: String, clients: Clients) -> Result<(), Box<dyn StdError>> {
    info!("Connecting to NEX Stream at {}", nex_url);
    
    // Parse the URL to extract credentials if present
    let url = Url::parse(&nex_url)?;
    
    // Extract username and password if present in the URL
    let username = url.username();
    let password = url.password().unwrap_or("");
    
    // Build connection options
    let mut options = async_nats::ConnectOptions::new();
    
    // Add authentication if credentials are provided
    if !username.is_empty() {
        options = options.with_auth_credentials(username.to_string(), password.to_string());
    }
    
    // Connect to NATS server
    info!("Establishing connection to NATS server...");
    let client = match options.connect(&nex_url).await {
        Ok(client) => {
            info!("Successfully connected to NATS server");
            client
        },
        Err(e) => {
            error!("Failed to connect to NATS server: {}", e);
            return Err(Box::new(e));
        }
    };
    
    // Create JetStream context if available
    let jetstream = jetstream::new(client.clone());
    
    // Subscribe to market data
    let mut subscriber = match client.subscribe("market.btc-usd.trades").await {
        Ok(sub) => {
            info!("Successfully subscribed to market.btc-usd.trades");
            sub
        },
        Err(e) => {
            error!("Failed to subscribe to market data: {}", e);
            return Err(Box::new(e));
        }
    };
    
    // Process incoming messages
    info!("Listening for messages from NEX Stream...");
    while let Some(msg) = subscriber.next().await {
        let payload = String::from_utf8_lossy(&msg.payload);
        debug!("Received message: {}", payload);
        
        // Try to parse the message
        match serde_json::from_str::<serde_json::Value>(&payload) {
            Ok(data) => {
                // Create a NEX Stream message
                let now = Utc::now();
                let timestamp = now.timestamp_millis() as u64;
                
                let message = NexStreamMessage {
                    subject: msg.subject.to_string(),
                    data: data,
                    timestamp: Some(timestamp),
                };
                
                // Serialize to JSON
                match serde_json::to_string(&message) {
                    Ok(message_json) => {
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
                    },
                    Err(e) => {
                        error!("Failed to serialize message: {}", e);
                    }
                }
            },
            Err(e) => {
                error!("Failed to parse message: {}", e);
            }
        }
    }
    
    info!("NEX Stream connection closed");
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