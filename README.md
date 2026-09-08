# Changes

A practice app for guitar, piano, and other instruments, built with React and Web Audio: chord charts and voicings, a visual solo guide, generated practice phrases, melody tab, and standard notation.

**Bring your own music. This repository contains no song catalog, melody transcriptions, chart archives, or database exports.** It has a fresh history, separate from the original personal deployment. Imported music stays in ignored local directories; it is not part of the source repository.

## Try it online

**https://jazz-changes.pages.dev/**

The public demo has no song catalog or shared database. Choose from 14 built-in harmonic exercises (ii–V–I, major/minor blues, turnarounds, rhythm changes, modal and bossa vamps), or add/import your own music. These loops are generic practice progressions, with no standard-song melody transcriptions. Songs and settings stay in your browser's local storage; export songs before clearing browser data or changing devices. Files you import are not uploaded to a server.

The public deployment uses `node scripts/build.mjs --public`, which always excludes local tune files and creates an empty catalog. Deploy that static output without the optional backend Functions or D1 bindings.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm start
```

Open http://localhost:5173. The empty library offers **Add a song**: write a chart or import JSON. The default development server saves your songs and settings in `.local/library.json`. Back up that file to preserve your library. It does not contact anyone else's Changes deployment.

You can also import an agent-created file into the local static catalog:

```sh
npm run import:tunes -- /absolute/path/to/songs.json
```

This accepts one tune or an array, validates the music, refuses to overwrite existing files, and generates `tunes/index.json`. Reload the page afterward. `tunes/` and `.local/` are gitignored.

```sh
npm test
npm run build
```

The build writes `dist/`. It includes any tunes **you** put in `tunes/`; keep builds containing personal music private. `.local/` is never copied into the static build.

## Ask your agent to build your library

Copy this prompt and replace the brackets:

> I'm using Changes from this repository. Help me build a local practice library for [song titles, composers, preferred keys, and arrangements]. I want [chords only / chords and the actual melody], with accurate rhythm, rests, pickups, ties, repeats, and chord timing.
>
> First read `docs/song-format.md`, `backend/validation.js`, and the conversion tools in `scripts/`. Find suitable source material I can access and use, or work from files I supply. Candidate repositories to investigate include ChoCo for chord annotations, OpenEWLD for MusicXML leadsheets, and OpenBook for LilyPond notation. Check the particular work, edition, attribution, and source terms; repository availability alone is not permission to redistribute its music. Do not bypass access controls or paywalls.
>
> Use the existing free conversion approach where appropriate: music21 for MusicXML; LilyPond plus music21/jinja2 for OpenBook; `convertChart` for ChoCo annotations. Install tools in an isolated environment and do not use paid services. The repository deliberately contains no downloaded source archives. Existing import scripts are starting points, not a guarantee that every upstream format still works; adapt them to the selected files and report unsupported cases.
>
> For a named song, transcribe/convert verified source notes rather than inventing a melody from memory. If no usable source is available, ask me for a file or leave it out. If I request generated practice material, compose an original exercise and label it as such, not as a standard's melody.
>
> Produce Changes JSON with source links and attribution. Validate it with `validateTune`, check that each melody bar fills its meter and aligns with the chords, expand repeats consistently, preserve pickups and ties, and audition representative passages. Reject uncertain or unsupported conversions instead of silently guessing. Do not force a melody onto an incompatible chord-chart edition.
>
> Import the finished JSON with `npm run import:tunes -- /path/to/file.json`. Keep downloads, source files, generated songs, reports, database contents, and builds out of Git. Use ignored local paths or an external working directory. Do not commit music, publish a generated catalog, or connect to someone else's library. Tell me what succeeded and what still needs review.

Source projects: [ChoCo](https://github.com/smashub/choco), [OpenEWLD](https://github.com/00sapo/OpenEWLD), [OpenBook](https://github.com/veltzer/book-openbook). No copies of those collections ship here.

## Practice

- **Chart:** chord changes, nearby fingerings, section loops.
- **Chords:** alternate voicings and note names.
- **Solo:** stable two-bar maps, landing/passing notes, suggested phrases composed across neighboring measures, and beginner/intermediate/advanced difficulty. A separate Phrasing picker offers Varied, Motif development, and Lyrical examples. Phrase playback and melody playback are independent.
- **Melody:** tab, staff notation, or both; note hints and playback highlights.
- **Settings gear:** instrument levels/mutes, melody, song editing and export.
- **Space:** pause/resume. **Shift+Space:** restart with a count-in.

Generated solo phrases use harmonic targets, melodic contours, repetition penalties, breathing space, held notes and subtle performance timing. They are practice examples, not transcriptions of recorded solos. See [the algorithm notes](docs/solo-phrasing.md).

## Optional Cloudflare deployment

The local server works without Cloudflare. For a personal hosted instance:

1. Copy `wrangler.example.jsonc` to the ignored `wrangler.jsonc`.
2. Create your own Pages project and D1 database. Fill in your project name, database name/ID, and a newly generated library UUID.
3. Apply `migrations/` to that database with Wrangler. Insert a row into `libraries` with your chosen UUID, a unique `key_hash` value and settings `'{}'`. Set `PERSONAL_LIBRARY_ID` to that UUID.
4. Build and deploy to **your** Pages project with `npx wrangler pages deploy dist --project-name YOUR_PROJECT`.

The included backend is a single-owner shared collection, not a multi-user account system. Put a private deployment behind access control appropriate for your use. No owner credentials, database identifiers, or live-library endpoint are included in this repo.

To deliberately use your hosted API during development, set `CHANGES_API_URL=https://your-own-host.example` before `npm start`. Otherwise `/api` stays local. The server binds to localhost.

