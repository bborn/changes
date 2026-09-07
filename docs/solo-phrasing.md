# Solo example phrasing

The generator is a small, deterministic phrase grammar followed by a minimum-cost pitch search. It runs locally and needs no model service.

## Musical structure

An eight-bar sentence states a rhythmic motif, echoes it against the next harmony, delays/develops the next entry, and closes with a shorter answer. Adjacent two-bar maps share a motif family. Later sentences use other families and contours.

Silence is planned before pitch selection. Chord boundaries no longer force extra notes into rests. Notes release before harmonic changes, phrases leave audible breaths, and the answer ends on a current-chord guide tone. Beginner uses sparse quarters; advanced adds subdivisions inside bursts while retaining space.

The existing pitch search balances contour, fretboard travel, chord tones on strong beats, and nearby scale tones elsewhere. This is a practical heuristic, not a trained improviser or a claim to reproduce a research model.

## Sources consulted

- [Jazzadvice: Thinking About Musical Phrasing](https://www.jazzadvice.com/lessons/thinking-about-musical-phrasing-for-improvisation/) — statement/answer, motif development, and breath-length musical sentences.
- [Jazzadvice: Exploring Space](https://www.jazzadvice.com/lessons/exploring-space/) — silence before and after phrases and varied entry points.
- [How Jazz Musicians Improvise](https://modeltheory.org/papers/2002improvisation.pdf) — computational account of improvisation.
- [Phrase-Oriented Generative Rhythmic Patterns for Jazz Solos](https://www.mdpi.com/2076-3417/15/20/11058) — phrase-level rhythm generation; its stated future work includes rest handling, so it is not a drop-in solution to this app's continuous-playing problem.

Automatic phrase-note highlights use scheduled audio onset/end times and the output clock, including fractional beats. Pausing, muting, and disabling phrases clear them. Every position used by the example stays visible before and during playback; the sounding note receives a separate highlight.

Swing examples retain long–short eighth timing and now carry per-note expression: accents on pickups, lighter interior notes, tapered endings, and varied release lengths. Preview and automatic playback use the same expression values. Straight styles retain their even eighth timing. Beginner examples stay within the active chord's tones, providing a starting point for arpeggio-based improvisation without requiring root-up scale drills.

Pitch selection now uses a bounded beam search over a complete phrase contour, rather than a small contour restarting around each chord target. The gesture explores a register and returns to its ending guide tone. History-sensitive penalties discourage immediate repetitions and unintended A–B–A–B oscillations, while harmonic candidates, fret position, and leap costs constrain the line. Regression examples cover sustained major harmony, ii–V, and Fmaj7–Gb7.

Connected two-measure gestures now use a late pickup and omit the following downbeat attack. A shared chord tone can sustain across a bar line; incompatible harmonic changes and no-chord regions terminate it. Breathing space is reserved at the sentence ending rather than imposed on every measure. The per-bar tab clips durations to each measure and shows tied continuation notes in the next one.

Neighboring display cards are now composed together as one four-bar sentence before being split for display. The contour and pitch-history search spans the card boundary. A note crossing that boundary appears as a tied continuation on the following card; automatic playback keeps the original voice sounding rather than attacking it twice. Auditioning a card independently still sounds its opening continuation. Sentence endings retain breathing room.

All styles now use deterministic, small attack offsets and velocity variation. Phrase entries and harmonic boundaries stay anchored; interior notes arrive 3–15 ms late in straight styles and 8–20 ms late in swing. Offsets are capped relative to note length and subtracted from duration so releases do not drift. Tied continuations remain anchored. Preview and automatic playback share these offsets, and highlights use the resulting audible schedule.
