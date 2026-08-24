import Card from "../common/Card";

function RiverTable({ rivers }) {
  return (
    <Card>
      <h2 className="text-xl font-semibold mb-4">
        River Monitoring
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-4 py-3 text-left">River</th>
              <th className="px-4 py-3 text-left">Station</th>
              <th className="px-4 py-3 text-left">Water Level</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Risk</th>
            </tr>
          </thead>

          <tbody>
            {rivers.map((river, index) => (
              <tr
                key={river.id ?? `${river.River}-${river.Station}-${index}`}
                className="border-b hover:bg-slate-50"
              >
                <td className="px-4 py-3">{river.River}</td>
                <td className="px-4 py-3">{river.Station}</td>
                <td className="px-4 py-3">
                  {river.WaterLevel} m
                </td>
                <td className="px-4 py-3">
                  {river.Status}
                </td>
                <td className="px-4 py-3">
                  {river.RiverRisk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default RiverTable;