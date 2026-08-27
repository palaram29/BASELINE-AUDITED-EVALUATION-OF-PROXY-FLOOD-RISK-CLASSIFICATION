// Loading placeholder shown while data is being fetched, instead of a
// blank panel or a single "Loading..." line.
function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-shimmer rounded-md ${className}`} />;
}

export default Skeleton;
