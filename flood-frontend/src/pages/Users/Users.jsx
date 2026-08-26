import { useMemo, useState } from "react";
import useUsers from "../../hooks/useUsers";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import ErrorMessage from "../../components/common/ErrorMessage";
import EmptyState from "../../components/common/EmptyState";
import Skeleton from "../../components/common/Skeleton";
import { riskTone } from "../../utils/riskTone";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function Users() {
  const { users, loading, error } = useUsers();
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.alert_city].some((field) =>
        (field || "").toLowerCase().includes(query)
      )
    );
  }, [users, search]);

  const citiesCovered = useMemo(
    () => new Set(users.map((user) => user.alert_city).filter(Boolean)).size,
    [users]
  );
  const usersUnderAlert = useMemo(
    () => users.filter((user) => user.current_is_alert).length,
    [users]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">User management</h1>
          <p className="mt-2 text-slate-500">
            Everyone who has registered for personalized flood alerts through the citizen app,
            and the current live risk for the area each one is subscribed to.
          </p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, or city"
          className="w-full rounded-lg border border-slate-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-80"
        />
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-sm text-slate-500">Registered users</p>
              <p className="mt-2 text-3xl font-semibold text-slate-800">{users.length}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Cities subscribed</p>
              <p className="mt-2 text-3xl font-semibold text-slate-800">{citiesCovered}</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Users currently under alert</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-800">{usersUnderAlert}</p>
                </div>
                {usersUnderAlert > 0 ? <Badge tone="red">Action may be needed</Badge> : null}
              </div>
            </Card>
          </div>

          <Card>
            {users.length === 0 ? (
              <EmptyState
                title="No registrations yet"
                description="Users who sign up through the citizen app for personalized flood alerts will appear here."
              />
            ) : filteredUsers.length === 0 ? (
              <EmptyState title="No matches" description="No registered user matches that search." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-left text-sm text-slate-600">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Alert city</th>
                      <th className="px-4 py-3">Current risk</th>
                      <th className="px-4 py-3">Notifications</th>
                      <th className="px-4 py-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-200 text-sm">
                        <td className="px-4 py-3 font-medium text-slate-700">{user.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{user.email}</td>
                        <td className="px-4 py-3 text-slate-600">{user.phone || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{user.alert_city}</td>
                        <td className="px-4 py-3">
                          {user.current_risk_label ? (
                            <Badge tone={riskTone(user.current_risk_level)}>{user.current_risk_label}</Badge>
                          ) : (
                            <span className="text-slate-400">No data</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {user.notification_count}
                          {user.last_notified_at ? (
                            <span className="ml-1 text-xs text-slate-400">
                              (last {formatDate(user.last_notified_at)})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default Users;
