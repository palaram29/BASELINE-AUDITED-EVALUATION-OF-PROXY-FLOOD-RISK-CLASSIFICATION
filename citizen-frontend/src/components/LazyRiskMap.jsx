import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Spinner from "./common/Spinner";

// RiskMap.jsx pulls in Leaflet + react-leaflet + the map CSS (~160 KB),
// code-split into its own async chunk. This wrapper decides *when* to
// pull that chunk:
//   - eager  : load straight away (the dedicated /map page)
//   - else   : wait until the map scrolls near the viewport, so it never
//              blocks or slows the first paint of a page it's only part
//              of (e.g. Home).
const RiskMap = lazy(() => import("./RiskMap"));

function LazyRiskMap({ eager = false, ...mapProps }) {
  const [show, setShow] = useState(
    () => eager || !(typeof window !== "undefined" && "IntersectionObserver" in window)
  );
  const ref = useRef(null);

  useEffect(() => {
    if (show) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [show]);

  return (
    <div ref={ref} className="h-full w-full">
      {show ? (
        <Suspense fallback={<Spinner label="Loading map…" />}>
          <RiskMap {...mapProps} />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-400">
          Map loads as you scroll…
        </div>
      )}
    </div>
  );
}

export default LazyRiskMap;
