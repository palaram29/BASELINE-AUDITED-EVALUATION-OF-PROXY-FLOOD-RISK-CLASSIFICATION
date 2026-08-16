import { useState } from "react";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import ErrorMessage from "../../components/common/ErrorMessage";
import usePipelineStatus from "../../hooks/usePipelineStatus";
import { runPipeline } from "../../services/pipelineService";

function statusBadge(status) {
  if (!status || !status.last_run_at) return { tone: "slate", label: "Starting…" };
  if (status.last_result === "success") return { tone: "green", label: "Automated · healthy" };
  return { tone: "red", label: "Automated · last run failed" };
}

function Pipeline() {
  const { status, error } = usePipelineStatus();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const handleRunNow = async () => {
    setRunning(true);
    setRunError("");
    try {
      await runPipeline();
    } catch (err) {
      console.error(err);
      setRunError(err.response?.data?.detail || "Manual run failed. Check the backend logs for details.");
    } finally {
      setRunning(false);
    }
  };

  const badge = statusBadge(status);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Data pipeline</h1>
        <p className="mt-2 text-slate-500">
          Weather, river and prediction data refresh automatically every {status?.interval_minutes ?? 60} minutes.
          This reflects the scheduler's actual run history, not a fixed status.
        </p>
      </div>

      {error ? <ErrorMessage message={error} /> : null}
      {runError ? <ErrorMessage message={runError} /> : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-500">Automatic pipeline</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-800">
              {status?.last_run_at
                ? `Last run: ${new Date(status.last_run_at).toLocaleString()}`
                : "Waiting for the first scheduled run"}
            </h2>
            {status?.last_result === "success" && status?.last_success_at ? (
              <p className="mt-1 text-sm text-slate-500">
                Completed successfully at {new Date(status.last_success_at).toLocaleString()}.
              </p>
            ) : null}
            {status?.last_error ? (
              <p className="mt-1 text-sm text-red-600">{status.last_error}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <button
              onClick={handleRunNow}
              disabled={running}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Running…" : "Run now"}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { title: "Weather ingestion", detail: "Collecting and storing station observations" },
          { title: "River monitoring", detail: "Tracking water levels and risk thresholds" },
          { title: "Prediction generation", detail: "Producing flood risk scores from fresh data via the frozen production model" },
        ].map((item) => (
          <Card key={item.title}>
            <h3 className="text-lg font-semibold text-slate-800">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Pipeline;