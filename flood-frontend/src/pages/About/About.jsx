import {
  FiActivity,
  FiCpu,
  FiShield,
  FiMap,
  FiDatabase,
  FiBell,
} from "react-icons/fi";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";

const CAPABILITIES = [
  { icon: FiActivity, title: "Live monitoring", text: "Weather and river conditions across monitored districts, refreshed automatically by the pipeline." },
  { icon: FiCpu, title: "ML flood forecasting", text: "Random Forest, XGBoost and LightGBM are compared; the best performer is frozen as the production model." },
  { icon: FiShield, title: "Data reliability", text: "Every source is scored on completeness, timeliness, validity and history — a data-quality signal separate from model confidence." },
  { icon: FiMap, title: "Interactive risk maps", text: "Leaflet maps of monitored cities and rivers with current risk overlays." },
  { icon: FiDatabase, title: "MLOps monitoring", text: "Model versioning, drift detection, data-quality checks and a manual promotion workflow." },
  { icon: FiBell, title: "Citizen alerts", text: "Registered citizen-app users get in-app notifications when their area's risk rises into a higher tier." },
];

function About() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="About"
        title="About this system"
        description="A research-focused, cloud-based flood prediction platform that combines live environmental data, machine learning, and data-quality assessment for locations in Sri Lanka."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {CAPABILITIES.map(({ icon: Icon, title, text }) => (
          <Card key={title} hover className="p-5">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-base font-semibold text-heading">{title}</h3>
            <p className="mt-1.5 text-sm text-muted">{text}</p>
          </Card>
        ))}
      </div>

      <Card title="This front-end" subtitle="Operator / research console">
        <ul className="list-inside list-disc space-y-2 text-sm text-muted">
          <li>Read-only operator tooling — no login; every account and alert-subscription flow lives in the separate citizen app.</li>
          <li>Dashboard, Weather, River, Prediction and Statistics views for day-to-day monitoring.</li>
          <li>ML Dashboard, MLOps and Data Reliability views for the research and model-governance layer.</li>
          <li>Built with React, Vite, Tailwind CSS, Recharts and Leaflet against a FastAPI backend.</li>
        </ul>
      </Card>
    </div>
  );
}

export default About;
