/**
 * Chart Renderer Module
 * Renders charts using processed data
 */
class ChartRenderer {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.chart = null;
  }
  
  clearChart() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
  
  renderPriceChart(data) {
    this.clearChart();
    
    if (!data || data.length === 0) {
      this.showNoDataMessage();
      return;
    }
    
    // Format data for plotting
    const plotData = data.map(d => ({
      time: new Date(d.timestamp),
      price: d.price
    }));
    
    // Create price chart using Observable Plot
    this.chart = Plot.plot({
      y: {
        grid: true,
        label: "BTC Price (USD)"
      },
      x: {
        type: "time",
        label: "Time",
        grid: true
      },
      marks: [
        Plot.line(plotData, {
          x: "time",
          y: "price",
          stroke: "#3498db",
          strokeWidth: 2
        }),
        Plot.dot(plotData, {
          x: "time",
          y: "price",
          stroke: "#3498db",
          fill: "white"
        })
      ],
      width: this.container.clientWidth,
      height: 300,
      marginLeft: 60,
      marginRight: 40,
      marginBottom: 40,
      marginTop: 40
    });
    
    this.container.appendChild(this.chart);
  }
  
  renderVolatilityChart(data, volatilityData) {
    this.clearChart();
    
    if (!data || data.length === 0) {
      this.showNoDataMessage();
      return;
    }
    
    // Calculate price changes
    const changes = [];
    for (let i = 1; i < data.length; i++) {
      const pctChange = ((data[i].price - data[i-1].price) / data[i-1].price) * 100;
      changes.push({
        time: new Date(data[i].timestamp),
        change: pctChange
      });
    }
    
    // Create volatility chart
    this.chart = Plot.plot({
      y: {
        grid: true,
        label: "Price Change (%)"
      },
      x: {
        type: "time",
        label: "Time",
        grid: true
      },
      marks: [
        Plot.ruleY([0], {stroke: "#ccc", strokeWidth: 1}),
        Plot.line(changes, {
          x: "time",
          y: "change",
          stroke: d => d.change >= 0 ? "#2ecc71" : "#e74c3c",
          strokeWidth: 1.5
        }),
        Plot.text([{x: new Date(data[data.length-1].timestamp), y: 0}], {
          text: d => `Volatility: ${volatilityData.volatility.toFixed(4)}%`,
          dx: -10,
          dy: -10,
          fontSize: 12
        })
      ],
      width: this.container.clientWidth,
      height: 200,
      marginLeft: 60,
      marginRight: 40,
      marginBottom: 40,
      marginTop: 40
    });
    
    this.container.appendChild(this.chart);
  }
  
  renderDistributionChart(distributionData) {
    this.clearChart();
    
    if (!distributionData || distributionData.length === 0) {
      this.showNoDataMessage();
      return;
    }
    
    // Format data for histogram
    const plotData = distributionData.map(d => ({
      binStart: d.bin_start,
      binEnd: d.bin_end,
      count: d.count,
      binMiddle: (d.bin_start + d.bin_end) / 2
    }));
    
    // Create distribution chart
    this.chart = Plot.plot({
      y: {
        grid: true,
        label: "Frequency"
      },
      x: {
        label: "Price (USD)",
        grid: true
      },
      marks: [
        Plot.barY(plotData, {
          x: "binMiddle",
          y: "count",
          fill: "#9b59b6",
          width: plotData[0].binEnd - plotData[0].binStart
        }),
        Plot.ruleY([0])
      ],
      width: this.container.clientWidth,
      height: 200,
      marginLeft: 60,
      marginRight: 40,
      marginBottom: 40,
      marginTop: 40
    });
    
    this.container.appendChild(this.chart);
  }
  
  renderMovingAveragesChart(data) {
    this.clearChart();
    
    if (!data || data.length === 0) {
      this.showNoDataMessage();
      return;
    }
    
    // Format data for plotting
    const plotData = data.map(d => ({
      time: new Date(d.timestamp),
      price: d.price,
      ma10: d.ma_10,
      ma20: d.ma_20,
      ma50: d.ma_50
    }));
    
    // Create moving averages chart
    this.chart = Plot.plot({
      y: {
        grid: true,
        label: "Price (USD)"
      },
      x: {
        type: "time",
        label: "Time",
        grid: true
      },
      marks: [
        Plot.line(plotData, {
          x: "time",
          y: "price",
          stroke: "#3498db",
          strokeWidth: 1,
          opacity: 0.7
        }),
        Plot.line(plotData, {
          x: "time",
          y: "ma10",
          stroke: "#e74c3c",
          strokeWidth: 2
        }),
        Plot.line(plotData, {
          x: "time",
          y: "ma20",
          stroke: "#2ecc71",
          strokeWidth: 2
        }),
        Plot.line(plotData, {
          x: "time",
          y: "ma50",
          stroke: "#f39c12",
          strokeWidth: 2
        }),
        Plot.text([{x: new Date(data[data.length-1].timestamp), y: plotData[plotData.length-1].price}], {
          text: "Price",
          dx: 10,
          dy: 0,
          fontSize: 10,
          fill: "#3498db"
        }),
        Plot.text([{x: new Date(data[data.length-1].timestamp), y: plotData[plotData.length-1].ma10}], {
          text: "MA10",
          dx: 10,
          dy: 0,
          fontSize: 10,
          fill: "#e74c3c"
        }),
        Plot.text([{x: new Date(data[data.length-1].timestamp), y: plotData[plotData.length-1].ma20}], {
          text: "MA20",
          dx: 10,
          dy: 0,
          fontSize: 10,
          fill: "#2ecc71"
        }),
        Plot.text([{x: new Date(data[data.length-1].timestamp), y: plotData[plotData.length-1].ma50}], {
          text: "MA50",
          dx: 10,
          dy: 0,
          fontSize: 10,
          fill: "#f39c12"
        })
      ],
      width: this.container.clientWidth,
      height: 300,
      marginLeft: 60,
      marginRight: 40,
      marginBottom: 40,
      marginTop: 40
    });
    
    this.container.appendChild(this.chart);
  }
  
  renderVolumeProfileChart(data, volumeData) {
    this.clearChart();
    
    if (!data || data.length === 0 || !volumeData || volumeData.length === 0) {
      this.showNoDataMessage();
      return;
    }
    
    // Format volume data
    const buyVolume = volumeData.find(d => d.side === 'buy')?.volume || 0;
    const sellVolume = volumeData.find(d => d.side === 'sell')?.volume || 0;
    const totalVolume = buyVolume + sellVolume;
    
    const volumePlotData = [
      { side: 'Buy', volume: buyVolume, percentage: (buyVolume / totalVolume) * 100 },
      { side: 'Sell', volume: sellVolume, percentage: (sellVolume / totalVolume) * 100 }
    ];
    
    // Create volume profile chart
    this.chart = Plot.plot({
      y: {
        grid: true,
        label: "Volume"
      },
      marks: [
        Plot.barY(volumePlotData, {
          x: "side",
          y: "volume",
          fill: d => d.side === 'Buy' ? "#2ecc71" : "#e74c3c",
          title: d => `${d.side}: ${d.volume.toFixed(4)} BTC (${d.percentage.toFixed(1)}%)`
        }),
        Plot.text(volumePlotData, {
          x: "side",
          y: "volume",
          text: d => `${d.percentage.toFixed(1)}%`,
          dy: -10,
          fontSize: 12
        })
      ],
      width: this.container.clientWidth,
      height: 200,
      marginLeft: 60,
      marginRight: 40,
      marginBottom: 40,
      marginTop: 40
    });
    
    this.container.appendChild(this.chart);
  }
  
  renderHeatmapChart(data) {
    this.clearChart();
    
    if (!data || data.length === 0) {
      this.showNoDataMessage();
      return;
    }
    
    // Calculate price changes for heatmap
    const changes = [];
    for (let i = 1; i < data.length; i++) {
      const pctChange = ((data[i].price - data[i-1].price) / data[i-1].price) * 100;
      changes.push({
        time: new Date(data[i].timestamp),
        change: pctChange,
        price: data[i].price
      });
    }
    
    // Group changes by time intervals for heatmap
    const timeIntervals = 10; // Number of time intervals
    const priceIntervals = 10; // Number of price intervals
    
    // Find min and max values
    const minTime = changes[0].time;
    const maxTime = changes[changes.length - 1].time;
    const timeRange = maxTime - minTime;
    const timeStep = timeRange / timeIntervals;
    
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const priceStep = priceRange / priceIntervals;
    
    // Create heatmap data
    const heatmapData = [];
    for (let i = 0; i < timeIntervals; i++) {
      const timeStart = new Date(minTime.getTime() + i * timeStep);
      const timeEnd = new Date(minTime.getTime() + (i + 1) * timeStep);
      
      for (let j = 0; j < priceIntervals; j++) {
        const priceStart = minPrice + j * priceStep;
        const priceEnd = minPrice + (j + 1) * priceStep;
        
        // Count changes in this cell
        const count = changes.filter(c => 
          c.time >= timeStart && c.time < timeEnd &&
          c.price >= priceStart && c.price < priceEnd
        ).length;
        
        heatmapData.push({
          timeStart,
          timeEnd,
          priceStart,
          priceEnd,
          count,
          midTime: new Date((timeStart.getTime() + timeEnd.getTime()) / 2),
          midPrice: (priceStart + priceEnd) / 2
        });
      }
    }
    
    // Create heatmap chart
    this.chart = Plot.plot({
      x: {
        type: "time",
        label: "Time",
        grid: true
      },
      y: {
        label: "Price (USD)",
        grid: true
      },
      color: {
        type: "linear",
        scheme: "YlOrRd"
      },
      marks: [
        Plot.cell(heatmapData, {
          x: "midTime",
          y: "midPrice",
          fill: "count",
          width: timeStep,
          height: priceStep,
          title: d => `Time: ${d.timeStart.toLocaleTimeString()} - ${d.timeEnd.toLocaleTimeString()}\nPrice: $${d.priceStart.toFixed(2)} - $${d.priceEnd.toFixed(2)}\nCount: ${d.count}`
        })
      ],
      width: this.container.clientWidth,
      height: 200,
      marginLeft: 60,
      marginRight: 40,
      marginBottom: 40,
      marginTop: 40
    });
    
    this.container.appendChild(this.chart);
  }
  
  showNoDataMessage() {
    const message = document.createElement('div');
    message.className = 'no-data-message';
    message.textContent = 'No data available for this timeframe';
    this.container.appendChild(message);
  }
}