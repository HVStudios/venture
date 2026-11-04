/**
 * A research run played back stage by stage, from its own record: what was
 * read and kept, which ideas were proposed, how each was decided, which
 * experiments were designed. Opens on the finished state; Play replays it.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Memory, Run } from "../../core/schema";
import { Mark } from "./story";
import { StatusPill } from "./ui";

const STEP_MS = 1100;

export function RunReplay({ run, m }: { run: Run; m: Memory }) {
  const stages = run.stages;
  const N = stages.length;
  const [pos, setPos] = useState(N); // number of stages completed
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setPos((p) => {
        if (p >= N) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(timer.current);
  }, [playing, N]);

  const play = () => {
    if (playing) return setPlaying(false);
    setPos(0);
    setPlaying(true);
  };

  // A part of the run is shown once the stage that produced it has finished.
  // Parts whose stage the run did not record appear when the replay ends.
  const reached = (...names: string[]) => {
    const idx = Math.max(...names.map((n) => stages.findIndex((s) => s.name === n)));
    return idx >= 0 ? pos > idx : pos >= N;
  };

  const ideas = m.ideas.filter((i) => i.createdInRun === run.id);
  const decisions = m.decisions.filter((d) => d.runId === run.id).sort((a, b) => a.at.localeCompare(b.at));
  const experiments = m.experiments.filter((x) => x.createdInRun === run.id);
  const problems = m.problems.filter((p) => p.discoveredInRun === run.id);
  const statusInRun = (id: string) => decisions.filter((d) => d.subjectType === "idea" && d.subjectId === id).at(-1)?.toStatus;
  const c = run.counts;
  const read = reached("scout", "research");
  const invented = reached("invent");
  const selected = reached("select", "critique");
  const nameOf = (d: (typeof decisions)[number]) =>
    (d.subjectType === "idea" ? m.ideas.find((i) => i.id === d.subjectId)?.title : d.subjectType === "experiment" ? m.experiments.find((x) => x.id === d.subjectId)?.title : d.subjectType === "problem" ? m.problems.find((p) => p.id === d.subjectId)?.title : m.themes.find((t) => t.id === d.subjectId)?.name) ?? d.subjectId;

  return (
    <div className="replay">
      <div className="replay-controls">
        <button className="btn replay-play" onClick={play} aria-label={playing ? "Pause replay" : "Play replay from the start"}>
          {playing ? "Pause" : pos >= N ? "Replay" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={N}
          step={1}
          value={pos}
          aria-label="Stage"
          onChange={(e) => {
            setPlaying(false);
            setPos(+e.target.value);
          }}
        />
      </div>
      <ol className="replay-stages" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => (
          <li key={i} className={`rs rs-${s.status}${i < pos ? " done" : ""}${i === pos && pos < N ? " now" : ""}`}>
            <button className="rs-btn" onClick={() => { setPlaying(false); setPos(i + 1); }}>
              {s.name}
            </button>
          </li>
        ))}
      </ol>
      <p className="replay-note">
        {pos === 0 ? (
          "Before the run started."
        ) : (
          <>
            <b>{stages[pos - 1].name}:</b> {stages[pos - 1].notes ?? "no notes recorded"}
          </>
        )}
      </p>

      <div className="replay-board">
        <section>
          <h3>Read</h3>
          <div className={`rb-count${read ? " on" : ""}`}>
            <b>{read ? c.sourcesExamined : 0}</b> examined
          </div>
          <div className="rb-bar" aria-hidden>
            <i style={{ width: read && c.sourcesExamined ? `${(c.sourcesCited / c.sourcesExamined) * 100}%` : "0%" }} />
          </div>
          <div className={`rb-count${read ? " on" : ""}`}>
            <b>{read ? c.sourcesCited : 0}</b> kept with a quote
          </div>
          {problems.length > 0 && (
            <ul className="rb-list">
              {problems.map((p) => (
                <li key={p.id} className={read ? "in" : ""}>
                  problem · <Link to={`/problems/${p.id}`}>{p.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Proposed</h3>
          {ideas.length ? (
            <ul className="rb-list">
              {ideas.map((i, k) => {
                const st = selected ? statusInRun(i.id) ?? i.status : "proposed";
                return (
                  <li key={i.id} className={invented ? "in" : ""} style={{ transitionDelay: `${k * 90}ms` }}>
                    <Mark idea={{ ...i, status: st as typeof i.status }} size="row" /> <Link to={`/ideas/${i.id}`}>{i.title}</Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small">No ideas were proposed in this run.</p>
          )}
          {experiments.length > 0 && (
            <ul className="rb-list">
              {experiments.map((x) => (
                <li key={x.id} className={reached("experiment") ? "in" : ""}>
                  experiment · {x.title}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Decided</h3>
          {decisions.length ? (
            <ul className="rb-stamps">
              {decisions.map((d, k) => (
                <li key={d.id} className={reached("persist") ? "in" : ""} style={{ transitionDelay: `${k * 120}ms` }}>
                  <StatusPill status={d.toStatus} /> <span>{nameOf(d)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No decisions were recorded by this run.</p>
          )}
        </section>
      </div>
    </div>
  );
}
