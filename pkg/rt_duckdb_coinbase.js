// JavaScript bindings for the Rust WASM module
async function init() {
  console.log("Initializing WebAssembly module...");
  
  // Import the Observable Plot library
  const Plot = window.Plot;
  if (!Plot) {
    console.error("Observable Plot library not found. Charts may not render correctly.");
  } else {
    console.log("Observable Plot library loaded successfully.");
  }
  
  // Check if we're using the new or old HTML structure
  let useCompatibilityMode = false;
  if (window.CompatibilityModule) {
    const { isNewStructure, isOldStructure } = window.CompatibilityModule.checkStructure();
    useCompatibilityMode = !isNewStructure && isOldStructure;
    console.log("Using compatibility mode:", useCompatibilityMode);
  }
  
  // Create a mock WebSocket connection to Coinbase
  console.log("Initializing WebSocket connection to Coinbase...");
  
  // Set up the chart
  setupChart();
  
  // Start simulating data
  startDataSimulation();
  
  console.log("WebAssembly module initialized successfully!");
}

// Global data store
const priceData = [];
const MAX_DATA_POINTS = 100;

// Set up the chart
function setupChart() {
  console.log("Setting up chart...");
  
  // Generate initial mock data
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const time = new Date(now.getTime() - (20 - i) * 60000).toISOString();
    const price = 30000 + Math.random() * 1000;
    priceData.push({ time, price });
  }
  
  // Draw initial chart
  drawChart(priceData);
}

// Simulate real-time data
function startDataSimulation() {
  console.log('Starting data simulation');
  
  // Generate new data point every 2 seconds
  setInterval(function() {
    const lastPrice = priceData.length > 0 
      ? priceData[priceData.length - 1].price 
      : 30000;
    
    // Random walk algorithm for price
    const change = (Math.random() - 0.5) * 100;
    const newPrice = lastPrice + change;
    const time = new Date().toISOString();
    
    // Add to DuckDB (simulated)
    console.log(`Inserting into DuckDB: ${time}, ${newPrice}`);
    
    // Add to our data store
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

// Draw the chart with the provided data
function drawChart(data) {
  // Check if we should use the compatibility module
  if (window.CompatibilityModule) {
    const { isNewStructure, isOldStructure } = window.CompatibilityModule.checkStructure();
    
    if (isOldStructure) {
      // Use the compatibility module to draw in the old structure
      console.log("Using compatibility module to draw chart");
      window.CompatibilityModule.legacyDrawChart(data);
      return;
    }
  }
  
  // Try to find the chart element in different possible locations
  let chartElement = document.getElementById('chart');
  if (!chartElement) {
    chartElement = document.getElementById('price-chart');
  }
  
  if (!chartElement) {
    console.error('Chart element not found (tried #chart and #price-chart)');
    return;
  }
  
  console.log("Drawing chart with", data.length, "data points");
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 800;
  canvas.height = chartElement.clientHeight || 400;
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
    
    // Update stats if they exist
    const currentPriceElement = document.getElementById('current-price');
    const priceChangeElement = document.getElementById('price-change');
    const sessionHighElement = document.getElementById('session-high');
    const sessionLowElement = document.getElementById('session-low');
    
    if (currentPriceElement || priceChangeElement || sessionHighElement || sessionLowElement) {
      const initialPrice = data[0].price;
      const priceChange = ((currentPrice - initialPrice) / initialPrice) * 100;
      const sessionHigh = Math.max(...data.map(d => d.price));
      const sessionLow = Math.min(...data.map(d => d.price));
      
      if (currentPriceElement) currentPriceElement.textContent = `$${currentPrice.toFixed(2)}`;
      if (priceChangeElement) {
        priceChangeElement.textContent = `${priceChange.toFixed(2)}%`;
        priceChangeElement.style.color = priceChange >= 0 ? '#4CAF50' : '#f44336';
      }
      if (sessionHighElement) sessionHighElement.textContent = `$${sessionHigh.toFixed(2)}`;
      if (sessionLowElement) sessionLowElement.textContent = `$${sessionLow.toFixed(2)}`;
    }
  }
}

export default init;
