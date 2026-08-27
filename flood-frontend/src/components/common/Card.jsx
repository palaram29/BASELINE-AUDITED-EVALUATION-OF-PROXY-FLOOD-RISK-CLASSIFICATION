/**
 * The standard surface container. `title`/`subtitle`/`icon`/`action` render
 * an optional header row; otherwise it's just a padded panel.
 */
function Card({
  children,
  className = "",
  title,
  subtitle,
  icon: Icon,
  action,
  hover = false,
  padding = "p-6",
}) {
  const hasHeader = title || subtitle || action;

  return (
    <div className={`card ${hover ? "card-hover" : ""} ${padding} ${className}`}>
      {hasHeader ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            ) : null}
            <div>
              {title ? (
                <h3 className="text-base font-semibold text-heading">{title}</h3>
              ) : null}
              {subtitle ? (
                <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export default Card;
