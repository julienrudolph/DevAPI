import {
  Dialog as FluentDialog,
  DialogSurface,
} from "@fluentui/react-components";
import {
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";

export function Dialog({
  children,
  className,
  descriptionId,
  onClose,
  titleId,
}: {
  children: ReactNode;
  className?: string;
  descriptionId?: string;
  onClose: () => void;
  titleId: string;
}) {
  return (
    <FluentDialog
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
      open
    >
      <DialogSurface
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={cn("conflict-dialog", className)}
      >
        {children}
      </DialogSurface>
    </FluentDialog>
  );
}

export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dialog-header", className)} {...props} />;
}

export function DialogBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dialog-body", className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dialog-actions", className)} {...props} />;
}
