import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Epistemic, Evidence, Source } from "../../core/schema";
import type { EvidenceAssessment } from "../../core/scoring";
import { domain, fmtDate, useLab } from "../data";

export function Pill({ kind, children, title }: { kind: string; children: ReactNode; title?: string }) {
  return (
    <span className={`pill pill-${kind}`} title={title}>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <Pill kind={`status-${status}`}>{status}</Pill>;
}

const EPI_HELP: Record<Epistemic, string> = {
  fact: "Observed fact: directly stated by the cited source",
  inference: "Reasonable inference drawn from evidence",
  hypothesis: "Unverified hypothesis: needs testing",
  speculation: "Speculative idea: low evidential support",
};
export function EpiBadge({ e }: { e: Epistemic }) {
  return (
    <span className={`epi epi-${e}`} title={EPI_HELP[e]}>
      {e}
    </span>
  );
}

export function Meter({ value, label, tone, hint }: { value: number; label: string; tone: "attract" | "evidence"; hint?: string }) {
  return (
    <div className={`meter meter-${tone}`} title={hint}>
      <div className="meter-head">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${Math.max(2, value)}%` }} />
      </div>
    </div>
  );
}

export function EvidenceLevel({ a }: { a: EvidenceAssessment }) {
  return (
    <span className={`level level-${a.level}`} title={a.explanation.join("\n")}>
      {a.level === "none" ? "no evidence" : `${a.level} evidence`}
    </span>
  );
}

export function Section({ title, kicker, children, id, aside }: { title: string; kicker?: string; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        <div>
          {kicker && <div className="kicker">{kicker}</div>}
          <h2>{title}</h2>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

const VERIFY_LABEL: Record<Source["verification"]["status"], string> = {
  ok: "quote verified",
  unchecked: "not yet re-checked",
  "quote-missing": "quote not found on re-check",
  unreachable: "unreachable on re-check",
  blocked: "site blocks automated checks",
};
export function VerifyBadge({ v }: { v: Source["verification"] }) {
  return (
    <span className={`verify verify-${v.status}`} title={[v.note, v.checkedAt && `checked ${fmtDate(v.checkedAt)}`].filter(Boolean).join(" · ")}>
      {VERIFY_LABEL[v.status]}
    </span>
  );
}

export function SourceLine({ s }: { s: Source }) {
  return (
    <div className="source-line">
      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
        {s.title}
      </a>
      <span className="muted">
        {" "}
        · {s.publisher} · {domain(s.url)}
        {s.publishedAt ? ` · published ${s.publishedAt.slice(0, 10)}` : ""} · retrieved {s.retrievedAt.slice(0, 10)}
      </span>{" "}
      <Pill kind="type">{s.sourceType}</Pill> <VerifyBadge v={s.verification} />
    </div>
  );
}

export function EvidenceCard({ ev, showLinks = true }: { ev: Evidence; showLinks?: boolean }) {
  const { byId } = useLab();
  const s = byId("sources", ev.sourceId);
  return (
    <article className={`evidence evidence-${ev.stance}`}>
      <div className="evidence-head">
        <span className={`stance stance-${ev.stance}`}>{ev.stance}</span>
        <EpiBadge e={ev.epistemic} />
        <p className="claim">{ev.claim}</p>
      </div>
      <blockquote>“{ev.quote}”</blockquote>
      {s && <SourceLine s={s} />}
      {(ev.context || ev.limitations) && (
        <p className="ev-notes">
          {ev.context && (
            <>
              <b>Context:</b> {ev.context}{" "}
            </>
          )}
          {ev.limitations && (
            <>
              <b>Limitations:</b> {ev.limitations}
            </>
          )}
        </p>
      )}
      {showLinks && (ev.problemIds.length > 0 || ev.ideaIds.length > 0) && (
        <div className="ev-links">
          {ev.problemIds.map((p) => (
            <Link key={p} to={`/problems/${p}`} className="chip">
              {byId("problems", p)?.title ?? p}
            </Link>
          ))}
          {ev.ideaIds.map((p) => (
            <Link key={p} to={`/ideas/${p}`} className="chip chip-idea">
              {byId("ideas", p)?.title ?? p}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export function FixtureNotice() {
  const { store, setStore, snapshot } = useLab();
  if (store !== "fixture") return null;
  const hasReal = snapshot.stores.real.ideas.length > 0;
  return (
    <div className="fixture-banner" role="status">
      <b>Demonstration data.</b> You are viewing synthetic fixtures generated by the deterministic mock provider. Nothing in this view is real research.
      {hasReal && (
        <button className="link-btn" onClick={() => setStore("real")}>
          Switch to real research →
        </button>
      )}
    </div>
  );
}
