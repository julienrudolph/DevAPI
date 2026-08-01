import { Tooltip as FluentTooltip } from "@fluentui/react-components";
import type { ReactElement } from "react";

export interface TooltipProps {
  children: ReactElement;
  content: string;
  relationship?: "description" | "label";
}

export function Tooltip({
  children,
  content,
  relationship = "label",
}: TooltipProps) {
  return (
    <FluentTooltip content={content} relationship={relationship}>
      {children}
    </FluentTooltip>
  );
}
