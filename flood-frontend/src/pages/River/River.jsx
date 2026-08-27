import { useMemo, useState } from "react";
import useRiver from "../../hooks/useRiver";
import usePrediction from "../../hooks/usePrediction";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";
import Loader from "../../components/common/Loader";
import SearchInput from "../../components/common/SearchInput";
import EmptyState from "../../components/common/EmptyState";
import StatusTimeline from "../../components/charts/StatusTimeline";
import PredictionTable from "../../components/tables/PredictionTable";
import ViewToggle from "../../components/common/ViewToggle";
import { FLOOD_LEVELS, formatLevel } from "../../utils/riverLevels";

function statusTone(status) {
  if (status === "Alert") return "red";
  if (status === "Watch") return "yellow";
  return "green";
}

function River() {
  const { river, loading, error } = useRiver();
  const { prediction, error: predictionError } = usePrediction();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("live");

  const filteredRiver = useMemo(() => {
    const query = search.toLowerCase();
    return river.filter((item) => `${item.River} ${item.Station}`.toLowerCase().includes(query));
  }, [river, search]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Monitoring"
        title="River monitoring"
        description={
          view === "live"
            ? "Water levels and flood-stage thresholds across monitored river gauge stations."
            : "Next-day flood-risk prediction for each monitored city — a model output, not a river-level forecast."
        }
        actions={<ViewToggle value={view} onChange={setView} />}
      >
        {view === "live" ? (
          <SearchInput value={search} placeholder="Search river or station" onSearch={setSearch} />
        ) : null}
      </PageHeader>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <Card>
          <Loader label="Loading river monitoring data…" />
        </Card>
      ) : view === "live" ? (
        <div className="space-y-6">
          <Card
            title="Observed stations"
            subtitle={`${filteredRiver.length} station${filteredRiver.length === 1 ? "" : "s"} reporting`}
            action={<Badge tone="blue" dot>Updated</Badge>}
          >
            {filteredRiver.length ? (
              <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th>River</th>
                      <th>Station</th>
                      <th>Water level</th>
                      {FLOOD_LEVELS.map((level) => (
                        <th key={level.key}>{level.label}</th>
                      ))}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRiver.map((item, index) => (
                      <tr key={`${item.River}-${index}`}>
                        <td>{item.River}</td>
                        <td>{item.Station}</td>
                        <td>{item.WaterLevel} m</td>
                        {FLOOD_LEVELS.map((level) => (
                          <td key={level.key} className={level.tone}>
                            {formatLevel(item[level.key])}
                          </td>
                        ))}
                        <td>
                          <Badge tone={statusTone(item.Status)} dot>
                            {item.Status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No stations" description="No river or station matches that search." />
            )}
          </Card>

          <StatusTimeline river={filteredRiver} />
        </div>
      ) : (
        <>
          {predictionError ? <ErrorMessage message={predictionError} /> : null}
          <PredictionTable predictions={prediction} />
        </>
      )}
    </div>
  );
}

export default River;
