import { useCallback } from "react";
import { Link } from "react-router-dom";
import { FiBell, FiChevronRight } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import useLiveData from "../hooks/useLiveData";
import { getMyAlert, getLatestPrediction } from "../services/dataService";
import RiskHero from "../components/RiskHero";
import NationalSnapshot from "../components/NationalSnapshot";
import EmergencyContacts from "../components/EmergencyContacts";
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

  const secondary = (
    <>
      {predLoading && !predictions?.length ? (
        <Spinner label="Loading the national picture…" />
      ) : (
        <NationalSnapshot predictions={predictions || []} />
      )}
      <div className="flex justify-end">
        <DataFreshness timestamp={lastUpdated} />
      </div>
      <EmergencyContacts />
    </>
  );

  const accountLink = user ? (
    <Link
      to="/account"
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      Change your area or review past alerts
      <FiChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  ) : null;

  // Logged-in: two-column on large screens (the risk hero is tall enough
  // to balance the snapshot + contacts column). Anonymous: a single
  // centred column, since the CTA card alone can't fill half the width.
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {primary}
        {predError ? <ErrorMessage message={predError} onRetry={refresh} /> : null}
        {secondary}
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6">
      <div className="space-y-4 lg:col-span-2">
        {primary}
        {predError ? <ErrorMessage message={predError} onRetry={refresh} /> : null}
        {accountLink}
      </div>
      <div className="mt-4 space-y-4 lg:mt-0">{secondary}</div>
    </div>
  );
}

export default Home;
