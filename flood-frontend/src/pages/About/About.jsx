import Card from "../../components/common/Card";

function About() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">About this system</h1>
        <p className="mt-2 text-slate-500">A research-focused flood prediction platform that combines live data, analytics, and risk assessment.</p>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-slate-800">What this frontend delivers</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-600">
          <li>Interactive dashboard views for weather, river, prediction, and statistics.</li>
          <li>Searchable monitoring pages and risk summaries for decision support.</li>
          <li>A polished, responsive experience designed for research presentations and demonstrations.</li>
        </ul>
      </Card>
    </div>
  );
}

export default About;