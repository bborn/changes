import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildSoloPhrases } from "../solo-phrases.js";
import { SvgMarkup } from "./SvgMarkup.jsx";
import { Keyboard, NoteNames } from "./Keyboard.jsx";
import { PhraseNotation } from "./PhraseNotation.jsx";

const strings = ["", "high E", "B", "G", "D", "A", "low E"];
const range = (phrase) => phrase.bars.map((bar) => bar.number).join("–");
const pitchLabel = (pitch) =>
  `${["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][(pitch % 12 + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
function phraseKeyboardNotes(phrase, next) {
  const byPitch = new Map();
  const add = (note, fallbackRole) => {
    if (!note) return;
    if (byPitch.has(note.pitch)) {
      if (fallbackRole === "next") byPitch.get(note.pitch).next = true;
      return;
    }
    byPitch.set(note.pitch, {
      pitch: note.pitch,
      label: `${note.label || pitchLabel(note.pitch).replace(/-?\d+$/, "")}${Math.floor(note.pitch / 12) - 1}`,
      role: note.role === "common" ? "chord" : note.role || fallbackRole,
      next: fallbackRole === "next",
    });
  };
  phrase.dots.forEach((note) => add(note, "chord"));
  phrase.riff.forEach((note) => add(note, "passing"));
  add(next?.events[0]?.target, "next");
  return [...byPitch.values()].sort((a, b) => a.pitch - b.pitch);
}
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function neck(phrase, start, nextTarget) {
  const left = 34,
    top = 24,
    gap = 62,
    row = 27,
    width = 296,
    height = 187;
  let svg = `<svg class="phrase-neck" viewBox="0 0 ${width} ${height}" role="group" aria-label="Two-measure note map, frets ${start} to ${start + 3}">`;
  for (let s = 1; s <= 6; s++)
    svg += `<text class="string-label" x="8" y="${top + (s - 1) * row + 4}">${["", "e", "B", "G", "D", "A", "E"][s]}</text><line x1="${left}" x2="${left + 4 * gap}" y1="${top + (s - 1) * row}" y2="${top + (s - 1) * row}" stroke="#b6baac"/>`;
  for (let f = 0; f <= 4; f++)
    svg += `<line x1="${left + f * gap}" x2="${left + f * gap}" y1="${top}" y2="${top + 5 * row}" stroke="#d3d5ca"/>`;
  for (let f = 0; f < 4; f++)
    svg += `<text class="fret-number" text-anchor="middle" x="${left + (f + 0.5) * gap}" y="182">${start + f}</text>`;
  const dots = [...phrase.dots];
  for (const note of phrase.riff)
    if (
      !dots.some((dot) => dot.string === note.string && dot.fret === note.fret)
    )
      dots.push({ ...note, role: "passing" });
  for (const dot of dots) {
    const x = left + (dot.fret - start + 0.5) * gap,
      y = top + (dot.string - 1) * row,
      keys = dot.eventKeys?.join(" ") || "",
      target = dot.role === "target";
    svg += `<g class="phrase-dot ${dot.role}" data-solo-pitch="${dot.pitch}" data-solo-position="${dot.string}-${dot.fret}" data-target-keys="${keys}" role="button" tabindex="0" aria-label="Hear ${esc(dot.label)}, ${strings[dot.string]} string, fret ${dot.fret}${target ? ", landing " + dot.numbers.join(", ") : dot.role === "common" ? ", shared chord tone" : ", passing note"}"><circle class="note-hit" cx="${x}" cy="${y}" r="17"/><circle class="landing-ring" cx="${x}" cy="${y}" r="15"/><circle class="note-face" cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 3.7}" text-anchor="middle">${esc(dot.label)}</text></g>`;
  }
  if (nextTarget) {
    const last = phrase.events.findLast((e) => e.target)?.target,
      x = left + (nextTarget.fret - start + 0.5) * gap,
      y = top + (nextTarget.string - 1) * row,
      sx = last ? left + (last.fret - start + 0.5) * gap : x,
      sy = last ? top + (last.string - 1) * row : y;
    if (Math.hypot(x - sx, y - sy) > 2) {
      const angle = Math.atan2(y - sy, x - sx),
        ex = x - Math.cos(angle) * 17,
        ey = y - Math.sin(angle) * 17;
      svg += `<path class="next-note-arrow" d="M ${sx + Math.cos(angle) * 17} ${sy + Math.sin(angle) * 17} L ${ex} ${ey} m ${-8 * Math.cos(angle - 0.55)} ${-8 * Math.sin(angle - 0.55)} L ${ex} ${ey} l ${-8 * Math.cos(angle + 0.55)} ${-8 * Math.sin(angle + 0.55)}"/>`;
    }
    svg += `<circle class="next-note-ring" cx="${x}" cy="${y}" r="16"/>`;
    if (
      !dots.some(
        (d) => d.string === nextTarget.string && d.fret === nextTarget.fret,
      )
    )
      svg += `<text class="next-note-label" x="${x}" y="${y + 4}" text-anchor="middle">${esc(nextTarget.label)}</text>`;
  }
  return svg + "</svg>";
}
function riffMeasure(notes, beats) {
  const left = 30,
    unit = 250 / beats;
  let svg =
    '<svg class="phrase-riff" viewBox="0 0 296 118" role="img" aria-label="Original practice phrase in guitar tab">';
  for (let s = 1; s <= 6; s++)
    svg += `<text x="7" y="${s * 16 + 5}">${["", "e", "B", "G", "D", "A", "E"][s]}</text><line x1="24" x2="290" y1="${s * 16}" y2="${s * 16}"/>`;
  for (const n of notes) {
    const x = left + n.beat * unit,
      y = n.string * 16;
    if(n.tie)svg += `<path class="riff-tie" d="M ${x-7} ${y-11} Q ${x} ${y-18} ${x+7} ${y-11}" fill="none" stroke="currentColor"/>`;
    svg += `<rect x="${x - 8}" y="${y - 8}" width="16" height="16"/><text class="riff-fret" text-anchor="middle" x="${x}" y="${y + 4}">${n.fret}</text><line class="riff-duration" x1="${x + 9}" x2="${Math.max(x + 10, left + (n.beat + n.duration) * unit - 5)}" y1="${y}" y2="${y}"/>`;
  }
  for (let b = 0; b < beats; b++)
    svg += `<text text-anchor="middle" x="${left + b * unit}" y="114">${b + 1}</text>`;
  return svg + "</svg>";
}

