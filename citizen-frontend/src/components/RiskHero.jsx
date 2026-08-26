import { FiCheckCircle, FiAlertTriangle, FiAlertOctagon } from "react-icons/fi";
import { normalizeRisk, riskLabel, riskTheme } from "../utils/risk";
import { guidanceFor } from "../utils/guidance";
import { formatDate } from "../utils/format";

const ICON = {
  Low: FiCheckCircle,
  Medium: FiAlertTriangle,
  High: FiAlertTriangle,
  "Very High": FiAlertOctagon,
};

/**
 * The headline "what's the flood risk for my area" panel. `alert` is the
 * backend /alerts/me shape: { has_data, risk_level, risk_label, message,
 * rainfall_3day, predicted_for_date, city }.
 */
function RiskHero({ city, alert }) {
  const hasData = alert && alert.has_data;
  const risk = hasData ? normalizeRisk(alert.risk_level) : "Low";
  const theme = riskTheme(risk);
  const Icon = ICON[risk] || FiCheckCircle;
  const guidance = guidanceFor(risk);

  return (
    <section className={`rounded-2xl border p-5 ${theme.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            Flood risk for {city}
          </p>
          {hasData ? (
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
              {riskLabel(risk)}
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold">No forecast available yet</p>
          )}
        </div>
        <span className={`h-3 w-3 shrink-0 rounded-full ${theme.dot}`} aria-hidden="true" />
      </div>

      <p className="mt-3 text-sm font-medium">
        {hasData ? guidance.headline : alert?.message || "Check back once the next forecast has run."}
      </p>

      {hasData ? (
        <>
          <ul className="mt-3 space-y-1.5 text-sm">
            {guidance.steps.map((step) => (
              <li key={step} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
            {alert.rainfall_3day != null ? (
              <span>3-day rainfall in the forecast: {alert.rainfall_3day} mm</span>
            ) : null}
            {alert.predicted_for_date ? (
              <span>Forecast for {formatDate(alert.predicted_for_date)}</span>
            ) : null}
          </div>

          <p className="mt-3 text-xs opacity-70">
            This is a next-day risk forecast from a machine-learning model, not an official
            evacuation order. Always follow instructions from the Disaster Management Centre.
          </p>
        </>
      ) : null}
    </section>
  );
}

export default RiskHero;
