/**
 * Data Connector Module
 * Handles WebSocket connection and data reception from NEX Stream
 */
class DataConnector {
  constructor(url, onData) {
    this.url = url;
    this.onData = onData;
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second delay
  }
  
  connect() {
    console.log(`Connecting to WebSocket at ${this.url}...`);
    
    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        console.log("WebSocket connected successfully");
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to BTC-USD trades
        this.socket.send(JSON.stringify({
          action: "subscribe",
          subject: "market.btc-usd.trades"
        }));
        
        console.log("Subscribed to market.btc-usd.trades");
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onData(data);
        } catch (e) {
          console.error("Error parsing WebSocket data:", e);
          console.error("Raw data:", event.data);
        }
      };
      
      this.socket.onclose = (event) => {
        this.connected = false;
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
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