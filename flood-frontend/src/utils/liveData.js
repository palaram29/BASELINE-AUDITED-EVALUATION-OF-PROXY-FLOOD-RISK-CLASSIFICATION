export const simulateWeather = (items = []) =>
  items.map((item, index) => ({
    ...item,
    Rainfall: Number((Number(item.Rainfall) + (index % 2 === 0 ? 0.8 : -0.5)).toFixed(1)),
    Temperature: Number((Number(item.Temperature) + (index % 3 === 0 ? 0.2 : -0.1)).toFixed(1)),
    WindSpeed: Number((Number(item.WindSpeed) + (index % 4 === 0 ? 0.3 : -0.2)).toFixed(1)),
  }));

export const simulateRiver = (items = []) =>
  items.map((item, index) => ({
    ...item,
    WaterLevel: Number((Number(item.WaterLevel) + (index % 2 === 0 ? 0.05 : -0.03)).toFixed(2)),
  }));

export const simulatePrediction = (items = []) =>
  items.map((item, index) => ({
    ...item,
    Rainfall_3Day: Number((Number(item.Rainfall_3Day) + (index % 2 === 0 ? 2 : -1)).toFixed(0)),
    Avg_Temperature: Number((Number(item.Avg_Temperature) + (index % 3 === 0 ? 0.1 : -0.1)).toFixed(1)),
  }));
