function SummaryCard({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600">
      <h3 className="text-gray-500 text-sm">{title}</h3>

      <p className="text-3xl font-bold mt-2 text-slate-800">
        {value}
      </p>
    </div>
  );
}

export default SummaryCard;