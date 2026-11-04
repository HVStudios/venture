/**
 * The visual grammar shared by every zoom level. Each kind of record has one
 * fixed look: an idea is a mark, an assumption a pillar, a quote a highlighted
 * card, a decision or result a stamped entry on the story. New records take
 * that look automatically; anything new since the visitor's last visit plays
 * its entrance once.
 */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Idea } from "../../core/schema";
import type { AssumptionThread, IdeaStory, StoryEvent } from "../../core/story";
import { domain, fmtDate, timeAgo } from "../data";
import { Pill, StatusPill } from "./ui";

// ------------------------------------------------------------------ last visit
const VISIT_KEY = "venture.lastVisit";
let previousVisit: string | undefined | null = null;

/**
 * When this browser last opened the lab, before this page load. Read once per
 * load and moved forward immediately, so "new" means new since last time.
 * Undefined on a first visit: then nothing is marked new.
 */
export function lastVisit(): string | undefined {
  if (previousVisit !== null) return previousVisit;
  previousVisit = undefined;
  try {
    previousVisit = localStorage.getItem(VISIT_KEY) ?? undefined;
    localStorage.setItem(VISIT_KEY, new Date().toISOString());
  } catch {
    /* storage blocked: nothing is marked new */
  }
  return previousVisit;
}

export const isNew = (at: string | undefined) => {
  const v = lastVisit();
  return !!(v && at && at > v);
};

// ------------------------------------------------------------------ marks
export const VERDICT_WORD: Record<string, string> = {
  advanced: "advanced",
  proposed: "proposed, not yet tested",
  parked: "parked",
  rejected: "rejected",
  merged: "merged",
};
const MARK_ORDER: Record<string, number> = { advanced: 0, proposed: 1, parked: 2, rejected: 3, merged: 4 };
export const byVerdict = (a: Idea, b: Idea) => (MARK_ORDER[a.status] ?? 9) - (MARK_ORDER[b.status] ?? 9);

/** One idea as a mark: solid (advanced), green ring (proposed), ring (parked), struck ring (rejected). */
export function Mark({ idea, on, style, onHover, size }: { idea: Idea; on?: boolean; style?: CSSProperties; onHover?: () => void; size?: "inline" | "row" }) {
  return (
    <Link
      to={`/ideas/${idea.id}`}
      className={`mark mark-${idea.status}${on ? " on" : ""}${isNew(idea.createdAt) ? " is-new" : ""}${size === "row" ? " mark-row" : ""}`}
      style={style}
      aria-label={`${idea.title}: ${VERDICT_WORD[idea.status] ?? idea.status}`}
      title={size === "row" ? undefined : `${idea.title}: ${VERDICT_WORD[idea.status] ?? idea.status}`}
      onMouseEnter={onHover}
      onFocus={onHover}
    />
  );
}

