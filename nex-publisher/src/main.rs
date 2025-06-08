use std::error::Error;
use std::time::Duration;

use async_nats::Client;
use chrono::Utc;
use clap::Parser;
use log::{info, error, warn};
use rand::{Rng, thread_rng};
use serde::{Serialize, Deserialize};
use serde_json::json;
use tokio::time::sleep;
use url::Url;

// Command line arguments
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// NATS server URL
    #[arg(short, long, default_value = "nats://localhost:4222")]
    nats_url: String,

    /// Subject to publish to
    #[arg(short, long, default_value = "market.btc-usd.trades")]
    subject: String,

    /// Interval between messages in milliseconds
    #[arg(short, long, default_value_t = 1000)]
    interval: u64,

    /// Initial price
    #[arg(short, long, default_value_t = 30000.0)]
    initial_price: f64,

    /// Volatility (percentage)
    #[arg(short, long, default_value_t = 0.5)]
    volatility: f64,
}

// Trade data structure
#[derive(Serialize, Deserialize, Debug)]
struct TradeData {
    price: f64,
    size: f64,
    side: String,
    exchange: String,
    pair: String,
    timestamp: u64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Initialize logging
    env_logger::init();
    
    // Parse command line arguments
    let args = Args::parse();
    
    // Connect to NATS server
    info!("Connecting to NATS server at {}", args.nats_url);
    
    // Parse the URL to extract credentials if present
    let url = Url::parse(&args.nats_url)?;
    
    // Extract username and password if present in the URL
    let username = url.username();
    let password = url.password().unwrap_or("");
    
    // Build connection options
    let mut options = async_nats::ConnectOptions::new();
    
    // Add authentication if credentials are provided
    if !username.is_empty() {
        options = options.user_and_password(username.to_string(), password.to_string());
    }
    
    // Connect to NATS server
    let client = match options.connect(&args.nats_url).await {
        Ok(client) => {
            info!("Successfully connected to NATS server");
            client
        },
        Err(e) => {
            error!("Failed to connect to NATS server: {}", e);
            return Err(Box::new(e));
        }
    };
    
    // Start publishing simulated data
    publish_simulated_data(
        client, 
        args.subject, 
        args.interval, 
        args.initial_price, 
        args.volatility
    ).await?;
    
    Ok(())
}

// Publish simulated data to NATS
async fn publish_simulated_data(
    client: Client,
    subject: String,
    interval: u64,
    initial_price: f64,
    volatility: f64,
) -> Result<(), Box<dyn Error>> {
    info!("Starting to publish simulated data to {}", subject);
    info!("Initial price: ${:.2}, Volatility: {:.2}%, Interval: {}ms", 
          initial_price, volatility, interval);
    
    // Current price, starting with the initial price
    let mut price = initial_price;
    
    // Publish loop
    loop {
        // Update price with random movement
        let change_pct = thread_rng().gen_range(-volatility..volatility);
        price = price * (1.0 + change_pct / 100.0);
        
        // Generate random trade size
        let size = thread_rng().gen_range(0.001..1.0);
        
        // Randomly choose buy or sell
        let side = if thread_rng().gen_bool(0.5) { "buy" } else { "sell" };
        
        // Current timestamp
        let timestamp = Utc::now().timestamp_millis() as u64;
        
        // Create trade data
        let trade = TradeData {
            price,
            size,
            side: side.to_string(),
            exchange: "nex".to_string(),
            pair: "BTC-USD".to_string(),
            timestamp,
        };
        
        // Serialize to JSON
        let json_data = serde_json::to_string(&trade)?;
        
        // Publish to NATS
        match client.publish(subject.clone(), json_data.into()).await {
            Ok(_) => {
                info!("Published: {} ${:.2} | Size: {:.4} | Side: {}", 
                      trade.pair, trade.price, trade.size, trade.side);
            },
            Err(e) => {
                error!("Failed to publish message: {}", e);
            }
        }
        
        // Wait for the next interval
        sleep(Duration::from_millis(interval)).await;
    }
}