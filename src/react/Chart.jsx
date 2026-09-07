import React, { useMemo } from "react";
import { planShapes } from "../voice-leading.js";
import { tinyShape } from "../mini-shape.js";
import { SvgMarkup } from "./SvgMarkup.jsx";

export function Chart({ state, actions }) {
  const { tune } = state;
  const plan = useMemo(
    () =>
      planShapes(tune, {
        zone: state.shapeZone,
        chorus: state.chorus,
        inversion: state.inversion,
      }),
    [tune, state.shapeZone, state.chorus, state.inversion],
  );
  let barNumber = 0;
  return (
    <>
      <div className="chart-help">
        <span>Tap any chord to see how to play it.</span>
        <label>
          <input
            type="checkbox"
            checked={state.chartFollow}
            onChange={(e) => actions.setChartFollow(e.target.checked)}
          />{" "}
          Follow song
        </label>
      </div>
      <div className="chart">
        {tune.form.map((id, fi) => {
          const section = tune.sections[id],
            firstBar = barNumber + 1,
            lastBar = barNumber + section.bars.length;
          return (
            <section
              className={`chart-section ${state.loop === id ? "looping" : ""}`}
              key={`${fi}-${id}`}
            >
              <button
                className="section-heading"
                onClick={() => actions.setLoop(id)}
                aria-pressed={state.loop === id}
              >
                <span className="section-letter">
                  {/^S\d+$/.test(id) ? "↻" : id}
                </span>
                <span>
                  {state.loop === id
                    ? "Stop loop"
                    : `Loop bars ${firstBar}–${lastBar}`}
                </span>
                {!/^S\d+$/.test(id) && (
                  <span className="section-repeat" aria-hidden="true">
                    ↻
                  </span>
                )}
              </button>
              <div className="bar-grid">
                {section.bars.map((bar, bi) => {
                  const number = ++barNumber,
                    active =
                      (state.playing || state.paused) &&
                      !state.counting &&
                      state.formIndex === fi &&
                      state.barIndex === bi;
                  return (
                    <div
                      className={`bar ${active ? "current" : ""}`}
                      data-bar={`${fi}-${bi}`}
                      key={`${fi}-${bi}`}
                    >
                      <span className="bar-number">{number}</span>
                      <div className="bar-chords">
                        {bar.map((chord, ci) => {
                          const location = `${fi}-${bi}-${ci}`;
                          return (
                            <button
                              key={location}
                              onClick={() =>
                                actions.setChord(chord, {
                                  section: id,
                                  location,
                                  openSheet: true,
                                })
                              }
                              aria-label={`Show ${chord} voicings`}
                            >
                              <span className="chart-chord-name">{chord}</span>
                              <SvgMarkup
                                html={tinyShape(plan[location]?.shape)}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <div className="bar-beats" aria-hidden="true">
                        {Array.from(
                          {
                            length:
                              Number(tune.timeSignature.split("/")[0]) || 4,
                          },
                          (_, i) => (
                            <i
                              className={
                                active && i === state.beat ? "lit" : ""
                              }
                              key={i}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
