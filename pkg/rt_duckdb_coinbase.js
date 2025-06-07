// JavaScript bindings for the Rust WASM module
async function init() {
  // Import the Observable Plot library
  const Plot = window.Plot;
  
  // Import the compatibility module
  try {
    const { checkStructure, legacyDrawChart } = await import('./compatibility.js');
    window.checkStructure = checkStructure;
    window.legacyDrawChart = legacyDrawChart;
    console.log("Compatibility module loaded successfully");
  } catch (error) {
    console.error("Failed to load compatibility module:", error);
  }
  
  // Create a mock WebSocket connection to Coinbase
  console.log("Initializing WebAssembly module and data simulation...");
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up the charts
  setupCharts();
  
  // Start simulating data
  startDataSimulation();
}

// Global data store
const priceData = [];
const allPriceData = []; // Store all data points for historical analysis
const volumeData = []; // Simulated volume data
const MAX_DATA_POINTS = 300;
let simulationInterval = null;
let isPaused = false;
let selectedTimeframe = '5m';
let selectedAggregation = 'none';

// Set up event listeners for controls
function setupEventListeners() {
  // Timeframe selector
  const timeframeSelect = document.getElementById('timeframe');
  if (timeframeSelect) {
    timeframeSelect.addEventListener('change', function() {
      selectedTimeframe = this.value;
      updateAllCharts();
    });
  }
  
  // Aggregation selector
  const aggregationSelect = document.getElementById('aggregation');
  if (aggregationSelect) {
    aggregationSelect.addEventListener('change', function() {
      selectedAggregation = this.value;
      updateAllCharts();
    });
  }
  
  // Reset zoom button
  const resetZoomButton = document.getElementById('reset-zoom');
  if (resetZoomButton) {
    resetZoomButton.addEventListener('click', function() {
      updateAllCharts();
    });
  }
  
  // Toggle simulation button
  const toggleSimulationButton = document.getElementById('toggle-simulation');
  if (toggleSimulationButton) {
    toggleSimulationButton.addEventListener('click', function() {
      isPaused = !isPaused;
      this.textContent = isPaused ? 'Resume' : 'Pause';
      this.style.backgroundColor = isPaused ? '#f44336' : '#4CAF50';
    });
  }
}

// Set up all charts
function setupCharts() {
  console.log("Setting up charts...");
  
  // Check if we're using the old or new HTML structure
  const isNewStructure = document.getElementById('price-chart') !== null;
  const isOldStructure = document.getElementById('chart') !== null;
  
  console.log("Using new chart structure:", isNewStructure);
  console.log("Using old chart structure:", isOldStructure);
  
  // If neither structure is found, show an error
  if (!isNewStructure && !isOldStructure) {
    console.error("No chart elements found in the DOM. Please check the HTML structure.");
    return;
  }
  
  // Generate initial mock data
  const now = new Date();
  for (let i = 0; i < 50; i++) {
    const time = new Date(now.getTime() - (50 - i) * 60000);
    const price = 30000 + Math.random() * 1000;
    const volume = Math.floor(Math.random() * 10) + 1; // Random volume between 1-10
    
    const dataPoint = { 
      time: time.toISOString(), 
      timestamp: time.getTime(),
      price: price,
      volume: volume
    };
    
    priceData.push(dataPoint);
    allPriceData.push(dataPoint);
    volumeData.push(dataPoint);
  }
  
  // Initialize all charts
  if (isNewStructure) {
    updateAllCharts();
  } else if (isOldStructure) {
    // For backward compatibility with the old structure
    if (typeof window.legacyDrawChart === 'function') {
      console.log("Using legacyDrawChart from compatibility module");
      window.legacyDrawChart(priceData);
    } else {
      console.error("legacyDrawChart function not found. Compatibility module may not be loaded.");
    }
  }
}