export function Solo({ state, actions, engine }) {
  const instrument = state.instrument || "guitar";
  const guitar = instrument === "guitar";
  const [sounding, setSounding] = useState(null);
  const phrases = useMemo(
    () =>
      state.soloPhrases ||
      buildSoloPhrases(state.tune, state.soloStart, {
        loop: state.loop,
        level: state.soloLevel,
        instrument,
        register: state.soloRegister,
      }),
    [
      state.soloPhrases,
      state.tune,
      state.soloStart,
      state.loop,
      state.soloLevel,
      instrument,
      state.soloRegister,
    ],
  );
  const root = useRef(null),
    pointer = useRef(null),
    active =
      (state.playing || state.paused) && !state.counting
        ? phrases.find(
            (p) =>
              p.formIndex === state.formIndex &&
              p.bars.some((b) => b.barIndex === state.barIndex),
          )
        : null,
    chosen =
      (state.soloFollow && active) ||
      phrases.find((p) => p.id === state.soloPage) ||
      phrases[0];

  useEffect(() => {
    const scroller = root.current?.querySelector(".phrase-scroll");
    if (!scroller || !chosen || scroller.dataset.shown === chosen.id) return;
    const previous = phrases.findIndex((p) => p.id === scroller.dataset.shown),
      index = phrases.indexOf(chosen),
      first = !scroller.dataset.shown;
    const wrapped =
      !first &&
      state.playing &&
      state.soloFollow &&
      index === 0 &&
      previous === phrases.length - 1;
    const original = root.current.querySelector(
      `[data-phrase="${chosen.id}"]:not([data-phrase-copy])`,
    );
    const page = wrapped
      ? root.current.querySelector(
          `[data-phrase-copy][data-phrase="${chosen.id}"]`,
        ) || original
      : original;
    scroller.dataset.shown = chosen.id;
    scroller.scrollTo({
      left: page.offsetLeft,
      behavior:
        first || matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
    if (!wrapped) return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      scroller.removeEventListener("scrollend", reset);
      if (scroller.isConnected && scroller.dataset.shown === chosen.id)
        scroller.scrollTo({ left: original.offsetLeft, behavior: "instant" });
    };
    scroller.addEventListener("scrollend", reset, { once: true });
    timer = setTimeout(reset, 450);
    return () => {
      clearTimeout(timer);
      scroller.removeEventListener("scrollend", reset);
    };
  }, [chosen?.id, state.playing, state.soloFollow, phrases]);
  useEffect(() => {
    if (instrument !== "piano" || !state.soloFollow) return;
    const guide = root.current;
    const reveal = () => {
      const card = guide?.querySelector(".phrase-page");
      const transportTop = document.querySelector(".transport")?.getBoundingClientRect().top ?? innerHeight;
      if (!card || card.getBoundingClientRect().bottom <= transportTop) return;
      const tabsHeight = document.querySelector(".view-bar")?.getBoundingClientRect().height ?? 0;
      const delta = guide.getBoundingClientRect().top - tabsHeight - 8;
      if (delta > 0) window.scrollBy({top: delta, behavior: "instant"});
    };
    const observer = new ResizeObserver(reveal);
    if (guide) observer.observe(guide);
    const frame = requestAnimationFrame(reveal);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [instrument, state.playing, state.soloFollow, state.soloLevel, state.soloRegister]);
  useEffect(() => {
    const scroller = root.current?.querySelector(".phrase-scroll");
    if (!scroller) return;
    root.current.querySelectorAll("[data-phrase-copy]").forEach((page) => {
      page.inert = true;
    });
    const rememberManualPosition = () => {
      if (state.soloFollow) return;
      const page = [
        ...root.current.querySelectorAll(
          "[data-phrase]:not([data-phrase-copy])",
        ),
      ].sort(
        (a, b) =>
          Math.abs(a.offsetLeft - scroller.scrollLeft) -
          Math.abs(b.offsetLeft - scroller.scrollLeft),
      )[0];
      if (page) scroller.dataset.shown = page.dataset.phrase;
    };
    scroller.addEventListener("scroll", rememberManualPosition);
    return () => scroller.removeEventListener("scroll", rememberManualPosition);
  }, [state.soloFollow, phrases]);
  useEffect(() => {
    const key = active
      ? `${state.formIndex}-${state.barIndex}-${state.chordIndex ?? 0}`
      : null;
    root.current
      ?.querySelectorAll("[data-target-keys]")
      .forEach((el) =>
        el.classList.toggle(
          "is-landing",
          Boolean(key && el.dataset.targetKeys.split(" ").includes(key)),
        ),
      );
  }, [active?.id, state.formIndex, state.barIndex, state.chordIndex]);
  useEffect(() => {
    const light = () => {
      const note = engine.activeSoloNote;
      setSounding(note || null);
      root.current?.querySelectorAll("[data-solo-position]").forEach((dot) => {
        const on = Boolean(
          note &&
          dot.closest("[data-phrase]")?.dataset.phrase === note.phraseId &&
          dot.dataset.soloPosition === `${note.string}-${note.fret}`,
        );
        dot.classList.toggle("is-sounding", on);
      });
    };
    engine.addEventListener("solo-note", light);
    light();
    return () => engine.removeEventListener("solo-note", light);
  }, [engine, phrases]);
  const navigate = (direction) => {
    if (!phrases.length) return;
    const current = Math.max(
      0,
      phrases.findIndex((p) => p.id === chosen?.id),
    );
    actions.setSoloFollow(false);
    actions.setSoloPage(
      phrases[(current + direction + phrases.length) % phrases.length].id,
    );
  };
  const noteEvent = (e) => {
    const dot = e.target.closest("[data-solo-pitch]");
    if (dot) actions.previewNotes([Number(dot.dataset.soloPitch)]);
  };
  const keyEvent = (e) => {
    if (e.key === "Enter" && e.target.closest("[data-solo-pitch]")) {
      e.preventDefault();
      noteEvent(e);
    }
  };
  const pages = [
    ...phrases,
    ...Array.from(
      { length: phrases.length ? 4 : 0 },
      (_, i) => phrases[i % phrases.length],
    ),
  ];
  return (
    <section className={`solo-guide${instrument === "piano" ? " piano-solo" : ""}`} ref={root}>
      <div className="solo-toolbar">
        <div className="solo-mode">
          <button
            onClick={() => actions.setSoloMode("guide")}
            aria-pressed="true"
          >
            Phrase map
          </button>
          <button onClick={() => actions.setSoloMode("scales")}>
            All notes
          </button>
        </div>
        {guitar ? (
          <select
            aria-label="Solo fret position"
            value={state.soloStart}
            onChange={(e) => actions.setSoloStart(Number(e.target.value))}
          >
            {[1, 3, 5, 7, 9, 12].map((f) => (
              <option value={f} key={f}>
                Frets {f}–{f + 3}
              </option>
            ))}
          </select>
        ) : (
          <select
            aria-label="Solo register"
            value={state.soloRegister || "middle"}
            onChange={(e) => actions.setSoloRegister(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="middle">Middle</option>
            <option value="high">High</option>
          </select>
        )}
      </div>
      <label className="solo-difficulty">
        <span>
          {state.soloLevel[0].toUpperCase() + state.soloLevel.slice(1)}
        </span>
        <input
          type="range"
          min="0"
          max="2"
          step="1"
          value={Math.max(
            0,
            ["beginner", "intermediate", "advanced"].indexOf(state.soloLevel),
          )}
          aria-label="Solo difficulty"
          aria-valuetext={state.soloLevel}
          onChange={(e) =>
            actions.setSoloLevel(
              ["beginner", "intermediate", "advanced"][Number(e.target.value)],
            )
          }
        />
      </label>
      <div className="phrase-navigation">
        <div>
          <button
            onClick={() => navigate(-1)}
            aria-label="Previous two measures"
          >
            ‹
          </button>
          <span>Bars {chosen ? range(chosen) : ""}</span>
          <button onClick={() => navigate(1)} aria-label="Next two measures">
            ›
          </button>
        </div>
        <label className="phrase-follow">
          <input
            type="checkbox"
            checked={Boolean(state.playPhrases)}
            onChange={(e) => actions.setPlayPhrases(e.target.checked)}
          />{" "}
          Play phrases
        </label>
        <label className="phrase-follow">
          <input
            type="checkbox"
            checked={state.soloFollow}
            onChange={(e) => actions.setSoloFollow(e.target.checked)}
          />{" "}
          Follow song
        </label>
      </div>
      <div
        className="phrase-scroll"
        tabIndex="0"
        role="region"
        aria-label="Two-measure solo phrases"
        onPointerDown={(e) => (pointer.current = [e.clientX, e.clientY])}
        onPointerMove={(e) => {
          if (
            pointer.current &&
            Math.abs(e.clientX - pointer.current[0]) > 18 &&
            Math.abs(e.clientX - pointer.current[0]) >
              Math.abs(e.clientY - pointer.current[1])
          ) {
            actions.setSoloFollow(false);
            pointer.current = null;
          }
        }}
        onPointerUp={() => (pointer.current = null)}
        onPointerCancel={() => (pointer.current = null)}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY))
            actions.setSoloFollow(false);
        }}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            ["ArrowLeft", "ArrowRight"].includes(e.key)
          ) {
            e.preventDefault();
            navigate(e.key === "ArrowLeft" ? -1 : 1);
          }
        }}
        onScroll={(e) => {
          if (state.soloFollow) return;
          const scroller = e.currentTarget,
            copy = root.current.querySelector("[data-phrase-copy]");
          if (copy && scroller.scrollLeft >= copy.offsetLeft)
            scroller.scrollTo({
              left: scroller.scrollLeft - copy.offsetLeft,
              behavior: "instant",
            });
          const page = [
            ...root.current.querySelectorAll(
              "[data-phrase]:not([data-phrase-copy])",
            ),
          ].sort(
            (a, b) =>
              Math.abs(a.offsetLeft - scroller.scrollLeft) -
              Math.abs(b.offsetLeft - scroller.scrollLeft),
          )[0];
          if (page && page.dataset.phrase !== state.soloPage)
            actions.setSoloPage(page.dataset.phrase);
        }}
      >
        <div className="phrase-path">
          {pages.map((phrase, i) => {
            const copy = i >= phrases.length,
              next = phrases[(i + 1) % phrases.length],
              groups = [];
            for (const event of phrase.events) {
              const prior = groups.at(-1);
              if (prior?.chord === event.chord) {
                prior.keys.push(event.key);
                prior.duration += event.duration;
              } else
                groups.push({
                  chord: event.chord,
                  keys: [event.key],
                  duration: event.duration,
                });
            }
            const phraseActive = active?.id === phrase.id;
            return (
              <article
                className={`phrase-page ${phraseActive ? "is-current-phrase" : ""}`}
                data-phrase={phrase.id}
                data-phrase-copy={copy ? "" : undefined}
                aria-hidden={copy || undefined}
                inert={copy}
                key={`${phrase.id}-${i}`}
              >
                <div
                  className="phrase-chord-strip"
                  aria-label={`Chords for bars ${range(phrase)}`}
                >
                  {groups.map((group) => {
                    const playing =
                      phraseActive &&
                      group.keys.includes(
                        `${state.formIndex}-${state.barIndex}-${state.chordIndex ?? 0}`,
                      );
                    return (
                      <div
                        className={`phrase-chord ${playing ? "is-playing" : ""}`}
                        aria-current={playing ? "step" : undefined}
                        style={{ flex: group.duration }}
                        key={group.keys.join(" ")}
                      >
                        <b>{group.chord}</b>
                      </div>
                    );
                  })}
                </div>
                {guitar ? (
                  <SvgMarkup
                    html={neck(phrase, state.soloStart, next?.events[0]?.target)}
                    onClick={noteEvent}
                    onKeyDown={keyEvent}
                  />
                ) : instrument === "piano" ? (
                  <Keyboard
                    notes={phraseKeyboardNotes(phrase, next)}
                    activePitch={sounding?.phraseId === phrase.id ? sounding.pitch : null}
                    onNote={(pitch) => actions.previewNotes([pitch])}
                    label={`Notes for bars ${range(phrase)}`}
                  />
                ) : (
                  <NoteNames
                    notes={phraseKeyboardNotes(phrase, next)}
                    activePitch={sounding?.phraseId === phrase.id ? sounding.pitch : null}
                    onNote={(pitch) => actions.previewNotes([pitch])}
                    label={`Notes for bars ${range(phrase)}`}
                  />
                )}
                <div className="phrase-legend">
                  <span>
                    <i className="target-key" /> Land
                  </span>
                  <span>
                    <i className="common-key" /> Shared
                  </span>
                  <span>
                    <i className="passing-key" /> Passing
                  </span>
                  <span>
                    <i className="next-key" /> Next
                  </span>
                </div>
                {!phrase.dots.length && (
                  <p className="phrase-rest">
                    Leave space. Listen to the band.
                  </p>
                )}
                <section className="riff-example" aria-label="Example phrase">
                  {phrase.bars.map((_, bar) => {
                    const beats = phrase.beats / phrase.bars.length,
                      notes = phrase.riff
                        .filter(
                          (n) =>
                            n.beat + n.duration > bar * beats && n.beat < (bar + 1) * beats,
                        )
                        .map((n) => ({ ...n, tie: n.tie || n.beat < bar * beats, beat: Math.max(0,n.beat - bar * beats), duration: Math.min(n.beat+n.duration,(bar+1)*beats)-Math.max(n.beat,bar*beats) }));
                    return guitar ? (
                      <SvgMarkup html={riffMeasure(notes, beats)} key={bar} />
                    ) : (
                      <PhraseNotation
                        phrase={phrase}
                        bar={bar}
                          tune={state.tune}
                          showSwing={bar === 0}
                        onPreview={actions.previewNotes}
                        key={bar}
                      />
                    );
                  })}
                  <div>
                    <button onClick={() => actions.hearPhrase(phrase.id)}>
                      ▶ Hear phrase
                    </button>
                  </div>
                </section>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
