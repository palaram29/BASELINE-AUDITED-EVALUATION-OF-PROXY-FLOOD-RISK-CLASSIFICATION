import useStatistics from "../../hooks/useStatistics";
import Card from "../../components/common/Card";
import ErrorMessage from "../../components/common/ErrorMessage";
import Badge from "../../components/common/Badge";

function Statistics() {
  const { statistics, loading, error } = useStatistics();

  if (loading) {
    return <div className="rounded-2xl bg-white p-8 text-center shadow-sm">Loading system statistics...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">System statistics</h1>
        <p className="mt-2 text-slate-500">An overview of the data coverage and flood risk footprint.</p>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Weather stations", value: statistics.weatherStations, tone: "blue" },
          { title: "River stations", value: statistics.riverStations, tone: "green" },
          { title: "Predictions", value: statistics.predictionCount, tone: "yellow" },
          { title: "High risk rivers", value: statistics.highRiskRivers, tone: "red" },
          { title: "High risk predictions", value: statistics.highRiskPredictions, tone: "red" },
        ].map((item) => (
          <Card key={item.title}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{item.title}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-800">{item.value}</p>
              </div>
              <Badge tone={item.tone}>{item.value > 0 ? "Active" : "None"}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Statistics;