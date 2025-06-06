# Backward Compatibility Patch Instructions

To add backward compatibility for the old HTML structure, follow these steps:

1. Create a new file called `compatibility.js` in the `pkg` directory with the following content:

```javascript
// Compatibility module for the rt-duckdb-coinbase application
// This module provides backward compatibility for the old HTML structure

/**
 * Check if the application is using the old or new HTML structure
 * @returns {Object} An object with isNewStructure and isOldStructure properties
 */
function checkStructure() {
  const isNewStructure = document.getElementById('price-chart') !== null;
  const isOldStructure = document.getElementById('chart') !== null;
  
  console.log("Using new chart structure:", isNewStructure);
  console.log("Using old chart structure:", isOldStructure);
  
  return { isNewStructure, isOldStructure };
}

/**
 * Draw a chart in the legacy HTML structure
 * @param {Array} data The data to draw
 */
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

// Export the functions
export { checkStructure, legacyDrawChart };
```

2. Update the `setupCharts` function in `rt_duckdb_coinbase.js` to check for the old HTML structure:

```javascript
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
    legacyDrawChart(priceData);
  }
}
```

3. Update the `updateAllCharts` function to handle the old HTML structure:

```javascript
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
      legacyDrawChart(filteredData);
    }
  } catch (error) {
    console.error("Error updating charts:", error);
  }
}
```

4. Update the `drawPriceChart` function to handle the case where the element is not found:

```javascript
// Draw the price chart
function drawPriceChart(data) {
  const chartElement = document.getElementById('price-chart');
  if (!chartElement) {
    console.error('Price chart element not found, trying legacy chart element');
    // Try to use the legacy chart element as a fallback
    const legacyChartElement = document.getElementById('chart');
    if (legacyChartElement) {
      legacyDrawChart(data);
      return;
    } else {
      console.error('No chart elements found in the DOM');
      return;
    }
  }
  
  // Rest of the function...
}
```

5. Update the `updateStats` function to handle the case where the elements are not found:

```javascript
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
```

These changes will make the application work with both the old and new HTML structures, providing backward compatibility for users who are still using the old version.