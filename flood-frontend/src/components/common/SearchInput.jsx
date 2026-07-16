function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full md:w-80 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export default SearchInput;