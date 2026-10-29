import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onDark?: boolean;
  size?: "md" | "lg";
  loading?: boolean;
}

function look(variant: NonNullable<ButtonProps["variant"]>, onDark: boolean): string {
  switch (variant) {
    case "primary":
      return onDark ? "bg-ticket text-ink border-ticket" : "bg-ink text-paper border-ink";
    case "secondary":
      return onDark ? "bg-transparent text-paper border-paper" : "bg-transparent text-ink border-ink";
    case "danger":
      return "bg-stamp-red text-paper border-stamp-red";
    case "ghost":
      return onDark
        ? "bg-transparent text-paper border-transparent underline"
        : "bg-transparent text-ink border-transparent underline";
  }
}

export function Button({
  variant = "primary",
  onDark = false,
  size = "md",
  loading = false,
  disabled,
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const height = size === "lg" ? "h-13 text-18" : "h-11 text-15";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border-2 px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${height} ${look(variant, onDark)} ${className}`}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
