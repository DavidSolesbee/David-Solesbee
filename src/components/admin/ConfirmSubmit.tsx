"use client";

import { Button, type ButtonProps } from "@/components/ui/Button";

/**
 * Submit button that requires an explicit confirmation for destructive or
 * high-impact security actions. The `confirm` message should explain the effect
 * of the action before it executes.
 */
export function ConfirmSubmit({
  confirm,
  children,
  ...props
}: ButtonProps & { confirm: string }) {
  return (
    <Button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
