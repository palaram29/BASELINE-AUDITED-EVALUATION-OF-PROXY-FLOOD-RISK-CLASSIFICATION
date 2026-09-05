import { FiShield } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import Card from "../components/common/Card";
import EmergencyContacts from "../components/EmergencyContacts";
import EmergencyKitChecklist from "../components/EmergencyKitChecklist";
import { PRECAUTION_SECTIONS } from "../utils/guidance";

function Safety() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 sm:text-2xl">
          <FiShield className="h-5 w-5 text-blue-600" aria-hidden="true" />
          Flood safety precautions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          General guidance on what to do before, during, and after a flood
          {user ? `, for residents of ${user.alert_city} and beyond` : ""}.
        </p>
      </div>

      {PRECAUTION_SECTIONS.map((section) => (
        <Card key={section.id}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {section.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{section.intro}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {section.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <EmergencyKitChecklist />

      <EmergencyContacts />

      <p className="text-xs text-slate-400">
        This page is general flood-preparedness guidance, not an official
        evacuation order. Always follow instructions from the Disaster
        Management Centre and local authorities.
      </p>
    </div>
  );
}

export default Safety;
