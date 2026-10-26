import Link from "next/link";
import type { ReactNode } from "react";

export type EmptyKind = "played" | "no-history" | "zero-streak" | "loading" | "error";

/** Every dead end gets one next step (one blue button). Line icon + two lines of text. */
export function EmptyState({ kind, title, body, action, children }: {
  kind: EmptyKind;
  title: string;
  body?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  children?: ReactNode;
}) {
  return (
    <section className={`fd-card fd-empty fd-empty-${kind}`} aria-live={kind === "error" ? "assertive" : undefined}>
      <svg className="fd-empty-icon" viewBox="0 0 48 48" aria-hidden="true">
        {kind === "error" ? <path d="M24 8 L42 40 H6 Z M24 20 V30 M24 35 V36" /> : kind === "played" ? <path d="M24 6 A18 18 0 1 0 24.01 6 M24 14 V24 L31 29" /> : <path d="M10 38 H38 M14 30 L22 22 L28 28 L38 16" />}
      </svg>
      <h2 className="fd-empty-title">{title}</h2>
      {body ? <div className="fd-empty-body">{body}</div> : null}
      {children}
      {action ? (
        action.href ? (
          <Link className="fd-btn fd-btn-primary fd-empty-btn" href={action.href}>{action.label}</Link>
        ) : (
          <button type="button" className="fd-btn fd-btn-primary fd-empty-btn" onClick={action.onClick}>{action.label}</button>
        )
      ) : null}
    </section>
  );
}

/** Loading: gray blocks the size of the card, no spinner. */
export function CardSkeleton({ label }: { label: string }) {
  return (
    <section className="fd-card fd-skel" aria-busy="true" aria-label={label}>
      <span className="fd-skel-line w40" />
      <span className="fd-skel-line w90 tall" />
      <span className="fd-skel-block" />
      <span className="fd-skel-row"><span /><span /><span /></span>
      <span className="fd-skel-line w100 tall" />
    </section>
  );
}
