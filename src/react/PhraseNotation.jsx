import React, { useEffect, useMemo, useRef } from "react";
import { mountNotation } from "../notation.js";
import { phraseBarEvents } from "../phrase-notation.js";

export function PhraseNotation({ phrase, bar, tune, onPreview, showSwing }) {
  const root = useRef(null);
  const beats = phrase.beats / phrase.bars.length;
  const events = useMemo(
    () => phraseBarEvents(phrase.riff, beats, bar * beats),
    [phrase, bar, beats],
  );
  const eventKey = JSON.stringify(events);
  const scoreTune = useMemo(
    () => ({
      key: tune.key || "C",
      timeSignature: tune.timeSignature || "4/4",
      form: ["phrase"],
      sections: { phrase: { bars: [[]] } },
    }),
    [tune.key, tune.timeSignature],
  );
  useEffect(() => {
    mountNotation(root.current, scoreTune, {
      mode: "notes",
      hints: false,
      onPreview,
    });
  }, [scoreTune, events, onPreview]);
  return (
    <div className="phrase-riff phrase-notation" ref={root}>
      {showSwing && tune.style === "swing" && (
        <small className="swing-feel">Swing eighths</small>
      )}
      <div key={eventKey} data-score="0-0" data-events={eventKey} />
    </div>
  );
}
