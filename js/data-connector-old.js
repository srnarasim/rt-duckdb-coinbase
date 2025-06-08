/**
 * Data Connector Module
 * Handles WebSocket connections to live cryptocurrency exchanges
 */
class DataConnector {
  constructor(onData) {
    this.onData = onData;
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Define exchange configurations
    this.exchanges = {
      coinbase: {
        url: 'wss://ws-feed.exchange.coinbase.com',
        name: 'Coinbase Pro',
        symbol: 'BTC-USD',
        subscribeMessage: {
          type: 'subscribe',
          product_ids: ['BTC-USD'],
          channels: ['matches']
        }
      },
      binance: {
        url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
        name: 'Binance',
        symbol: 'BTCUSDT',
        subscribeMessage: null // Binance auto-subscribes to the stream in URL
      },
      kraken: {
        url: 'wss://ws.kraken.com',
        name: 'Kraken',
        symbol: 'XBT/USD',
        subscribeMessage: {
          event: 'subscribe',
          pair: ['XBT/USD'],
          subscription: { name: 'trade' }
        }
      }
    };
  }
  
  connect(exchangeNames = ['coinbase']) {
    console.log("🔌 Connecting to live cryptocurrency exchanges:", exchangeNames);
    
    exchangeNames.forEach(exchangeName => {
      if (!this.exchanges[exchangeName]) {
        console.error(`❌ Unknown exchange: ${exchangeName}`);
        return;
      }
      
      this.connectToExchange(exchangeName);
    });
  }
  
  connectToExchange(exchangeName) {
    const exchange = this.exchanges[exchangeName];
    console.log(`🔌 Connecting to ${exchange.name} at ${exchange.url}...`);
    
    try {
      const socket = new WebSocket(exchange.url);
      
      socket.onopen = () => {
        console.log(`✅ ${exchange.name} WebSocket connected successfully`);
        this.connections.set(exchangeName, socket);
        this.reconnectAttempts.set(exchangeName, 0);
        
        // Subscribe to trades if needed
        if (exchange.subscribeMessage) {
          socket.send(JSON.stringify(exchange.subscribeMessage));
          console.log(`📡 Subscribed to ${exchange.name} ${exchange.symbol} trades`);
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data);
          const normalizedData = this.normalizeTradeData(exchangeName, rawData);
          
          if (normalizedData) {
            this.onData(normalizedData);
          }
        } catch (e) {
          console.error(`❌ Error parsing ${exchange.name} data:`, e);
          console.error("Raw data:", event.data);
        }
      };
      
      socket.onclose = (event) => {
        this.connections.delete(exchangeName);
        console.log(`🔌 ${exchange.name} connection closed: ${event.code} ${event.reason}`);
        
        const attempts = this.reconnectAttempts.get(exchangeName) || 0;
        if (attempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * this.reconnectAttempts;
          console.log(`Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
          
          setTimeout(() => this.connect(), delay);
        } else {
          console.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
          // Notify the user that we're in simulation mode now
          document.getElementById('connection-status').textContent = 'Disconnected - Using Simulation';
          document.getElementById('connection-status').classList.add('disconnected');
          
          // Start simulation mode
          this.startSimulation();
        }
      };
      
      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (e) {
      console.error("Error creating WebSocket:", e);
      this.startSimulation();
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
  
  startSimulation() {
    console.log("Starting simulation mode...");
    
    // Generate simulated data every second
    this.simulationInterval = setInterval(() => {
      const lastPrice = window.lastPrice || 30000;
      const change = (Math.random() - 0.5) * lastPrice * 0.01; // +/- 0.5% change
      const newPrice = lastPrice + change;
      window.lastPrice = newPrice;
      
      const simulatedData = {
        subject: "market.btc-usd.trades",
        data: {
          price: newPrice,
          size: Math.random() * 1.0,
          side: Math.random() > 0.5 ? "buy" : "sell",
          exchange: "simulation",
          pair: "BTC-USD"
        },
        timestamp: Date.now()
      };
      
      this.onData(simulatedData);
    }, 1000);
  }
  
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}