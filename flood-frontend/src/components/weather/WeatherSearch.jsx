import { useState } from "react";

function WeatherSearch({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="flex justify-end">
      <input
        type="text"
        placeholder="Search by city..."
        value={query}
        onChange={handleChange}
        className="w-full md:w-80 border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export default WeatherSearch;