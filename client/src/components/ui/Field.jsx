import { Children, cloneElement, useId } from 'react';

/**
 * Label + control + optional hint / error text.
 * The label is linked with htmlFor, and hint/error text is attached to the control with
 * aria-describedby, so screen readers announce them without making the label name noisy.
 * `children` must be a single input, select or textarea.
 */
export default function Field({ label, hint, error, children }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;

  const control = cloneElement(Children.only(children), {
    id,
    'aria-describedby': note ? noteId : undefined,
    'aria-invalid': error ? true : undefined,
  });

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {control}
      {note && (
        <p id={noteId} role={error ? 'alert' : undefined} className={`mt-1 text-xs ${error ? 'font-medium text-danger' : 'text-muted'}`}>
          {note}
        </p>
      )}
    </div>
  );
}
