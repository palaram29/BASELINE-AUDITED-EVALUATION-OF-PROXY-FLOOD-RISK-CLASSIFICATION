// Maps the backend's actual Predicted_Risk vocabulary (Low/Medium/High/
// Very High) to a Badge tone. Shared by the ML Dashboard's live
// prediction panel and prediction history table.
export const riskTone = (risk) => {
  switch (risk) {
    case "Low":
      return "green";
    case "Medium":
      return "yellow";
    case "High":
    case "Very High":
      return "red";
    default:
      return "slate";
  }
};
