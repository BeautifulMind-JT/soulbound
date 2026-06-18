import React, { type ReactNode } from "react";
import styles from "./ui.module.css";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "plain" | "warm" | "sunken";
}

export function Card({ children, className, tone = "plain" }: CardProps) {
  return (
    <section
      className={[styles.card, styles[`card-${tone}`], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
