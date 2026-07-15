import useDashboard from "../../hooks/useDashboard";

function Dashboard() {
  const { dashboard, loading, error } = useDashboard();

  if (loading) {
    return <h2>Loading dashboard...</h2>;
  }

  if (error) {
    return <h2>{error}</h2>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <pre className="bg-white p-4 rounded shadow overflow-auto">
        {JSON.stringify(dashboard, null, 2)}
      </pre>
    </div>
  );
}

export default Dashboard;