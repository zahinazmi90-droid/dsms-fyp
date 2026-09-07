import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  full?: boolean;
};

const variants: Record<string, string> = {
  primary: "bg-primary text-white hover:bg-[var(--primary-dark)] disabled:opacity-50",
  secondary: "bg-white text-ink border border-line hover:bg-[var(--surface)] disabled:opacity-50",
  danger: "bg-[var(--status-late)] text-white hover:opacity-90 disabled:opacity-50",
  ghost: "bg-transparent text-ink-soft hover:bg-[var(--surface)]",
};

export function Button({ variant = "primary", full, className = "", ...props }: Props) {
  return (
    <button
      className={`${variants[variant]} ${full ? "w-full" : ""} rounded-xl px-4 py-3 font-semibold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      {...props}
    />
  );
}
