import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import { getReliabilityHistory } from "../../services/reliabilityService";

// Time series of one source's reliability_score, fetched on demand when a
// source is selected in SourceReliabilityPanel (a separate call from the
// 30s-polled summary/sources - history is only needed once a source is
// actually picked, so it isn't part of useReliability's default fetch set).
function ReliabilityHistoryChart({ source }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  // Clears the chart the moment `source` is deselected, adjusted during
  // render rather than in the effect below (React's documented pattern
  // for "reset state when a prop changes").
  const [syncedSource, setSyncedSource] = useState(source);
  if (source !== syncedSource) {
    setSyncedSource(source);
    if (!source) setHistory([]);
  }

  useEffect(() => {
    if (!source) {
      return;
    }
    let cancelled = false;
    // Shows the loading state immediately when a new source is picked; the
    // fetch itself resolves setHistory/setLoading(false) asynchronously
    // below via .then/.finally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getReliabilityHistory(source, 30)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const chartData = history.map((h) => ({
    computed_at: new Date(h.computed_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" }),
    reliability_score: h.reliability_score,
  }));

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Reliability History</h3>
        {source ? <span className="text-xs text-slate-400">{source}</span> : null}
      </div>

      {!source ? (
        <EmptyState title="Select a source" description="Click a row in Source Reliability to see its trend." />
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : chartData.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="computed_at" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => (v != null ? `${Math.round(v * 100)}%` : "—")} />
            <ReferenceLine y={0.8} stroke="#16a34a" strokeDasharray="4 4" />
            <ReferenceLine y={0.6} stroke="#eab308" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="reliability_score" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="No history yet" description="This source hasn't been scored more than once yet." />
      )}
    </Card>
  );
}

export default ReliabilityHistoryChart;
