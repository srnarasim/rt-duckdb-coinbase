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
    this.simulationInterval = null;
    
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
        
        // Update connection status
        this.updateConnectionStatus();
        
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
        
        this.updateConnectionStatus();
        
        const attempts = this.reconnectAttempts.get(exchangeName) || 0;
        if (attempts < this.maxReconnectAttempts) {
          this.reconnectAttempts.set(exchangeName, attempts + 1);
          const delay = this.reconnectDelay * (attempts + 1);
          console.log(`🔄 Reconnecting to ${exchange.name} (attempt ${attempts + 1}/${this.maxReconnectAttempts}) in ${delay}ms...`);
          
          setTimeout(() => this.connectToExchange(exchangeName), delay);
        } else {
          console.error(`❌ Failed to reconnect to ${exchange.name} after ${this.maxReconnectAttempts} attempts`);
          
          // If no connections left, start simulation
          if (this.connections.size === 0) {
            this.startSimulation();
          }
        }
      };
      
      socket.onerror = (error) => {
        console.error(`❌ ${exchange.name} WebSocket error:`, error);
        
        // Specific handling for common WebSocket errors
        if (error.type === 'error') {
          console.warn(`⚠️ ${exchange.name} connection failed - this is normal if the exchange is unreachable`);
        }
      };
    } catch (e) {
      console.error(`❌ Error creating WebSocket for ${exchange.name}:`, e);
      
      // If this was the only exchange, start simulation
      if (exchangeNames.length === 1) {
        this.startSimulation();
      }
    }
  }
  
  normalizeTradeData(exchangeName, rawData) {
    const exchange = this.exchanges[exchangeName];
    
    try {
      switch (exchangeName) {
        case 'coinbase':
          // Coinbase Pro format
          if (rawData.type === 'match') {
            return {
              timestamp: Date.now(),
              data: {
                price: parseFloat(rawData.price),
                size: parseFloat(rawData.size),
                side: rawData.side,
                exchange: 'coinbase',
                pair: 'BTC-USD'
              }
            };
          }
          break;
          
        case 'binance':
          // Binance format
          if (rawData.e === 'trade') {
            return {
              timestamp: rawData.T, // Trade time
              data: {
                price: parseFloat(rawData.p),
                size: parseFloat(rawData.q),
                side: rawData.m ? 'sell' : 'buy', // m = true means market maker (sell)
                exchange: 'binance',
                pair: 'BTC-USD'
              }
            };
          }
          break;
          
        case 'kraken':
          // Kraken format
          if (Array.isArray(rawData) && rawData[1] && rawData[2] === 'trade') {
            const trades = rawData[1];
            if (trades && trades.length > 0) {
              const trade = trades[0]; // Get first trade
              return {
                timestamp: Date.now(),
                data: {
                  price: parseFloat(trade[0]),
                  size: parseFloat(trade[1]),
                  side: trade[3] === 'b' ? 'buy' : 'sell',
                  exchange: 'kraken',
                  pair: 'BTC-USD'
                }
              };
            }
          }
          break;
      }
    } catch (e) {
      console.error(`❌ Error normalizing ${exchange.name} data:`, e, rawData);
    }
    
    return null;
  }
  
  updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    
    const connectedExchanges = Array.from(this.connections.keys());
    
    if (connectedExchanges.length > 0) {
      statusElement.textContent = `Connected (${connectedExchanges.join(', ')})`;
      statusElement.className = 'connection-status connected';
    } else {
      statusElement.textContent = 'Connecting...';
      statusElement.className = 'connection-status connecting';
    }
  }
  
  disconnect() {
    console.log("🔌 Disconnecting from all exchanges...");
    
    // Close all connections
    this.connections.forEach((socket, exchangeName) => {
      socket.close();
      console.log(`🔌 Disconnected from ${this.exchanges[exchangeName].name}`);
    });
    
    this.connections.clear();
    this.reconnectAttempts.clear();
    
    // Stop simulation if running
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    this.updateConnectionStatus();
  }
  
  startSimulation() {
    if (this.simulationInterval) {
      return; // Already running
    }
    
    console.log("🎭 Starting simulation mode...");
    
    // Update connection status
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.textContent = 'Simulation Mode';
      statusElement.className = 'connection-status simulation';
    }
    
    // Generate simulated data every 1-3 seconds
    let lastPrice = 31000 + (Math.random() - 0.5) * 2000; // Start around $31k
    
    this.simulationInterval = setInterval(() => {
      // Random walk with slight upward bias
      const change = (Math.random() - 0.48) * lastPrice * 0.002; // +/- 0.1% change with slight upward bias
      lastPrice = Math.max(20000, Math.min(50000, lastPrice + change)); // Keep between $20k-$50k
      
      const simulatedData = {
        timestamp: Date.now(),
        data: {
          price: lastPrice,
          size: Math.random() * 0.5 + 0.01, // 0.01 to 0.51 BTC
          side: Math.random() > 0.5 ? "buy" : "sell",
          exchange: "simulation",
          pair: "BTC-USD"
        }
      };
      
      this.onData(simulatedData);
    }, 1000 + Math.random() * 2000); // 1-3 second intervals
  }
  
  getConnectionInfo() {
    const connectedExchanges = Array.from(this.connections.keys());
    return {
      connected: connectedExchanges.length > 0,
      exchanges: connectedExchanges,
      simulation: !!this.simulationInterval
    };
  }
}