## Music and repository hygiene

Keep imported/generated song files, MusicXML, MIDI, PDFs, notation sources, archives, recordings of songs, and database dumps outside tracked source. `.gitignore` prevents routine additions of the main output directories, but it cannot prevent a forced add or a differently named file. Review `git diff --cached` before pushing. A public code repository does not grant rights to music you import.

The small inline test fixtures are synthetic rhythm/harmony examples, not song transcriptions. Bundled instrument samples are individual piano/bass notes, not songs. Their attribution is in [Credits](credits.html): Salamander piano by Alexander Holm (CC BY 3.0), Sneakybass by D. Smolken / Karoryfer (CC0). VexFlow is MIT-licensed. Song catalogs and historical source inventories are intentionally absent.

## Code map

- `src/react/`: React interface and practice state.
- `src/audio/`: Web Audio instruments and audio-clock scheduling.
- `src/solo-phrases.js`: suggested phrase generation.
- `src/theory.js`, `data/voicings*`, `data/scales.js`: harmony and guitar shapes.
- `backend/`, `functions/`, `migrations/`: optional Cloudflare library backend.
- `scripts/local-library.mjs`: standalone development library persistence.
- `scripts/import-*.{mjs,py}`: import/conversion code; source data is not included.

## Instrument views

Choose **Settings → Instrument**:

- **Guitar** keeps fretboards, chord shapes, and melody tab/notation.
- **Piano** shows chord voicings and solo note choices on playable keyboards. Suggested phrases use a chromatic register rather than guitar positions; sounding solo notes highlight their keys.
- **Other** shows note names and standard notation without guitar fingerings. Notes are in concert pitch; written-pitch transposition for instruments such as B♭ trumpet is not yet included.

Piano and Other show melody and example phrases in treble-clef notation. The solo **Register** selector chooses C3–B4, C4–B5, or C5–B6. This is a visual and practice-range choice, not an automatic instrument-range check. Switching instruments stops playback so the new view and generated phrase start together; it does not change the song or its key. Your instrument choice is saved with your practice settings. Guitar's tab preference is retained when switching back.

Piano Settings also includes **Musical typing**: A–L play notes (W/E/T/Y/U/O are black keys), and Z/X shift octaves. Space keeps its pause/resume behavior. Musical typing starts off and does not intercept text fields or modified shortcuts.

## One codebase, separate deployments

Use this repository for both a personal instance and the public demo. Personal song files live in ignored `tunes/`; the personal server keeps its existing D1 library. The public build excludes those files and uses browser-local storage.

Create an ignored `.local/deploy.json` with your Pages project names:

```json
{
  "public": {"project": "your-public-demo"},
  "personal": {"project": "your-personal-app"}
}
```

For personal deployment, copy `wrangler.example.jsonc` to ignored `wrangler.jsonc` and configure your existing D1 binding and library ID. Keep this file and your music backed up outside Git.

- `npm run deploy:public` builds and deploys the empty-catalog public demo without Functions or database bindings.
- `npm run deploy:personal` builds and deploys your local songs plus the personal backend.
- `npm run deploy:all` updates both from this checkout.

Add `-- --prepare-only` to either individual command to inspect its isolated package under ignored `.deploy/` without uploading it. Run deployments sequentially; they share the build directory.
