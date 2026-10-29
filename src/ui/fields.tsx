import { useId } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const control =
  "h-11 w-full rounded-md border-2 bg-paper-2 px-3 text-15 text-ink placeholder:text-muted focus:border-ink disabled:opacity-50";

function Messages({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-13 text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-13 font-bold text-ink">
          <span aria-hidden className="mr-1 inline-block size-2 rounded-sm bg-stamp-red" />
          {error}
        </p>
      )}
    </>
  );
}

function describedBy(id: string, error?: string, hint?: string, extra?: string): string | undefined {
  const ids = [error && `${id}-error`, hint && `${id}-hint`, extra].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id: idProp, className = "", "aria-describedby": extraDesc, ...rest }: TextFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className="text-ink">
      <label htmlFor={id} className="mb-1 block text-13 font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint, extraDesc)}
        className={`${control} ${error ? "border-stamp-red" : "border-muted"} ${className}`}
        {...rest}
      />
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
}

export function SelectField({ label, error, hint, options, id: idProp, className = "", "aria-describedby": extraDesc, ...rest }: SelectFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className="text-ink">
      <label htmlFor={id} className="mb-1 block text-13 font-bold">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint, extraDesc)}
        className={`${control} ${error ? "border-stamp-red" : "border-muted"} ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}