// Legacy draw chart function for backward compatibility
function legacyDrawChart(data) {
  const chartElement = document.getElementById('chart');
  if (!chartElement) {
    console.error('Chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 800;
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

// Update all charts with current data
function updateAllCharts() {
  try {
    // Get filtered data based on timeframe
    const filteredData = getFilteredData();
    
    // Get aggregated data if needed
    const aggregatedData = getAggregatedData(filteredData);
    
    // Check if we're using the new structure
    const isNewStructure = document.getElementById('price-chart') !== null;
    
    if (isNewStructure) {
      console.log("Updating all charts in new structure");
      
      // Update price chart
      drawPriceChart(aggregatedData);
      
      // Update volatility chart
      drawVolatilityChart(filteredData);
      
      // Update distribution chart
      drawDistributionChart(filteredData);
      
      // Update moving averages chart
      drawMovingAveragesChart(filteredData);
      
      // Update volume profile chart
      drawVolumeProfileChart(filteredData);
      
      // Update heatmap chart
      drawHeatmapChart(filteredData);
      
      // Update stats
      updateStats(filteredData);
    } else {
      // For legacy structure, just update the main chart
      console.log("Updating legacy chart");
      if (typeof window.legacyDrawChart === 'function') {
        window.legacyDrawChart(filteredData);
      } else {
        console.error("legacyDrawChart function not found. Compatibility module may not be loaded.");
      }
    }
  } catch (error) {
    console.error("Error updating charts:", error);
  }
}

// Filter data based on selected timeframe
function getFilteredData() {
  if (selectedTimeframe === 'all') {
    return [...allPriceData];
  }
  
  const now = new Date();
  let timeframeMs;
  
  switch (selectedTimeframe) {
    case '1m':
      timeframeMs = 60 * 1000;
      break;
    case '5m':
      timeframeMs = 5 * 60 * 1000;
      break;
    case '15m':
      timeframeMs = 15 * 60 * 1000;
      break;
    case '1h':
      timeframeMs = 60 * 60 * 1000;
      break;
    default:
      timeframeMs = 5 * 60 * 1000;
  }
  
  const cutoffTime = now.getTime() - timeframeMs;
  return allPriceData.filter(d => new Date(d.time).getTime() >= cutoffTime);
}

// Aggregate data based on selected aggregation
function getAggregatedData(data) {
  if (selectedAggregation === 'none') {
    return data;
  }
  
  let intervalMs;
  switch (selectedAggregation) {
    case '1s':
      intervalMs = 1000;
      break;
    case '5s':
      intervalMs = 5 * 1000;
      break;
    case '10s':
      intervalMs = 10 * 1000;
      break;
    case '30s':
      intervalMs = 30 * 1000;
      break;
    default:
      return data;
  }
  
  // Group data by time intervals
  const groupedData = {};
  data.forEach(d => {
    const timestamp = new Date(d.time).getTime();
    const interval = Math.floor(timestamp / intervalMs) * intervalMs;
    
    if (!groupedData[interval]) {
      groupedData[interval] = {
        prices: [],
        volumes: []
      };
    }
    
    groupedData[interval].prices.push(d.price);
    groupedData[interval].volumes.push(d.volume);
  });
  
  // Calculate aggregated values (OHLC)
  const aggregated = Object.keys(groupedData).map(interval => {
    const prices = groupedData[interval].prices;
    const volumes = groupedData[interval].volumes;
    
    return {
      time: new Date(parseInt(interval)).toISOString(),
      timestamp: parseInt(interval),
      price: prices.reduce((sum, price) => sum + price, 0) / prices.length, // Average price
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: volumes.reduce((sum, vol) => sum + vol, 0) // Sum of volumes
    };
  }).sort((a, b) => a.timestamp - b.timestamp);
  
  return aggregated;
}

// Calculate moving averages
function calculateMovingAverages(data, periods = [7, 25, 99]) {
  const result = [];
  
  periods.forEach(period => {
    for (let i = 0; i < data.length; i++) {
      if (i >= period - 1) {
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((total, item) => total + item.price, 0);
        const ma = sum / period;
        
        if (!result[i]) {
          result[i] = {
            time: data[i].time,
            timestamp: data[i].timestamp || new Date(data[i].time).getTime(),
            price: data[i].price
          };
        }
        
        result[i][`ma${period}`] = ma;
      }
    }
  });
  
  return result;
}

// Calculate price volatility
function calculateVolatility(data, window = 10) {
  if (data.length < window) return [];
  
  const volatility = [];
  
  for (let i = window; i < data.length; i++) {
    const slice = data.slice(i - window, i);
    const prices = slice.map(d => d.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    volatility.push({
      time: data[i].time,
      timestamp: data[i].timestamp || new Date(data[i].time).getTime(),
      volatility: stdDev,
      percentVolatility: (stdDev / mean) * 100
    });
  }
  
  return volatility;
}

// Calculate price distribution
function calculatePriceDistribution(data, bins = 10) {
  if (data.length === 0) return [];
  
  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const binWidth = range / bins;
  
  const distribution = Array(bins).fill(0);
  
  prices.forEach(price => {
    const binIndex = Math.min(Math.floor((price - min) / binWidth), bins - 1);
    distribution[binIndex]++;
  });
  
  return distribution.map((count, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    binCenter: min + (i + 0.5) * binWidth,
    count: count,
    percentage: (count / prices.length) * 100
  }));
}

// Simulate real-time data
function startDataSimulation() {
  console.log('Starting data simulation');
  
  // Generate new data point every 2 seconds
  simulationInterval = setInterval(function() {
    if (isPaused) return;
    
    const lastPrice = priceData.length > 0 
      ? priceData[priceData.length - 1].price 
      : 30000;
    
    // Random walk algorithm for price
    const change = (Math.random() - 0.5) * 100;
    const newPrice = lastPrice + change;
    const now = new Date();
    const volume = Math.floor(Math.random() * 10) + 1; // Random volume between 1-10
    
    const dataPoint = {
      time: now.toISOString(),
      timestamp: now.getTime(),
      price: newPrice,
      volume: volume
    };
    
    // Add to our data stores
    priceData.push(dataPoint);
    allPriceData.push(dataPoint);
    volumeData.push(dataPoint);
    
    // Keep recent data size manageable
    if (priceData.length > MAX_DATA_POINTS) {
      priceData.shift();
    }
    
    // Update all charts
    updateAllCharts();
    
    console.log('Simulated price:', newPrice.toFixed(2));
  }, 2000);
}

// Update statistics display
function updateStats(data) {
  if (data.length === 0) return;
  
  const currentPrice = data[data.length - 1].price;
  const initialPrice = data[0].price;
  const priceChange = ((currentPrice - initialPrice) / initialPrice) * 100;
  const prices = data.map(d => d.price);
  const sessionHigh = Math.max(...prices);
  const sessionLow = Math.min(...prices);
  
  // Update DOM elements if they exist
  const currentPriceElement = document.getElementById('current-price');
  const priceChangeElement = document.getElementById('price-change');
  const sessionHighElement = document.getElementById('session-high');
  const sessionLowElement = document.getElementById('session-low');
  
  if (currentPriceElement) {
    currentPriceElement.textContent = `$${currentPrice.toFixed(2)}`;
  }
  
  if (priceChangeElement) {
    priceChangeElement.textContent = `${priceChange.toFixed(2)}%`;
    priceChangeElement.style.color = priceChange >= 0 ? '#4CAF50' : '#f44336';
  }
  
  if (sessionHighElement) {
    sessionHighElement.textContent = `$${sessionHigh.toFixed(2)}`;
  }
  
  if (sessionLowElement) {
    sessionLowElement.textContent = `$${sessionLow.toFixed(2)}`;
  }
  
  // Log stats to console for debugging
  console.log(`Stats: Price: $${currentPrice.toFixed(2)}, Change: ${priceChange.toFixed(2)}%, High: $${sessionHigh.toFixed(2)}, Low: $${sessionLow.toFixed(2)}`);
}

// Draw the price chart
function drawPriceChart(data) {
  const chartElement = document.getElementById('price-chart');
  if (!chartElement) {
    console.error('Price chart element not found, trying legacy chart element');
    // Try to use the legacy chart element as a fallback
    const legacyChartElement = document.getElementById('chart');
    if (legacyChartElement) {
      if (typeof window.legacyDrawChart === 'function') {
        window.legacyDrawChart(data);
      } else {
        console.error("legacyDrawChart function not found. Compatibility module may not be loaded.");
      }
      return;
    } else {
      console.error('No chart elements found in the DOM');
      return;
    }
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 800;
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
    
    // Add time labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    
    // Start time
    const startTime = new Date(data[0].time);
    ctx.fillText(formatTime(startTime), 50, canvas.height - 10);
    
    // End time
    const endTime = new Date(data[data.length - 1].time);
    ctx.fillText(formatTime(endTime), canvas.width - 20, canvas.height - 10);
    
    // Middle time
    const middleIndex = Math.floor(data.length / 2);
    const middleTime = new Date(data[middleIndex].time);
    ctx.fillText(formatTime(middleTime), (canvas.width - 20 + 50) / 2, canvas.height - 10);
  }
}

// Draw the volatility chart
function drawVolatilityChart(data) {
  const chartElement = document.getElementById('volatility-chart');
  if (!chartElement) {
    console.error('Volatility chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 400;
  canvas.height = 200;
  chartElement.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw chart background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Calculate volatility
  const volatilityData = calculateVolatility(data);
  
  if (volatilityData.length > 1) {
    // Find min/max values for scaling
    let minY = 0;
    let maxY = Math.max(...volatilityData.map(d => d.percentVolatility)) * 1.1;
    let minX = volatilityData[0].timestamp;
    let maxX = volatilityData[volatilityData.length - 1].timestamp;
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    
    // Draw the volatility line
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    volatilityData.forEach((d, i) => {
      const xVal = d.timestamp;
      const yVal = d.percentVolatility;
      
      // Scale to canvas
      const x = 40 + (xVal - minX) / (maxX - minX) * (canvas.width - 60);
      const y = (canvas.height - 30) - (yVal - minY) / (maxY - minY) * (canvas.height - 50);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Add labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillText(`${maxY.toFixed(2)}%`, 35, 25);
    ctx.fillText('0.00%', 35, canvas.height - 35);
    
    // Add title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Price Volatility (%)', canvas.width / 2, 15);
  } else {
    // Not enough data
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Not enough data for volatility calculation', canvas.width / 2, canvas.height / 2);
  }
}

// Draw the distribution chart
function drawDistributionChart(data) {
  const chartElement = document.getElementById('distribution-chart');
  if (!chartElement) {
    console.error('Distribution chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 400;
  canvas.height = 200;
  chartElement.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw chart background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Calculate price distribution
  const distribution = calculatePriceDistribution(data, 10);
  
  if (distribution.length > 0) {
    // Find max value for scaling
    const maxCount = Math.max(...distribution.map(d => d.count));
    const barWidth = (canvas.width - 60) / distribution.length;
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    
    // Draw bars
    distribution.forEach((d, i) => {
      const x = 40 + i * barWidth;
      const barHeight = (d.count / maxCount) * (canvas.height - 50);
      const y = canvas.height - 30 - barHeight;
      
      // Draw bar
      ctx.fillStyle = '#3498db';
      ctx.fillRect(x, y, barWidth - 2, barHeight);
      
      // Add price label if space permits
      if (i % 2 === 0 && barWidth > 30) {
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.font = '10px Arial';
        ctx.fillText(`$${d.binCenter.toFixed(0)}`, x + barWidth / 2, canvas.height - 15);
      }
    });
    
    // Add labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillText(maxCount, 35, 25);
    ctx.fillText('0', 35, canvas.height - 35);
    
    // Add title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Price Distribution', canvas.width / 2, 15);
  } else {
    // Not enough data
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Not enough data for distribution', canvas.width / 2, canvas.height / 2);
  }
}

// Draw the moving averages chart
function drawMovingAveragesChart(data) {
  const chartElement = document.getElementById('ma-chart');
  if (!chartElement) {
    console.error('Moving averages chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 800;
  canvas.height = 300;
  chartElement.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw chart background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Calculate moving averages
  const periods = [7, 25, 99];
  const maData = calculateMovingAverages(data, periods);
  
  if (maData.length > 0) {
    // Find min/max values for scaling
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = maData[0].timestamp;
    let maxX = maData[maData.length - 1].timestamp;
    
    maData.forEach(d => {
      const values = [d.price];
      periods.forEach(period => {
        if (d[`ma${period}`]) values.push(d[`ma${period}`]);
      });
      
      minY = Math.min(minY, ...values.filter(v => v !== undefined));
      maxY = Math.max(maxY, ...values.filter(v => v !== undefined));
    });
    
    // Add some padding
    minY = minY * 0.99;
    maxY = maxY * 1.01;
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(50, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    
    // Draw price line
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    maData.forEach((d, i) => {
      const xVal = d.timestamp;
      const yVal = d.price;
      
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
    
    // Draw moving averages
    const colors = ['#e74c3c', '#2ecc71', '#9b59b6'];
    
    periods.forEach((period, index) => {
      ctx.strokeStyle = colors[index % colors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      let started = false;
      
      maData.forEach((d, i) => {
        if (d[`ma${period}`]) {
          const xVal = d.timestamp;
          const yVal = d[`ma${period}`];
          
          // Scale to canvas
          const x = 50 + (xVal - minX) / (maxX - minX) * (canvas.width - 70);
          const y = (canvas.height - 30) - (yVal - minY) / (maxY - minY) * (canvas.height - 50);
          
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      
      ctx.stroke();
    });
    
    // Add price labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillText(maxY.toFixed(2), 45, 25);
    ctx.fillText(minY.toFixed(2), 45, canvas.height - 35);
    
    // Add legend
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3498db';
    ctx.fillRect(60, 20, 15, 10);
    ctx.fillStyle = '#000';
    ctx.fillText('Price', 80, 28);
    
    periods.forEach((period, index) => {
      const y = 28 + (index + 1) * 15;
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(60, y - 8, 15, 10);
      ctx.fillStyle = '#000';
      ctx.fillText(`MA${period}`, 80, y);
    });
    
    // Add time labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    
    // Start time
    const startTime = new Date(maData[0].time);
    ctx.fillText(formatTime(startTime), 50, canvas.height - 10);
    
    // End time
    const endTime = new Date(maData[maData.length - 1].time);
    ctx.fillText(formatTime(endTime), canvas.width - 20, canvas.height - 10);
  } else {
    // Not enough data
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Not enough data for moving averages', canvas.width / 2, canvas.height / 2);
  }
}

// Draw the volume profile chart
function drawVolumeProfileChart(data) {
  const chartElement = document.getElementById('volume-chart');
  if (!chartElement) {
    console.error('Volume chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 400;
  canvas.height = 200;
  chartElement.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw chart background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (data.length > 0) {
    // Group data by time intervals (5-minute intervals)
    const intervalMs = 5 * 60 * 1000;
    const volumeByTime = {};
    
    data.forEach(d => {
      const timestamp = new Date(d.time).getTime();
      const interval = Math.floor(timestamp / intervalMs) * intervalMs;
      
      if (!volumeByTime[interval]) {
        volumeByTime[interval] = 0;
      }
      
      volumeByTime[interval] += d.volume || 1;
    });
    
    // Convert to array for drawing
    const volumeData = Object.keys(volumeByTime).map(interval => ({
      timestamp: parseInt(interval),
      time: new Date(parseInt(interval)).toISOString(),
      volume: volumeByTime[interval]
    })).sort((a, b) => a.timestamp - b.timestamp);
    
    // Find min/max values for scaling
    const maxVolume = Math.max(...volumeData.map(d => d.volume));
    let minX = volumeData[0].timestamp;
    let maxX = volumeData[volumeData.length - 1].timestamp;
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    
    // Draw volume bars
    const barWidth = Math.min(20, (canvas.width - 60) / volumeData.length);
    
    volumeData.forEach(d => {
      const x = 40 + (d.timestamp - minX) / (maxX - minX) * (canvas.width - 60);
      const barHeight = (d.volume / maxVolume) * (canvas.height - 50);
      const y = canvas.height - 30 - barHeight;
      
      // Draw bar
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);
    });
    
    // Add labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillText(maxVolume.toFixed(0), 35, 25);
    ctx.fillText('0', 35, canvas.height - 35);
    
    // Add title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Volume Profile', canvas.width / 2, 15);
  } else {
    // Not enough data
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Not enough data for volume profile', canvas.width / 2, canvas.height / 2);
  }
}

// Draw the price change heatmap
function drawHeatmapChart(data) {
  const chartElement = document.getElementById('heatmap-chart');
  if (!chartElement) {
    console.error('Heatmap chart element not found');
    return;
  }
  
  // Clear previous content
  chartElement.innerHTML = '';
  
  // Create canvas for drawing
  const canvas = document.createElement('canvas');
  canvas.width = chartElement.clientWidth || 400;
  canvas.height = 200;
  chartElement.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw chart background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (data.length > 10) {
    // Calculate price changes
    const changes = [];
    for (let i = 1; i < data.length; i++) {
      const change = ((data[i].price - data[i-1].price) / data[i-1].price) * 100;
      changes.push({
        timestamp: data[i].timestamp,
        time: data[i].time,
        change: change
      });
    }
    
    // Find min/max values for scaling
    const maxChange = Math.max(...changes.map(d => Math.abs(d.change)));
    let minX = changes[0].timestamp;
    let maxX = changes[changes.length - 1].timestamp;
    
    // Draw heatmap
    const cellWidth = (canvas.width - 60) / changes.length;
    const cellHeight = canvas.height - 50;
    
    changes.forEach((d, i) => {
      const x = 40 + i * cellWidth;
      
      // Color based on change (red for negative, green for positive)
      const intensity = Math.min(1, Math.abs(d.change) / maxChange);
      let color;
      
      if (d.change < 0) {
        // Red for negative changes
        const r = Math.floor(255 * intensity);
        color = `rgb(${r}, 0, 0)`;
      } else {
        // Green for positive changes
        const g = Math.floor(255 * intensity);
        color = `rgb(0, ${g}, 0)`;
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(x, 20, cellWidth, cellHeight);
    });
    
    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    
    // Add legend
    const gradientWidth = 100;
    const gradientHeight = 15;
    const gradientX = canvas.width - gradientWidth - 20;
    const gradientY = 25;
    
    // Negative gradient (red)
    const negGradient = ctx.createLinearGradient(gradientX, 0, gradientX + gradientWidth/2, 0);
    negGradient.addColorStop(0, 'rgb(255, 0, 0)');
    negGradient.addColorStop(1, 'rgb(0, 0, 0)');
    
    ctx.fillStyle = negGradient;
    ctx.fillRect(gradientX, gradientY, gradientWidth/2, gradientHeight);
    
    // Positive gradient (green)
    const posGradient = ctx.createLinearGradient(gradientX + gradientWidth/2, 0, gradientX + gradientWidth, 0);
    posGradient.addColorStop(0, 'rgb(0, 0, 0)');
    posGradient.addColorStop(1, 'rgb(0, 255, 0)');
    
    ctx.fillStyle = posGradient;
    ctx.fillRect(gradientX + gradientWidth/2, gradientY, gradientWidth/2, gradientHeight);
    
    // Add labels
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.font = '10px Arial';
    ctx.fillText(`-${maxChange.toFixed(2)}%`, gradientX, gradientY + gradientHeight + 12);
    ctx.fillText('0%', gradientX + gradientWidth/2, gradientY + gradientHeight + 12);
    ctx.fillText(`+${maxChange.toFixed(2)}%`, gradientX + gradientWidth, gradientY + gradientHeight + 12);
    
    // Add title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Price Change Heatmap', canvas.width / 2, 15);
  } else {
    // Not enough data
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Not enough data for heatmap', canvas.width / 2, canvas.height / 2);
  }
}

// Helper function to format time
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default init;