import { useState } from "react";
import { FiCloudRain, FiActivity, FiTrendingUp, FiPlay } from "react-icons/fi";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ErrorMessage from "../../components/common/ErrorMessage";
import usePipelineStatus from "../../hooks/usePipelineStatus";
import { runPipeline } from "../../services/pipelineService";

function statusBadge(status) {
  if (!status || !status.last_run_at) return { tone: "slate", label: "Starting…" };
  if (status.last_result === "success") return { tone: "green", label: "Automated · healthy" };
  return { tone: "red", label: "Automated · last run failed" };
}

const STAGES = [
  { title: "Weather ingestion", detail: "Collecting and storing station observations", icon: FiCloudRain },
  { title: "River monitoring", detail: "Tracking water levels and risk thresholds", icon: FiActivity },
  { title: "Prediction generation", detail: "Scoring fresh data through the frozen production model", icon: FiTrendingUp },
];

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
      <PageHeader
        eyebrow="Operations"
        title="Data pipeline"
        description={`Weather, river and prediction data refresh automatically every ${
          status?.interval_minutes ?? 60
        } minutes. This reflects the scheduler's real run history, not a fixed status.`}
        actions={
          <Button icon={FiPlay} onClick={handleRunNow} disabled={running}>
            {running ? "Running…" : "Run now"}
          </Button>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {runError ? <ErrorMessage message={runError} /> : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Automatic pipeline</p>
            <h2 className="mt-2 text-xl font-semibold text-heading">
              {status?.last_run_at
                ? `Last run · ${new Date(status.last_run_at).toLocaleString()}`
                : "Waiting for the first scheduled run"}
            </h2>
            {status?.last_result === "success" && status?.last_success_at ? (
              <p className="mt-1 text-sm text-muted">
                Completed successfully at {new Date(status.last_success_at).toLocaleString()}.
              </p>
            ) : null}
            {status?.last_error ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{status.last_error}</p>
            ) : null}
          </div>
          <Badge tone={badge.tone} size="lg" dot>
            {badge.label}
          </Badge>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        {STAGES.map((item) => (
          <Card key={item.title} hover className="p-5">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <item.icon className="h-5 w-5" />
            </span>
            <h3 className="text-base font-semibold text-heading">{item.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{item.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Pipeline;