/** Every idea in a set, in verdict order, inside a pill. */
export function Tally({ ideas, focus, onFocus, label }: { ideas: Idea[]; focus?: string; onFocus?: (id: string) => void; label?: string }) {
  return (
    <span className="tally" role="group" aria-label={label ?? "Every idea, by verdict"}>
      {[...ideas].sort(byVerdict).map((i, k) => (
        <Mark key={i.id} idea={i} on={focus === i.id} style={{ animationDelay: `${120 + k * 60}ms` }} onHover={onFocus && (() => onFocus(i.id))} />
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ the beam
const PILLAR_WORD: Record<string, string> = { supported: "supported", weakened: "weakened", refuted: "refuted", untested: "untested" };

/** How far the beam leans: a refuted load-bearing assumption tips it. */
function lean(threads: AssumptionThread[]) {
  let tilt = 0;
  threads.forEach((t, i) => {
    const side = i < threads.length / 2 ? -1 : 1;
    const weight = t.assumption.criticality === "high" ? 1 : t.assumption.criticality === "medium" ? 0.6 : 0.3;
    if (t.assumption.status === "refuted") tilt += side * 2.2 * weight;
    if (t.assumption.status === "weakened") tilt += side * 0.8 * weight;
  });
  return Math.max(-3, Math.min(3, tilt));
}

/**
 * The idea as a beam resting on its assumptions. Pillar width is criticality;
 * fill is status. Selecting a pillar opens its thread of proof.
 */
export function Beam({ story, selected, onSelect }: { story: IdeaStory; selected?: string; onSelect: (id: string) => void }) {
  const t = lean(story.threads);
  return (
    <div className="beam" style={{ "--n": story.threads.length } as CSSProperties}>
      <div className={`beam-bar beam-${story.idea.status}`} style={{ transform: `rotate(${t}deg)` }} aria-hidden />
      <div className="pillars" role="tablist" aria-label="Assumptions">
        {story.threads.map((th) => {
          const a = th.assumption;
          return (
            <button
              key={a.id}
              role="tab"
              aria-selected={selected === a.id}
              className={`pillar-btn${selected === a.id ? " on" : ""}`}
              onClick={() => onSelect(a.id)}
            >
              <span className={`pillar pillar-${a.status} crit-${a.criticality}`} aria-hidden>
                {a.status === "refuted" && (
                  <svg viewBox="0 0 20 100" preserveAspectRatio="none">
                    <path d="M2 38 L12 50 L6 56 L18 70" />
                  </svg>
                )}
              </span>
              <span className="pillar-text">{a.text}</span>
              <span className={`pillar-state state-${a.status}`}>
                {PILLAR_WORD[a.status]}
                {a.status !== "untested" && !th.traced ? " · not traced yet" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the thread
/** One assumption traced back to its quotes, their sources and the experiments that test it. */
export function Thread({ thread }: { thread: AssumptionThread }) {
  const a = thread.assumption;
  const done = thread.experiments.filter((x) => x.outcome);
  const planned = thread.experiments.filter((x) => !x.outcome);
  return (
    <div className="thread" key={a.id}>
      <div className={`thread-node thread-head st-${a.status}`}>
        <p className="thread-claim">{a.text}</p>
        <div className="pills">
          <Pill kind={`astat-${a.status}`}>{a.status}</Pill> <Pill kind={`crit-${a.criticality}`}>{a.criticality} criticality</Pill>
        </div>
      </div>
      {thread.evidence.map(({ evidence: e, source: s }, k) => (
        <div key={e.id} className={`thread-node thread-quote stance-${e.stance}`} style={{ animationDelay: `${200 + k * 120}ms` }}>
          <blockquote>
            <mark>{e.quote}</mark>
          </blockquote>
          <p className="muted small">{e.claim}</p>
          {s && (
            <p className="thread-source small">
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                {s.title}
              </a>{" "}
              <span className="muted">
                {s.publisher} · {domain(s.url)} · retrieved {fmtDate(s.retrievedAt)}
              </span>
            </p>
          )}
        </div>
      ))}
      {[...done, ...planned].map((x, k) => (
        <div key={x.id} className={`thread-node thread-exp result-${x.outcome?.result ?? "pending"}`} style={{ animationDelay: `${200 + (thread.evidence.length + k) * 120}ms` }}>
          <p>
            <b>{x.outcome ? `Experiment ${x.outcome.result}` : `Experiment ${x.status}`}</b>: <Link to="/experiments">{x.title}</Link>
          </p>
          {x.outcome && <p className="muted small">{x.outcome.summary}</p>}
        </div>
      ))}
      {!thread.evidence.length && !thread.experiments.length && (
        <div className="thread-node thread-missing">
          {a.status === "untested" ? (
            <p>Untested. No quote or experiment bears on this assumption yet.</p>
          ) : (
            <p>
              Marked {a.status}, but no quote or completed experiment is linked to it yet. The thread will appear here once the research links the evidence behind this status.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the story
const KIND_WORD: Record<StoryEvent["kind"], string> = {
  created: "Proposed",
  evidence: "Evidence",
  experiment: "Experiment",
  result: "Result",
  decision: "Decision",
};

/** Everything that happened to the idea, oldest first. New entries since the last visit are marked once. */
export function StoryTimeline({ story, onAssumption }: { story: IdeaStory; onAssumption?: (id: string) => void }) {
  const label = (id: string) => {
    const n = story.idea.assumptions.findIndex((a) => a.id === id);
    return n >= 0 ? `assumption ${n + 1}` : id;
  };
  return (
    <ol className="story">
      {story.events.map((e) => {
        const fresh = isNew(e.at);
        return (
          <li key={e.id} className={`story-ev tone-${e.tone} kind-${e.kind}${fresh ? " is-new" : ""}`}>
            <span className="story-dot" aria-hidden />
            <div className="story-meta">
              <span className="story-kind">{KIND_WORD[e.kind]}</span>
              <time dateTime={e.at} title={fmtDate(e.at)}>
                {e.at.slice(0, 10)}
              </time>
              {fresh && <span className="new-tag">New</span>}
            </div>
            <p className="story-title">{e.title}</p>
            {e.detail && <p className="story-detail">{e.detail}</p>}
            <p className="story-links small">
              {e.assumptionIds.map((a) => (
                <button key={a} className="link-chip" onClick={() => onAssumption?.(a)}>
                  {label(a)}
                </button>
              ))}
              {e.runId && <Link to={`/runs/${e.runId}`}>Run log</Link>}
              {e.experimentId && <Link to="/experiments">Experiment</Link>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The latest thing that happened to an idea, in one line. */
export function LastEvent({ story }: { story: IdeaStory }) {
  const e = story.events.at(-1);
  if (!e) return null;
  return (
    <span className={`last-ev tone-${e.tone}`}>
      {e.title} <span className="muted">· {timeAgo(e.at)}</span>
      {isNew(e.at) && <span className="new-tag">New</span>}
    </span>
  );
}

/** "Since your last visit": counts of story events after the stored visit time. */
export function SinceLastVisit({ stories, children }: { stories: IdeaStory[]; children?: ReactNode }) {
  const v = lastVisit();
  if (!v) return null;
  const fresh = stories.flatMap((s) => s.events.filter((e) => e.at > v));
  if (!fresh.length) return <p className="since">Nothing new since your last visit {timeAgo(v)}.{children}</p>;
  const n = (k: StoryEvent["kind"]) => fresh.filter((e) => e.kind === k).length;
  const parts = (
    [
      [n("created"), "new idea", "new ideas"],
      [n("decision"), "decision", "decisions"],
      [n("result"), "experiment result", "experiment results"],
      [n("experiment"), "experiment update", "experiment updates"],
      [n("evidence"), "new piece of evidence", "new pieces of evidence"],
    ] as const
  )
    .filter(([c]) => c)
    .map(([c, one, many]) => `${c} ${c === 1 ? one : many}`);
  return (
    <p className="since">
      <span className="new-tag">New</span> Since your last visit {timeAgo(v)}: {parts.join(", ")}.{children}
    </p>
  );
}

export function IdeaStatusLine({ idea }: { idea: Idea }) {
  return (
    <p className="verdict-line">
      <span className={`mark mark-${idea.status} mark-static`} aria-hidden /> <StatusPill status={idea.status} /> <span>{idea.statusRationale}</span>
    </p>
  );
}
