import { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import { promoteModelVersion } from "../../services/mlopsService";

const STATUS_TONE = { Production: "green", Candidate: "blue", Validation: "yellow", Archived: "slate" };

// Latest registered version per algorithm, with the promote/rollback
// action - the same action ("Promote"/"Rollback to this") whether the
// target is a fresh Candidate or an older Archived version; the backend
// (mlops_service.promote_model_version) has one code path for both.
function ModelRegistryPanel({ modelVersions = [], onPromoted }) {
  const [promotingId, setPromotingId] = useState(null);
  const [actionError, setActionError] = useState("");

  const handlePromote = async (versionId) => {
    setPromotingId(versionId);
    setActionError("");
    try {
      await promoteModelVersion(versionId);
      onPromoted?.();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Promotion failed.");
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold text-heading">Model Registry</h3>
      {actionError ? <p className="mb-3 text-sm text-red-600">{actionError}</p> : null}

      {modelVersions.length ? (
        <div className="space-y-3">
          {modelVersions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <div>
                <p className="font-medium text-body">{v.algorithm} v{v.version}</p>
                <p className="text-xs text-muted">
                  Macro-F1 {v.macro_f1 != null ? `${(v.macro_f1 * 100).toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[v.status] || "slate"}>{v.status}</Badge>
                {v.status !== "Production" ? (
                  <button
                    onClick={() => handlePromote(v.id)}
                    disabled={promotingId === v.id}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-strong disabled:opacity-50"
                  >
                    {promotingId === v.id ? "Promoting..." : v.status === "Archived" ? "Rollback to this" : "Promote"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No registered versions yet"
          description="Run `python ML/register_run.py` after training to populate this list."
        />
      )}
    </Card>
  );
}

export default ModelRegistryPanel;
