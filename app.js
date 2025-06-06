// Main application code
document.addEventListener('DOMContentLoaded', function() {
  console.log('App initialized');
  
  // Mock data for initial chart
  const mockData = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const time = new Date(now.getTime() - (20 - i) * 60000).toISOString();
    const price = 30000 + Math.random() * 1000;
    mockData.push({ time, price });
  }
  
  // Draw initial chart
  drawChart(mockData);
  
  // Connect to Coinbase WebSocket
  connectWebSocket();
});

// Global data store
const priceData = [];
const MAX_DATA_POINTS = 100;

// Connect to Coinbase WebSocket
function connectWebSocket() {
  console.log('Connecting to Coinbase WebSocket...');
  
  try {
    const socket = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    
    socket.onopen = function() {
      console.log('WebSocket connected');
      
      // Subscribe to BTC-USD ticker
      const subscribeMsg = {
        type: 'subscribe',
        channels: [{ name: 'ticker', product_ids: ['BTC-USD'] }]
      };
      
      socket.send(JSON.stringify(subscribeMsg));
    };
    
    socket.onmessage = function(event) {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'ticker') {
          console.log('Received ticker:', msg);
          
          // Process the data
          const price = parseFloat(msg.price);
          const time = new Date(msg.time).toISOString();
          
          // Add to our data store
          priceData.push({ time, price });
          
          // Keep data size manageable
          if (priceData.length > MAX_DATA_POINTS) {
            priceData.shift();
          }
          
          // Update the chart
          drawChart(priceData);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
    
    socket.onerror = function(error) {
      console.error('WebSocket error:', error);
      
      // If we can't connect to the real WebSocket, simulate data
      startDataSimulation();
    };
    
    socket.onclose = function() {
      console.log('WebSocket connection closed');
      
      // If connection closes, simulate data
      startDataSimulation();
    };
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    
    // If we can't create the WebSocket, simulate data
    startDataSimulation();
  }
}

// Simulate real-time data if WebSocket fails
function startDataSimulation() {
  console.log('Starting data simulation');
  
  // Only start if we haven't already
  if (!window.simulationInterval) {
    // Generate new data point every 2 seconds
    window.simulationInterval = setInterval(function() {
      const lastPrice = priceData.length > 0 
        ? priceData[priceData.length - 1].price 
        : 30000;
      
      // Random walk algorithm for price
      const change = (Math.random() - 0.5) * 100;
      const newPrice = lastPrice + change;
      const time = new Date().toISOString();
      
      priceData.push({ time, price: newPrice });
      
      // Keep data size manageable
      if (priceData.length > MAX_DATA_POINTS) {
        priceData.shift();
      }
      
      // Update the chart
      drawChart(priceData);
      
      console.log('Simulated price:', newPrice);
    }, 2000);
  }
}

// Draw the chart with the provided data
function drawChart(data) {
  const chartElement = document.getElementById('chart');
  if (!chartElement) {
    console.error('Chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  chartElement.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw chart background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw axes
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(50, 20);
  ctx.lineTo(50, canvas.height - 30);
  ctx.lineTo(canvas.width - 20, canvas.height - 30);
  ctx.stroke();
  
  // Add y-axis label
  ctx.save();
  ctx.translate(15, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText('BTC Price (USD)', 0, 0);
  ctx.restore();
  
  // Draw data if available
  if (data.length > 1) {
    // Find min/max values for scaling
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = new Date(data[0].time).getTime();
    let maxX = new Date(data[data.length - 1].time).getTime();
    
    data.forEach(d => {
      const yVal = parseFloat(d.price);
      minY = Math.min(minY, yVal);
      maxY = Math.max(maxY, yVal);
    });
    
    // Add some padding
    minY = minY * 0.99;
    maxY = maxY * 1.01;
    
    // Draw the line
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((d, i) => {
      const xVal = new Date(d.time).getTime();
      const yVal = parseFloat(d.price);
      
      // Scale to canvas
      const x = 50 + (xVal - minX) / (maxX - minX) * (canvas.width - 70);
      const y = (canvas.height - 30) - (yVal - minY) / (maxY - minY) * (canvas.height - 50);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Add price labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.fillText(maxY.toFixed(2), 45, 25);
    ctx.fillText(minY.toFixed(2), 45, canvas.height - 35);
    
    // Add current price display
    const currentPrice = data[data.length - 1].price;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Current Price: $${currentPrice.toFixed(2)}`, 60, 40);
  }
}