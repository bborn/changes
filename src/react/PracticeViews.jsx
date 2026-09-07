import React from "react";
import { Chart } from "./Chart.jsx";
import { Voicings } from "./Voicings.jsx";
import { Solo } from "./Solo.jsx";
import { Scales } from "./Scales.jsx";
import { Melody } from "./Melody.jsx";

export { Voicings };

export function PracticeViews({ state, actions, engine }) {
  if (!state.tune) return null;
  if (state.view === "chart") return <Chart state={state} actions={actions} />;
  if (state.view === "voicings")
    return <Voicings state={state} actions={actions} />;
  if (state.view === "melody")
    return <Melody state={state} actions={actions} engine={engine} />;
  return state.soloMode === "guide" ? (
    <Solo state={state} actions={actions} engine={engine} />
  ) : (
    <Scales state={state} actions={actions} />
  );
}

export default PracticeViews;
