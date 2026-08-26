import { FiPhone } from "react-icons/fi";
import Card from "./common/Card";
import { EMERGENCY_CONTACTS } from "../utils/guidance";

function EmergencyContacts() {
  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Emergency contacts
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {EMERGENCY_CONTACTS.map((contact) => (
          <li key={contact.number} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-700">{contact.label}</span>
            <a
              href={`tel:${contact.number}`}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-800 transition hover:bg-slate-200"
            >
              <FiPhone className="h-3.5 w-3.5" aria-hidden="true" />
              {contact.number}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default EmergencyContacts;
