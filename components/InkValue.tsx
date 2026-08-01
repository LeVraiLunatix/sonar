import type { ReactNode } from "react";

/** Valeur imprimée en deux passages, comme le grand compteur de Sonar. */
export default function InkValue({
  children,
  as: Tag = "strong",
  className = "",
}: {
  children: ReactNode;
  as?: "span" | "strong";
  className?: string;
}) {
  return (
    <Tag className={`inkvalue ${className}`.trim()}>
      <span className="inkvalue__ghost" aria-hidden="true">{children}</span>
      <span className="inkvalue__ink">{children}</span>
    </Tag>
  );
}
