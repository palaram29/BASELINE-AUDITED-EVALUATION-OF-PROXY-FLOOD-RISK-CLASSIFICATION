// HIGH/MEDIUM/LOW -> green/yellow/red, the same 3-tone convention the
// MLOps panels use for NORMAL/WARNING/CRITICAL (components/mlops/*).
// Never used alone - every score also prints the numeric percentage and
// the level text, so nothing relies on color alone to be understood
// (spec requirement).
export const RELIABILITY_TONE = { HIGH: "green", MEDIUM: "yellow", LOW: "red" };
