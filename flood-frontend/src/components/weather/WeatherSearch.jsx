import { useState } from "react";
import SearchInput from "../common/SearchInput";

function WeatherSearch({ onSearch }) {
  const [query, setQuery] = useState("");

  return (
    <SearchInput
      value={query}
      placeholder="Search by city…"
      onChange={(event) => {
        setQuery(event.target.value);
        onSearch(event.target.value);
      }}
    />
  );
}

export default WeatherSearch;
