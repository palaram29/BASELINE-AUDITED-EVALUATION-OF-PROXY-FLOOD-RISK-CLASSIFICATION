function Loader({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label ? <p className="text-sm text-muted">{label}</p> : null}
    </div>
  );
}

export default Loader;
