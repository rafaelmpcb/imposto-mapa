import type { ReactNode, SelectHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={controlClass} />;
}

export function MoneyInput({
  value,
  onChange,
  suffix = "R$",
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
      <span className="flex items-center bg-secondary px-3 text-sm font-medium text-muted-foreground">
        {suffix}
      </span>
      <input
        inputMode="decimal"
        type="number"
        min={0}
        step="0.01"
        value={Number.isFinite(value) && value !== 0 ? value : value === 0 ? "" : ""}
        placeholder="0,00"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-card px-3 py-2.5 text-base outline-none"
      />
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  suffix,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  max?: number;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
      <input
        type="number"
        min={0}
        max={max}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-card px-3 py-2.5 text-base outline-none"
      />
      {suffix ? (
        <span className="flex items-center bg-secondary px-3 text-sm font-medium text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-navy text-navy-foreground hover:bg-primary"
      : "border border-input bg-card text-foreground hover:bg-secondary";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "warning";
  children: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-warning/40 bg-warning-soft text-foreground"
      : "border-border bg-secondary text-muted-foreground";
  return (
    <p className={`rounded-md border px-4 py-3 text-xs leading-relaxed ${styles}`}>{children}</p>
  );
}
