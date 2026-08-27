/**
 * Shared button. Variants: primary | secondary | ghost | danger.
 * Renders an <a> when `href` is passed, otherwise a <button>.
 */
const VARIANTS = {
  primary:
    "bg-brand text-brand-contrast shadow-sm hover:bg-brand-strong active:translate-y-px",
  secondary:
    "border border-line-strong bg-surface text-body hover:bg-surface-2 active:translate-y-px",
  ghost: "text-muted hover:bg-surface-2 hover:text-heading",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:translate-y-px",
};

const SIZES = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight = false,
  className = "",
  href,
  type = "button",
  ...props
}) {
  const classes = `inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
    VARIANTS[variant] || VARIANTS.primary
  } ${SIZES[size] || SIZES.md} ${className}`;

  const content = (
    <>
      {Icon && !iconRight ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
      {Icon && iconRight ? <Icon className="h-4 w-4 shrink-0" /> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {content}
    </button>
  );
}

export default Button;
