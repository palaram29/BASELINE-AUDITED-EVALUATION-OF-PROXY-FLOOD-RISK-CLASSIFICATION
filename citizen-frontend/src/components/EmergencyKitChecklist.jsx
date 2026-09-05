import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import Card from "./common/Card";
import { EMERGENCY_KIT_ITEMS } from "../utils/guidance";

const STORAGE_KEY = "citizen_emergency_kit_checked";

function loadChecked() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Lets a resident tick off what they already have packed. Purely a local
// convenience - state lives in this browser only, nothing is sent to the
// backend.
function EmergencyKitChecklist() {
  const [checked, setChecked] = useState(loadChecked);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // Ignore write failures (e.g. private browsing storage limits).
    }
  }, [checked]);

  const toggle = (item) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  const doneCount = EMERGENCY_KIT_ITEMS.filter((item) => checked[item]).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Emergency kit checklist
        </h2>
        <span className="text-xs font-medium text-slate-400">
          {doneCount}/{EMERGENCY_KIT_ITEMS.length} packed
        </span>
      </div>
      <ul className="mt-3 space-y-1">
        {EMERGENCY_KIT_ITEMS.map((item) => {
          const isChecked = Boolean(checked[item]);
          return (
            <li key={item}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition hover:bg-slate-50">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isChecked
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                  aria-hidden="true"
                >
                  {isChecked ? <FiCheck className="h-3 w-3" /> : null}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={() => toggle(item)}
                />
                <span className={isChecked ? "text-slate-400 line-through" : "text-slate-700"}>
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default EmergencyKitChecklist;
