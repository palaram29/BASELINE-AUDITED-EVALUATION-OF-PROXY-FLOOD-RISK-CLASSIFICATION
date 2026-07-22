import { useState } from "react";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { demoPipelineStatus } from "../../utils/demoData";

function Pipeline() {
  const [status] = useState(demoPipelineStatus);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Data pipeline</h1>
        <p className="mt-2 text-slate-500">Manage ingestion and monitoring for weather, river, and prediction data.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-500">Pipeline state</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-800">{status.message}</h2>
          </div>
          <Badge tone="green">{status.status}</Badge>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { title: "Weather ingestion", detail: "Collecting and storing station observations" },
          { title: "River monitoring", detail: "Tracking water levels and risk thresholds" },
          { title: "Prediction generation", detail: "Producing flood risk scores from fresh data" },
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