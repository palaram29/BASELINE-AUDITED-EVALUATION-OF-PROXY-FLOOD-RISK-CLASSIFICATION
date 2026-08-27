import { FiSearch } from "react-icons/fi";

/**
 * Standard search field. Accepts either `onChange` (raw event) or
 * `onSearch` (value string) so it drops into every existing call site.
 */
function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Search…",
  className = "",
}) {
  const handleChange = (event) => {
    onChange?.(event);
    onSearch?.(event.target.value);
  };

  return (
    <div className={`relative w-full lg:w-80 ${className}`}>
      <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-10 pr-4 text-sm text-heading shadow-sm transition placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </div>
  );
}

export default SearchInput;
