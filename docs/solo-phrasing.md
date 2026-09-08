# Solo example phrasing

The generator is a small, deterministic phrase grammar followed by a minimum-cost pitch search. It runs locally and needs no model service.

## Musical structure

Four-to-eight-bar sentences are composed across the two-bar display cards. Chord and form identity seed rhythmic fragments, varied entries and breaths, and a shared pitch contour. Longer sentences include connected passages spanning more than two measures, followed by shorter answers. The result stays deterministic so a practice example can be repeated.

Silence is planned before pitch selection. Chord boundaries no longer force extra notes into rests. Notes release before harmonic changes, phrases leave audible breaths, and the answer ends on a current-chord guide tone. Beginner uses sparse quarters. More difficult examples contrast sustained statements, syncopated motifs, and flowing eighth-note passages. Triplets are occasional embellishments rather than the default Advanced rhythm. Holds use longer intended durations instead of the short gate applied to passing notes.

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

Neighboring display cards are now composed together as one four-to-eight-bar sentence before being split for display. The contour and pitch-history search spans the card boundary. A note crossing that boundary appears as a tied continuation on the following card; automatic playback keeps the original voice sounding rather than attacking it twice. Auditioning a card independently still sounds its opening continuation. Sentence endings retain breathing room.

All styles now use deterministic, small attack offsets and velocity variation. Phrase entries and harmonic boundaries stay anchored; interior notes arrive 3–15 ms late in straight styles and 8–20 ms late in swing. Offsets are capped relative to note length and subtracted from duration so releases do not drift. Tied continuations remain anchored. Preview and automatic playback share these offsets, and highlights use the resulting audible schedule.

Guitar examples add feasible same-string hammer-ons, pull-offs and slides, plus occasional adjacent-string double-stops. Beginner and non-guitar examples omit these techniques. Double-stop tones must fit every chord they sustain across. Tab shows H/P arcs, slide lines and vertically aligned simultaneous notes; both double-stop positions light up during playback. The current sampled voice uses softer attacks for legato, not synthetic pitch bends; slide markings describe the guitar technique to practice rather than a realistic guitar recording.

[Berklee: Got Rhythm?](https://college.berklee.edu/bt/193/lesson.html) informed the varied phrase lengths and movement across bar lines.

The contrast between sustained statements and dense runs follows [Hal Crook’s Berklee discussion of continuity and rhythmic balance](https://www.berklee.edu/berklee-today/spring-2007/the-woodshed/musical-freedom), alongside [Jazzadvice’s guidance on longer lines](https://www.jazzadvice.com/lessons/playing-longer-lines-in-your-solos/). These guide the local heuristic; they are not a guarantee of human-level composition.

## Phrasing choices

The Solo view has an independent **Phrasing** picker:

- **Varied** preserves the existing generator for comparison.
- **Motif development** starts from a short rhythmic idea and develops it with repetition, displacement, longer durations, extensions, and shorter answers.
- **Lyrical** favors sustained ideas and space using the same transformation approach.

Difficulty still controls rhythmic complexity and guitar techniques. The selection is saved with practice settings. Changing phrasing stops playback and previews so the next Play starts the displayed example from the beginning. Examples are deterministic for the same song and settings.

The new modes draw on the outline-and-transformation approach in [Putman and Keller, A Transformational Grammar Framework for Improvisation (2015)](https://www.researchgate.net/publication/304784795_A_Transformational_Grammar_Framework_for_Improvisation). The implementation uses original rhythm rules, not copied solo transcriptions or a trained corpus. This is an experimental musical heuristic; listening comparisons matter as well as tests.
