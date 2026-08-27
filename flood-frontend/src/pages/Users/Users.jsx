import { useMemo, useState } from "react";
import { FiUsers, FiMapPin, FiAlertTriangle } from "react-icons/fi";
import useUsers from "../../hooks/useUsers";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import ErrorMessage from "../../components/common/ErrorMessage";
import EmptyState from "../../components/common/EmptyState";
import Skeleton from "../../components/common/Skeleton";
import SummaryCard from "../../components/cards/SummaryCard";
import SearchInput from "../../components/common/SearchInput";
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
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Everyone registered for personalized flood alerts through the citizen app, and the current live risk for the area each one is subscribed to."
      >
        <SearchInput value={search} placeholder="Search name, email, or city" onSearch={setSearch} />
      </PageHeader>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            <SummaryCard title="Registered users" value={users.length} icon={FiUsers} tone="blue" />
            <SummaryCard title="Cities subscribed" value={citiesCovered} icon={FiMapPin} tone="green" />
            <SummaryCard
              title="Users currently under alert"
              value={usersUnderAlert}
              icon={FiAlertTriangle}
              tone={usersUnderAlert > 0 ? "red" : "slate"}
              hint={usersUnderAlert > 0 ? "Action may be needed" : "All areas clear"}
            />
          </div>

          <Card title="Registrations" subtitle={`${filteredUsers.length} of ${users.length} shown`}>
            {users.length === 0 ? (
              <EmptyState
                title="No registrations yet"
                description="Users who sign up through the citizen app for personalized flood alerts will appear here."
              />
            ) : filteredUsers.length === 0 ? (
              <EmptyState title="No matches" description="No registered user matches that search." />
            ) : (
              <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Alert city</th>
                      <th>Current risk</th>
                      <th>Notifications</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="wrap">{user.full_name}</td>
                        <td className="wrap text-muted">{user.email}</td>
                        <td className="text-muted">{user.phone || "—"}</td>
                        <td className="text-muted">{user.alert_city}</td>
                        <td>
                          {user.current_risk_label ? (
                            <Badge tone={riskTone(user.current_risk_level)}>
                              {user.current_risk_label}
                            </Badge>
                          ) : (
                            <span className="text-faint">No data</span>
                          )}
                        </td>
                        <td className="text-muted">
                          {user.notification_count}
                          {user.last_notified_at ? (
                            <span className="ml-1 text-xs text-faint">
                              (last {formatDate(user.last_notified_at)})
                            </span>
                          ) : null}
                        </td>
                        <td className="text-muted">{formatDate(user.created_at)}</td>
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
