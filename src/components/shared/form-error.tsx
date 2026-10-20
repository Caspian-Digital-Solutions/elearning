/** The plain summary at the top of a form, or next to a field. Announced to screen readers. */
export function FormError({ children, id }: { children?: string | null; id?: string }) {
  if (!children) {
    return null;
  }
  return (
    <p id={id} role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function FieldError({ children, id }: { children?: string | null; id: string }) {
  if (!children) {
    return null;
  }
  return (
    <p id={id} className="text-sm text-danger">
      {children}
    </p>
  );
}
