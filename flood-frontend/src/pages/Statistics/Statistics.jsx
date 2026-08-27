import {
  FiCloudRain,
  FiActivity,
  FiTrendingUp,
  FiAlertTriangle,
  FiAlertOctagon,
} from "react-icons/fi";
import useStatistics from "../../hooks/useStatistics";
import PageHeader from "../../components/common/PageHeader";
import SummaryCard from "../../components/cards/SummaryCard";
import ErrorMessage from "../../components/common/ErrorMessage";
import Skeleton from "../../components/common/Skeleton";

function Statistics() {
  const { statistics, loading, error } = useStatistics();

  const cards = [
    { title: "Weather stations", value: statistics.weatherStations, tone: "blue", icon: FiCloudRain },
    { title: "River stations", value: statistics.riverStations, tone: "green", icon: FiActivity },
    { title: "Predictions", value: statistics.predictionCount, tone: "yellow", icon: FiTrendingUp },
    { title: "High risk rivers", value: statistics.highRiskRivers, tone: "orange", icon: FiAlertTriangle },
    { title: "High risk predictions", value: statistics.highRiskPredictions, tone: "red", icon: FiAlertOctagon },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="System statistics"
        description="A snapshot of data coverage and the current flood-risk footprint across all monitored sources."
      />

      {error ? <ErrorMessage message={error} /> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? cards.map((c) => <Skeleton key={c.title} className="h-28 rounded-2xl" />)
          : cards.map((item) => (
              <SummaryCard
                key={item.title}
                title={item.title}
                value={item.value}
                tone={item.tone}
                icon={item.icon}
                hint={item.value > 0 ? "Active" : "No data yet"}
              />
            ))}
      </div>
    </div>
  );
}

export default Statistics;
