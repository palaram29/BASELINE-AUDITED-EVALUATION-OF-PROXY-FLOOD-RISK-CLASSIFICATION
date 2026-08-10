// Loading placeholder shown while ML dashboard data is being fetched,
// instead of a blank panel or a single "Loading..." line.
function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export default Skeleton;
