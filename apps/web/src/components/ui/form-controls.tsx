import {
  Input as FluentInput,
  type InputProps as FluentInputProps,
  Label as FluentLabel,
  Select as FluentSelect,
  type SelectProps as FluentSelectProps,
  Textarea as FluentTextarea,
  type TextareaProps as FluentTextareaProps,
} from "@fluentui/react-components";
import {
  forwardRef,
  type LabelHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";

export const Input = forwardRef<
  HTMLInputElement,
  FluentInputProps
>(function Input({ className, ...props }, ref) {
  return (
    <FluentInput className={cn("relay-control", className)} ref={ref} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  FluentSelectProps
>(function Select({ className, ...props }, ref) {
  return (
    <FluentSelect
      className={cn("relay-control", className)}
      ref={ref}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  FluentTextareaProps
>(function Textarea({ className, ...props }, ref) {
  return (
    <FluentTextarea
      className={cn("relay-control", className)}
      ref={ref}
      {...props}
    />
  );
});

export function Field({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("ui-field", className)}>{children}</div>;
}

export function FieldLabel({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <FluentLabel className={cn("ui-field-label", className)} {...props}>
      {children}
    </FluentLabel>
  );
}

export function FieldError({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <p className="field-error" id={id} role="alert">
      {children}
    </p>
  );
}
