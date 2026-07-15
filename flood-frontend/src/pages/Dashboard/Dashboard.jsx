import useDashboard from "../../hooks/useDashboard";
import SummarySection from "../../components/dashboard/SummarySection";

function Dashboard() {
  const { dashboard, loading, error } = useDashboard();

  if (loading) return <h2>Loading...</h2>;

  if (error) return <h2>{error}</h2>;

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Dashboard
        </h1>

        <p className="text-gray-500">
          Cloud-Based Flood Prediction System
        </p>
      </div>

      <SummarySection dashboard={dashboard} />

    </div>
  );
}

export default Dashboard;