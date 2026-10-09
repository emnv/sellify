"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

type Props = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Text while the form is submitting, e.g. "Saving…". */
  pendingText?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  /** Accessible name when the visible text is short, e.g. "Remove" in a table row. */
  "aria-label"?: string;
};

/** Submit button that shows a spinner while its parent <form> action runs. */
export function SubmitButton({ children, pendingText, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
