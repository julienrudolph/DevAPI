import {
  Button as FluentButton,
  type ButtonProps as FluentButtonProps,
} from "@fluentui/react-components";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactElement,
} from "react";

import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "small";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      size = "default",
      type = "button",
      variant = "secondary",
      ...props
    },
    ref,
  ) {
    const appearance: FluentButtonProps["appearance"] =
      variant === "primary"
        ? "primary"
        : variant === "ghost"
          ? "subtle"
          : "secondary";

    return (
      <FluentButton
        appearance={appearance}
        className={cn(variant === "danger" && "relay-danger", className)}
        ref={ref}
        size={size === "small" ? "small" : "medium"}
        type={type}
        {...props}
      >
        {children}
      </FluentButton>
    );
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  children: ReactElement;
  size?: "default" | "compact";
  variant?: "ghost" | "danger";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className,
      size = "default",
      type = "button",
      variant = "ghost",
      ...props
    },
    ref,
  ) {
    return (
      <FluentButton
        appearance="subtle"
        className={cn(variant === "danger" && "relay-danger", className)}
        icon={children}
        size={size === "compact" ? "small" : "medium"}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);
