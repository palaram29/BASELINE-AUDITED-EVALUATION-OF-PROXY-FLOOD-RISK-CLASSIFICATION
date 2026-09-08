import { useMemo, useState } from "react";
import {
  FiHome,
  FiMapPin,
  FiCheckCircle,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import useShelters from "../../hooks/useShelters";
import { createShelter, updateShelter, deleteShelter } from "../../services/shelterService";
import PageHeader from "../../components/common/PageHeader";
import Card from "../../components/common/Card";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import ErrorMessage from "../../components/common/ErrorMessage";
import EmptyState from "../../components/common/EmptyState";
import Skeleton from "../../components/common/Skeleton";
import SummaryCard from "../../components/cards/SummaryCard";
import ShelterLocationPicker from "../../components/maps/ShelterLocationPicker";

// Same 30 monitored cities as backend/config.py's CITIES - suggested, not
// enforced, so a shelter's city text should match one of these to get a
// live risk badge, but an operator can still enter somewhere else.
const MONITORED_CITIES = [
  "Colombo", "Mount Lavinia", "Kesbewa", "Moratuwa", "Maharagama", "Ratnapura",
  "Kandy", "Negombo", "Sri Jayewardenepura Kotte", "Kalmunai", "Trincomalee",
  "Galle", "Jaffna", "Athurugiriya", "Weligama", "Matara", "Kolonnawa",
  "Gampaha", "Puttalam", "Badulla", "Kalutara", "Bentota", "Matale", "Mannar",
  "Pothuhera", "Kurunegala", "Mabole", "Hatton", "Hambantota", "Oruwala",
];

const SHELTER_TYPES = [
  { value: "school", label: "School" },
  { value: "temple", label: "Temple / religious site" },
  { value: "community_hall", label: "Community hall" },
  { value: "government_building", label: "Government building" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  name: "",
  type: "school",
  city: "",
  capacity: "",
  contact_phone: "",
  latitude: null,
  longitude: null,
  is_active: true,
};

function Shelters() {
  const { shelters, loading, error, refresh } = useShelters();
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = creating, else shelter.id
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const activeCount = useMemo(() => shelters.filter((s) => s.is_active).length, [shelters]);
  const citiesCovered = useMemo(
    () => new Set(shelters.map((s) => s.city).filter(Boolean)).size,
    [shelters]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingId("new");
  };

  const openEdit = (shelter) => {
    setForm({
      name: shelter.name,
      type: shelter.type,
      city: shelter.city,
      capacity: shelter.capacity ?? "",
      contact_phone: shelter.contact_phone || "",
      latitude: shelter.latitude,
      longitude: shelter.longitude,
      is_active: shelter.is_active,
    });
    setFormError("");
    setEditingId(shelter.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim() || !form.city.trim()) {
      setFormError("Name and city are required.");
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      setFormError("Click the map to set this shelter's location.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      city: form.city.trim(),
      capacity: form.capacity === "" ? null : Number(form.capacity),
      contact_phone: form.contact_phone.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editingId === "new") {
        await createShelter(payload);
      } else {
        await updateShelter(editingId, payload);
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Couldn't save this shelter. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shelter) => {
    if (!window.confirm(`Remove "${shelter.name}" permanently? This can't be undone.`)) return;
    try {
      await deleteShelter(shelter.id);
      await refresh();
    } catch (err) {
      console.error(err);
      window.alert("Couldn't delete this shelter. Please try again.");
    }
  };

  const toggleActive = async (shelter) => {
    try {
      await updateShelter(shelter.id, { is_active: !shelter.is_active });
      await refresh();
    } catch (err) {
      console.error(err);
      window.alert("Couldn't update this shelter's status. Please try again.");
    }
  };

  const isFormOpen = editingId !== null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Shelter management"
        description="Designated flood shelters shown to citizens for the nearest-shelter safety feature. Shelter designation changes per event, so keep this list current - retire a shelter with the toggle rather than leaving a stale one active."
        actions={
          !isFormOpen ? (
            <Button icon={FiPlus} onClick={openCreate}>
              Add shelter
            </Button>
          ) : null
        }
      />

      {error ? <ErrorMessage message={error} onRetry={refresh} /> : null}

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
            <SummaryCard title="Total shelters" value={shelters.length} icon={FiHome} tone="blue" />
            <SummaryCard title="Currently active" value={activeCount} icon={FiCheckCircle} tone="green" />
            <SummaryCard title="Cities covered" value={citiesCovered} icon={FiMapPin} tone="slate" />
          </div>

          {isFormOpen ? (
            <Card
              title={editingId === "new" ? "Add a shelter" : "Edit shelter"}
              action={
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-heading"
                  aria-label="Cancel"
                >
                  <FiX className="h-4 w-4" />
                </button>
              }
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError ? <ErrorMessage message={formError} /> : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Kaduwela Central College"
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-body shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-body shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {SHELTER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">City</label>
                    <input
                      required
                      list="monitored-cities"
                      value={form.city}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="e.g. Colombo"
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-body shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <datalist id="monitored-cities">
                      {MONITORED_CITIES.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-faint">
                      Match a monitored city name exactly to show its live flood-risk to citizens.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Capacity (optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.capacity}
                      onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
                      placeholder="e.g. 200"
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-body shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Contact phone (optional)</label>
                    <input
                      type="tel"
                      value={form.contact_phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                      placeholder="e.g. 0112345678"
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-body shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-body">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                        className="h-4 w-4 rounded border-line-strong"
                      />
                      Active (shown to citizens)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Location</label>
                  <ShelterLocationPicker
                    key={editingId}
                    latitude={form.latitude}
                    longitude={form.longitude}
                    onChange={(lat, lon) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lon }))}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={closeForm} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : editingId === "new" ? "Add shelter" : "Save changes"}
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card title="Shelters" subtitle={`${shelters.length} total`}>
            {shelters.length === 0 ? (
              <EmptyState
                title="No shelters yet"
                description="Add the flood shelters citizens should be routed to from the safety page."
                icon={FiHome}
              />
            ) : (
              <div className="-mx-2 overflow-x-auto rounded-xl border border-line sm:mx-0">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>City</th>
                      <th>Capacity</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shelters.map((shelter) => (
                      <tr key={shelter.id}>
                        <td className="wrap">{shelter.name}</td>
                        <td className="text-muted">
                          {SHELTER_TYPES.find((t) => t.value === shelter.type)?.label || shelter.type}
                        </td>
                        <td className="text-muted">{shelter.city}</td>
                        <td className="text-muted">{shelter.capacity ?? "—"}</td>
                        <td className="text-muted">{shelter.contact_phone || "—"}</td>
                        <td>
                          <button type="button" onClick={() => toggleActive(shelter)}>
                            <Badge tone={shelter.is_active ? "green" : "slate"}>
                              {shelter.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(shelter)}
                              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-heading"
                              aria-label={`Edit ${shelter.name}`}
                            >
                              <FiEdit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(shelter)}
                              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              aria-label={`Delete ${shelter.name}`}
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
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

export default Shelters;
