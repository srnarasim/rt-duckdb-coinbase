use std::error::Error;
use std::net::TcpStream;
use std::io::Write;
use std::time::Duration;

use chrono::Utc;
use clap::Parser;
use log::{info, error, warn};
use rand::{Rng, thread_rng};
use serde::{Serialize, Deserialize};
use tokio::time::sleep;

// Command line arguments
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Server address to publish to
    #[arg(short, long, default_value = "127.0.0.1:3030")]
    server: String,

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
    
    // Start publishing simulated data
    publish_simulated_data(
        args.server, 
        args.interval, 
        args.initial_price, 
        args.volatility
    ).await?;
    
    Ok(())
}

// Publish simulated data to WebSocket server
async fn publish_simulated_data(
    server: String,
    interval: u64,
    initial_price: f64,
    volatility: f64,
) -> Result<(), Box<dyn Error>> {
    info!("Starting to publish simulated data to {}", server);
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
            exchange: "simple".to_string(),
            pair: "BTC-USD".to_string(),
            timestamp,
        };
        
        // Serialize to JSON
        let json_data = serde_json::to_string(&trade)?;
        
        // Try to connect and send data
        match TcpStream::connect(&server) {
            Ok(mut stream) => {
                if let Err(e) = stream.write_all(json_data.as_bytes()) {
                    error!("Failed to send data: {}", e);
                } else {
                    info!("Published: {} ${:.2} | Size: {:.4} | Side: {}", 
                          trade.pair, trade.price, trade.size, trade.side);
                }
            },
            Err(e) => {
                error!("Failed to connect to server: {}", e);
            }
        }
        
        // Wait for the next interval
        sleep(Duration::from_millis(interval)).await;
    }
}