import Badge from "../common/Badge";

const STATUS_TONE = { NORMAL: "green", WARNING: "yellow", CRITICAL: "red", UNKNOWN: "slate" };
const STATUS_LABEL = { NORMAL: "Normal", WARNING: "Warning", CRITICAL: "Critical", UNKNOWN: "Unknown" };

// NORMAL/WARNING/CRITICAL -> Badge tone, mirroring the app's existing
// risk-tone convention (utils/riskTone.js) and LivePulse's 3-tone status
// dot: green/yellow/red, worst case wins.
function MLOpsHealthBadge({ status }) {
  const tone = STATUS_TONE[status] || "slate";
  const label = STATUS_LABEL[status] || status || "Unknown";
  return <Badge tone={tone}>{label}</Badge>;
}

export default MLOpsHealthBadge;
