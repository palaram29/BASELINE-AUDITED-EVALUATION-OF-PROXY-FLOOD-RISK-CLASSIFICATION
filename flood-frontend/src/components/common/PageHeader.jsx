/**
 * Standard page title block. Keeps every page's heading, description,
 * eyebrow label and action area visually consistent.
 */
function PageHeader({ eyebrow, title, description, badge, actions, meta, children }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-[0.95rem]">
            {description}
          </p>
        ) : null}
        {meta ? <p className="mt-1.5 text-xs text-faint">{meta}</p> : null}
      </div>
      {actions || children ? (
        <div className="flex flex-col items-start gap-3 lg:items-end">
          {actions}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default PageHeader;
