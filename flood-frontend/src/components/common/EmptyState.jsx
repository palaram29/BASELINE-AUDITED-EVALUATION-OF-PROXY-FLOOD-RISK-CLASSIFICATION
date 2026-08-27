import { FiInbox } from "react-icons/fi";

function EmptyState({ title, description, icon: Icon = FiInbox, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-faint ring-1 ring-line">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
