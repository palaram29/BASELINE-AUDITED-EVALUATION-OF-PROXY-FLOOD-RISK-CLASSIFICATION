import { useCallback } from "react";
import { Link } from "react-router-dom";
import { FiBell, FiChevronRight, FiMaximize2 } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import useLiveData from "../hooks/useLiveData";
import { getMyAlert, getLatestPrediction, getLatestRiver } from "../services/dataService";
import RiskHero from "../components/RiskHero";
import NationalSnapshot from "../components/NationalSnapshot";
import EmergencyContacts from "../components/EmergencyContacts";
import LazyRiskMap from "../components/LazyRiskMap";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import ErrorMessage from "../components/common/ErrorMessage";
import DataFreshness from "../components/common/DataFreshness";

function Home() {
  const { user, loading: authLoading } = useAuth();

  // Only hit /alerts/me when logged in - anonymous visitors get a
  // resolved null instead of a guaranteed 401.
  const alertFetcher = useCallback(
    () => (user ? getMyAlert() : Promise.resolve(null)),
    [user]
  );
  const { data: alert, loading: alertLoading } = useLiveData(alertFetcher, {
    intervalMs: user ? 60000 : 0,
  });
  const {
    data: predictions,
    loading: predLoading,
    error: predError,
    lastUpdated,
    refresh,
  } = useLiveData(getLatestPrediction, { intervalMs: 60000, initial: [] });
  const { data: rivers } = useLiveData(getLatestRiver, { intervalMs: 60000, initial: [] });

  if (authLoading) return <Spinner label="Loading…" />;

  const primary = user ? (
    alertLoading && !alert ? (
      <Spinner label={`Checking conditions for ${user.alert_city}…`} />
    ) : (
      <RiskHero city={user.alert_city} alert={alert} />
    )
  ) : (
    <Card className="border-blue-200 bg-blue-50">
      <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Know your flood risk</h1>
      <p className="mt-1 text-sm text-slate-600">
        Register with your area to get flood alerts here whenever the risk rises.
      </p>
      <Link
        to="/register"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        <FiBell className="h-4 w-4" aria-hidden="true" />
        Get alerts for my area
      </Link>
    </Card>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {primary}

      {predError ? <ErrorMessage message={predError} onRetry={refresh} /> : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Flood risk map</h2>
          <Link
            to="/map"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            <FiMaximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            Full map
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="h-[300px] w-full sm:h-[360px]">
            <LazyRiskMap
              predictions={predictions || []}
              rivers={rivers || []}
              homeCity={user?.alert_city || null}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {predLoading && !predictions?.length ? (
          <Spinner label="Loading the national picture…" />
        ) : (
          <NationalSnapshot predictions={predictions || []} />
        )}
        <EmergencyContacts />
      </div>

      <div className="flex justify-end">
        <DataFreshness timestamp={lastUpdated} />
      </div>

      {user ? (
        <Link
          to="/account"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Change your area or review past alerts
          <FiChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export default Home;
