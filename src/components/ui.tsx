import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-300",
  secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400",
  danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300",
  ghost: "text-stone-700 hover:bg-stone-200 disabled:text-stone-400",
};

export function Button({ variant = "secondary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx("inline-flex min-h-10 items-center justify-center gap-1 rounded-md px-3 py-2 font-medium transition disabled:cursor-not-allowed", VARIANTS[variant], className)}
    />
  );
}

export function Card({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx("min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-sm", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const inputBase = "w-full rounded-md border border-stone-300 bg-white px-3 py-2 shadow-inner-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-stone-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputBase, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, props.className)} />;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-800",
    info: "border-sky-300 bg-sky-50 text-sky-900",
    success: "border-green-300 bg-green-50 text-green-800",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cx("rounded-md border px-3 py-2 text-sm", styles)}>
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  utkast: "bg-stone-200 text-stone-800",
  granskad: "bg-sky-100 text-sky-800",
  skickad: "bg-amber-100 text-amber-900",
  accepterad: "bg-green-100 text-green-800",
  avböjd: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[status] ?? STATUS_STYLES.utkast)}>{label}</span>;
}
