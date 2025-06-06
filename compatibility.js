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