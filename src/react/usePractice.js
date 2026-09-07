import {createPracticeLoop} from '../practice-loops.js';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine } from "../audio/engine.js";
import { mergeMelodyLibrary } from "../melody-library.js";
import {
  connectCloud,
  cloudSongs,
  saveCloudSettings,
  saveCloudSong,
} from "../cloud-library.js";
import { openSongLibrary } from "../song-library.js";
import { openSongEditor } from "../song-editor.js";
import { parseSong, readSongs } from "../songs.js";
import { transposeTune } from "../transpose.js";
import { planShapes, chooseShape } from "../voice-leading.js";
import { buildSoloPhrases } from "../solo-phrases.js";
import { getVoicings } from "../theory.js";
import {
  chooseInitialTune,
  isPracticeSpace,
  mergeRestoredSettings,
} from "./session.js";

const SESSION_KEY = "pocket-session";
const SIDEBAR_KEY = "changes-sidebar-collapsed";
const SOLO_LEVELS = ["beginner", "intermediate", "advanced"];
const MELODY_MODES = ["tab", "both", "notes"];
const INVERSIONS = ["auto", "0", "1", "2", "3"];
const SHAPE_ZONES = ["nearby", "low", "middle", "high", "explore"];

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function initialState() {
  const saved = readSession();
  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {}
  return {
    sidebarCollapsed,
    melodyMode: MELODY_MODES.includes(saved.melodyMode)
      ? saved.melodyMode
      : "tab",
    readingHints: false,
    inversion: INVERSIONS.includes(saved.inversion) ? saved.inversion : "auto",
    shapeZone: SHAPE_ZONES.includes(saved.shapeZone)
      ? saved.shapeZone
      : "nearby",
    chorus: 0,
    tunes: [],
    customSongs: [],
    recent: [],
    tune: null,
    loading: true,
    soloMode: "guide",
    soloLevel: SOLO_LEVELS.includes(saved.soloLevel)
      ? saved.soloLevel
      : "intermediate",
    soloStart: 5,
    soloFollow: true,
    soloPage: null,
    playPhrases: false,
    view: "chart",
    chartFollow: true,
    tempo: 120,
    loop: null,
    bandOpen: false,
    playing: false,
    paused: false,
    starting: false,
    chord: "Cm7",
    playbackChord: "Cm7",
    nextPlaybackChord: null,
    section: "A",
    formIndex: -1,
    barIndex: -1,
    chordIndex: 0,
    beat: -1,
    melodyBeat: -1,
    counting: false,
    notes: false,
    follow: true,
    alt: false,
    sheet: false,
    modalReturn: null,
    tracks: {
      bass: { muted: false, volume: 0.75 },
      drums: { muted: false, volume: 0.6 },
      chords: { muted: false, volume: 0.55 },
      melody: { muted: true, volume: 0.7 },
      solo: { muted: true, volume: 0.7 },
    },
    cloudError: false,
    error: "",
  };
}

const persistentSettings = (state) => ({
  soloLevel: state.soloLevel,
  melodyMode: state.melodyMode,
  slug: state.tune?.slug,
  tempo: state.tempo,
  loop: state.loop,
  shapeZone: state.shapeZone,
  inversion: state.inversion,
  recent: state.recent,
});

function isTypingTarget(target) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'textarea,[contenteditable]:not([contenteditable="false"]),input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=color])',
      ),
    )
  );
}

export function usePractice() {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const engineRef = useRef(null);
  const loadId = useRef(0);
  const playId = useRef(0);
  const initialized = useRef(false);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;
  stateRef.current = state;

  const update = useCallback((change) => {
    setState((current) => {
      const next =
        typeof change === "function"
          ? change(current)
          : { ...current, ...change };
      stateRef.current = next;
      return next;
    });
  }, []);

  const feedback = useCallback(
    (kind = "tap") => {
      const current = stateRef.current;
      if (!current.playing && !current.starting)
        engine.feedback(kind).catch(() => {});
    },
    [engine],
  );

  const soloPhrases = useMemo(
    () =>
      state.tune
        ? buildSoloPhrases(state.tune, state.soloStart, {
            loop: state.loop,
            level: state.soloLevel,
          })
        : [],
    [state.tune, state.soloStart, state.loop, state.soloLevel],
  );

  useEffect(() => {
    engine.setSoloPhrases(soloPhrases);
  }, [engine, soloPhrases]);

  const loadTune = useCallback(
    async (
      slug,
      restore = false,
      providedTune = null,
      restoreSettings = null,
    ) => {
      const request = ++loadId.current;
      ++playId.current;
      update((current) => ({ ...current, loading: true, starting: false }));
      engine.stop();
      try {
        const before = stateRef.current;
        let tune =
          providedTune || before.customSongs.find((song) => song.slug === slug);
        if (!tune) {
          const response = await fetch(
            `/tunes/${encodeURIComponent(slug)}.json`,
          );
          if (!response.ok) throw Error("Tune file not found");
          tune = await response.json();
        }
        if (request !== loadId.current) return;
        if (before.view === "melody" && tune.melodyVersion)
          return loadTune(tune.melodyVersion, restore, null, restoreSettings);
        if (!tune.form?.length || !tune.sections)
          throw Error("Invalid tune format");
        const saved = restoreSettings || readSession();
        const section = tune.form[0];
        const chord = tune.sections[section].bars[0][0];
        update((current) => ({
          ...current,
          tune,
          loading: false,
          soloPage: null,
          soloFollow: true,
          chorus: 0,
          recent: [
            tune.slug,
            ...current.recent.filter((item) => item !== tune.slug),
          ].slice(0, 8),
          tempo:
            restore && Number.isFinite(saved.tempo)
              ? Math.max(40, Math.min(240, saved.tempo))
              : tune.tempo,
          loop: restore && tune.sections[saved.loop] ? saved.loop : null,
          section,
          chord,
          playbackChord: chord,
          nextPlaybackChord: null,
          error: "",
          sheet: false,
          alt: false,
        }));
      } catch (error) {
        if (request === loadId.current)
          update((current) => ({
            ...current,
            loading: false,
            error: `Could not load this tune. ${error.message}`,
          }));
      }
    },
    [engine, update],
  );

  const initialize = useCallback(async () => {
    update({ loading: true });
    try {
      const saved = readSession();
      const response = await fetch("/tunes/index.json");
      if (!response.ok) throw Error("Tune library not found");
      let tunes = await response.json();
      if (!Array.isArray(tunes)) throw Error("Invalid tune library");
      let customSongs,
        cloudSettings = {},
        cloudError = "";
      try {
        const cloud = await connectCloud();
        customSongs = cloud.songs;
        cloudSettings = cloud.settings || {};
      } catch (error) {
        customSongs = readSongs();
        cloudError = error.message;
      }
      const restored = mergeRestoredSettings(saved, cloudSettings);
      tunes = mergeMelodyLibrary(tunes, customSongs);
      if (!tunes.length) { update({loading:false,tunes:[],customSongs:[],error:cloudError}); return; }
      update((current) => ({
        ...current,
        tunes,
        customSongs,
        cloudError: Boolean(cloudError),
        recent: Array.isArray(restored.recent)
          ? restored.recent
              .filter((value) => typeof value === "string")
              .slice(0, 8)
          : [],
        ...(SHAPE_ZONES.includes(restored.shapeZone)
          ? { shapeZone: restored.shapeZone }
          : {}),
        ...(INVERSIONS.includes(restored.inversion)
          ? { inversion: restored.inversion }
          : {}),
        ...(MELODY_MODES.includes(restored.melodyMode)
          ? { melodyMode: restored.melodyMode }
          : {}),
        ...(SOLO_LEVELS.includes(restored.soloLevel)
          ? { soloLevel: restored.soloLevel }
          : {}),
      }));
      const selected = chooseInitialTune(tunes, restored.slug);
      await loadTune(
        selected.slug,
        true,
        selected.custom ? selected : null,
        restored,
      );
      if (cloudError) update((current) => ({ ...current, error: cloudError }));
    } catch (error) {
      update((current) => ({
        ...current,
        loading: false,
        error: `Could not load your standards. ${error.message}`,
      }));
    }
  }, [loadTune, update]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, [initialize]);

  useEffect(() => {
    const report = (event) =>
      update((current) => ({
        ...current,
        error: event.detail || "Settings could not sync.",
      }));
    document.addEventListener("cloud-error", report);
    return () => document.removeEventListener("cloud-error", report);
  }, [update]);

  useEffect(() => {
    if (!state.tune) return;
    const settings = persistentSettings(state);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(settings));
    } catch {}
    saveCloudSettings(settings);
  }, [
    state.tune,
    state.tempo,
    state.loop,
    state.shapeZone,
    state.inversion,
    state.melodyMode,
    state.soloLevel,
    state.recent,
  ]);

  useEffect(() => {
    const beat = (event) => {
      const detail = event.detail;
      update((current) => {
        const newChorus =
          detail.beat === 0 &&
          detail.formIndex === 0 &&
          detail.barIndex === 0 &&
          !detail.countIn &&
          current.formIndex >= 0 &&
          (current.formIndex !== 0 || current.barIndex !== 0);
        return {
          ...current,
          chorus: current.chorus + (newChorus ? 1 : 0),
          formIndex: detail.formIndex,
          barIndex: detail.barIndex,
          chordIndex: detail.chordIndex,
          beat: Math.floor(detail.beat),
          melodyBeat: detail.beat,
          nextPlaybackChord: detail.followingChord,
          counting: detail.countIn,
          ...(!detail.countIn
            ? {
                playbackChord: detail.chord,
                section: detail.section,
                ...(current.follow ? { chord: detail.chord } : {}),
              }
            : {}),
        };
      });
    };
    const pause = () =>
      update((current) => ({ ...current, playing: false, paused: true }));
    const stop = () =>
      update((current) => ({
        ...current,
        playing: false,
        paused: false,
        beat: -1,
        melodyBeat: -1,
        formIndex: -1,
        barIndex: -1,
        counting: false,
      }));
    engine.addEventListener("beat", beat);
    engine.addEventListener("pause", pause);
    engine.addEventListener("stop", stop);
    return () => {
      engine.removeEventListener("beat", beat);
      engine.removeEventListener("pause", pause);
      engine.removeEventListener("stop", stop);
      engine.stop();
    };
  }, [engine, update]);

  const togglePlay = useCallback(
    async ({ restart = false } = {}) => {
      const current = stateRef.current;
      if (current.loading || !current.tune) return;
      if (restart) {
        ++playId.current;
        engine.stop();
        update((value) => ({ ...value, starting: false, chorus: 0 }));
      } else if (current.starting) {
        ++playId.current;
        engine.stop();
        update((value) => ({ ...value, starting: false }));
        return;
      } else if (engine.playing) {
        ++playId.current;
        try {
          await engine.pause();
        } catch (error) {
          update((value) => ({
            ...value,
            error: `Could not pause playback. ${error.message}`,
          }));
        }
        return;
      }
      const request = ++playId.current;
      const resuming = engine.paused && !restart;
      update((value) => ({ ...value, starting: true }));
      try {
        engine.setSoloPhrases(
          buildSoloPhrases(current.tune, current.soloStart, {
            loop: current.loop,
            level: current.soloLevel,
          }),
        );
        if (resuming) await engine.resume();
        else
          await engine.play(current.tune, {
            tempo: current.tempo,
            loopSection: current.loop,
            countIn: true,
          });
        if (request !== playId.current) return;
        Object.entries(current.tracks).forEach(([name, track]) =>
          engine.setTrack(name, track),
        );
        update((value) => ({
          ...value,
          starting: false,
          playing: engine.playing,
          paused: engine.paused,
          error: "",
          ...(!resuming && engine.playing
            ? {
                section: value.loop || value.tune.form[0],
                playbackChord:
                  value.tune.sections[value.loop || value.tune.form[0]]
                    .bars[0][0],
                chord: value.follow
                  ? value.tune.sections[value.loop || value.tune.form[0]]
                      .bars[0][0]
                  : value.chord,
                counting: true,
              }
            : {}),
        }));
      } catch (error) {
        if (request === playId.current)
          update((value) => ({
            ...value,
            starting: false,
            error: `Could not start playback. ${error.message}`,
          }));
      }
    },
    [engine, update],
  );

  useEffect(() => {
    let captured = false;
    const keydown = (event) => {
      const space = isPracticeSpace(event, isTypingTarget(event.target));
      if (!space) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      captured = true;
      if (!event.repeat && stateRef.current.tune)
        togglePlay({ restart: event.shiftKey });
    };
    const keyup = (event) => {
      if ((event.code === "Space" || event.key === " ") && captured) {
        event.preventDefault();
        event.stopImmediatePropagation();
        captured = false;
      }
    };
    const blur = () => {
      captured = false;
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("keyup", keyup, true);
      window.removeEventListener("blur", blur);
    };
  }, [togglePlay]);

  const shapePlan = useMemo(
    () =>
      state.tune
        ? planShapes(state.tune, {
            zone: state.shapeZone,
            chorus: state.chorus,
            inversion: state.inversion,
          })
        : {},
    [state.tune, state.shapeZone, state.chorus, state.inversion],
  );
  const reminderSymbol =
    state.playing || state.paused ? state.playbackChord : state.chord;
  const location =
    (state.playing || state.paused) && state.formIndex >= 0
      ? `${state.formIndex}-${state.barIndex}-${state.chordIndex || 0}`
      : null;
  const reminderShape = state.tune
    ? (shapePlan[location]?.shape ??
      Object.values(shapePlan).find((entry) => entry.chord === reminderSymbol)
        ?.shape ??
      chooseShape(reminderSymbol, null, {
        zone: state.shapeZone,
        chorus: state.chorus,
        inversion: state.inversion,
      }))
    : null;
  const voicings = useMemo(() => {
    try {
      const shapes = getVoicings(state.chord);
      return reminderShape && reminderSymbol === state.chord
        ? [
            reminderShape,
            ...shapes.filter(
              (shape) =>
                shape.frets.join(",") !== reminderShape.frets.join(","),
            ),
          ].slice(0, 3)
        : shapes;
    } catch {
      return [];
    }
  }, [state.chord, reminderShape, reminderSymbol]);

  const setField = useCallback(
    (field, value) =>
      update((current) => ({
        ...current,
        [field]: typeof value === "function" ? value(current[field]) : value,
      })),
    [update],
  );

  const selectSavedSong = useCallback(
    async (tune) => {
      const customSongs = await cloudSongs();
      update((current) => ({
        ...current,
        customSongs,
        tunes: [
          ...current.tunes.filter((item) => !item.custom),
          ...customSongs,
        ],
      }));
      await loadTune(tune.slug, false, tune);
    },
    [loadTune, update],
  );

  const editSong = useCallback(
    (tune) => {
      feedback("open");
      openSongEditor({
        tune,
        onSave: async (fields) => {
          const parsed = parseSong(fields, tune?.slug);
          if (tune)
            for (const [id, section] of Object.entries(parsed.sections)) {
              if (tune.sections[id]?.scaleHint)
                section.scaleHint = { ...tune.sections[id].scaleHint };
              if (tune.sections[id]?.melody) {
                if (section.bars.length !== tune.sections[id].bars.length)
                  throw Error(
                    "Keep the same number of bars to preserve this melody.",
                  );
                section.melody = structuredClone(tune.sections[id].melody);
              }
            }
          if (tune?.scanId) parsed.scanId = tune.scanId;
          await selectSavedSong(await saveCloudSong(parsed));
        },
        onImport: async (data) =>
          selectSavedSong(
            await saveCloudSong({
              ...data,
              slug: `custom-${crypto.randomUUID()}`,
              custom: true,
            }),
          ),
      });
    },
    [feedback, selectSavedSong],
  );

  const actions = useMemo(
    () => ({
      loadTune,
      tryPracticeLoop: async (id = "major-251") => {
        try {
          const tune = createPracticeLoop(id);
          await selectSavedSong(await saveCloudSong(tune));
          setField('view','scales');
        } catch(error) { update({error:error.message}); }
      },
      retry: () =>
        stateRef.current.cloudError
          ? initialize()
          : stateRef.current.tune
            ? loadTune(stateRef.current.tune.slug)
            : initialize(),
      togglePlay,
      setTempo: (value) => {
        const tempo = Math.max(40, Math.min(240, Number(value)));
        engine.setTempo(tempo);
        setField("tempo", tempo);
      },
      setView: (view) => {
        feedback();
        update((current) => ({ ...current, view }));
        const tune = stateRef.current.tune;
        if (view === "melody" && tune?.melodyVersion)
          loadTune(tune.melodyVersion);
      },
      setChord: (chord, details = {}) => {
        feedback("open");
        update((current) => ({
          ...current,
          chord,
          follow: current.playing ? false : current.follow,
          section: details.section ?? current.section,
          sheet: Boolean(details.openSheet),
          modalReturn: details.location ?? null,
          bandOpen: false,
        }));
      },
      openSheet: () =>
        update((current) => ({
          ...current,
          chord: current.playing ? current.playbackChord : current.chord,
          follow: true,
          sheet: true,
          bandOpen: false,
          modalReturn: null,
        })),
      closeSheet: () => {
        feedback("close");
        setField("sheet", false);
      },
      setLoop: (id) => {
        const loop = stateRef.current.loop === id ? null : id;
        feedback(loop ? "on" : "off");
        engine.setLoop(loop);
        update((current) => ({
          ...current,
          loop,
          section: id ?? current.section,
        }));
      },
      clearLoop: () => {
        feedback("off");
        engine.setLoop(null);
        setField("loop", null);
      },
      setChartFollow: (value) => setField("chartFollow", Boolean(value)),
      setFollow: (value) =>
        update((current) => ({
          ...current,
          follow: Boolean(value),
          chord:
            value && current.playing ? current.playbackChord : current.chord,
        })),
      setNotes: (value) => {
        feedback();
        setField("notes", Boolean(value));
      },
      setAlt: (value) => {
        feedback();
        setField("alt", value ?? ((current) => !current));
      },
      setSection: (section) => {
        feedback();
        update((current) => ({
          ...current,
          section,
          chord: current.tune.sections[section].bars[0][0],
          alt: false,
        }));
      },
      setSoloMode: (value) => setField("soloMode", value),
      setSoloLevel: (value) => setField("soloLevel", value),
      setSoloStart: (value) => setField("soloStart", Number(value)),
      setSoloFollow: (value) => setField("soloFollow", Boolean(value)),
      setSoloPage: (value) =>
        update((current) => ({
          ...current,
          soloPage: value,
          soloFollow: false,
        })),
      setPlayPhrases: (value) => {
        const enabled = Boolean(value);
        engine.hearPhrases = enabled;
        engine.setSoloPhrases(soloPhrases);
        update((current) => {
          const tracks = {
            ...current.tracks,
            solo: { ...current.tracks.solo, muted: !enabled },
          };
          engine.setTrack("solo", tracks.solo);
          return { ...current, tracks, playPhrases: enabled };
        });
      },
      setMelodyMode: (value) => setField("melodyMode", value),
      setReadingHints: (value) => setField("readingHints", Boolean(value)),
      selectShapeZone: (value) => setField("shapeZone", value),
      selectInversion: (value) => setField("inversion", value),
      previewVoicing: (index) =>
        engine
          .preview(voicings[index]?.pitches || [])
          .catch((error) =>
            update((current) => ({
              ...current,
              error: `Could not start audio. ${error.message}`,
            })),
          ),
      previewNotes: (pitches) =>
        engine
          .preview(pitches)
          .catch((error) =>
            update((current) => ({ ...current, error: error.message })),
          ),
      hearPhrase: async (id) => {
        const phrase =
          typeof id === "number"
            ? soloPhrases[id]
            : soloPhrases.find((item) => item.id === id);
        if (!phrase) return;
        update((current) => ({ ...current, soloFollow: false, soloPage: id }));
        if (engine.playing) await engine.pause();
        return engine.previewPhrase(phrase.riff, {
          tempo: stateRef.current.tempo,
          beatValue: Number(stateRef.current.tune.timeSignature.split("/")[1]),
        });
      },
      toggleSidebar: () =>
        update((current) => {
          const sidebarCollapsed = !current.sidebarCollapsed;
          try {
            localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
          } catch {}
          return { ...current, sidebarCollapsed };
        }),
      toggleSettings: (value) =>
        setField("bandOpen", value ?? ((current) => !current)),
      setTrackMuted: (name) =>
        update((current) => {
          const track = {
            ...current.tracks[name],
            muted: !current.tracks[name].muted,
          };
          const tracks = { ...current.tracks, [name]: track };
          if (name === "melody") engine.hearMelody = !track.muted;
          if (name === "solo") engine.hearPhrases = !track.muted;
          engine.setTrack(name, track);
          feedback(track.muted ? "off" : "on");
          return {
            ...current,
            tracks,
            ...(name === "solo" ? { playPhrases: !track.muted } : {}),
          };
        }),
      setTrackVolume: (name, volume) =>
        update((current) => {
          const track = { ...current.tracks[name], volume: Number(volume) };
          engine.setTrack(name, track);
          return { ...current, tracks: { ...current.tracks, [name]: track } };
        }),
      findSong: () => {
        feedback("open");
        openSongLibrary({
          songs: stateRef.current.tunes,
          onSelect: (slug, melody) => {
            if (melody) setField("view", "melody");
            loadTune(slug);
            feedback();
          },
          onWrite: () => editSong(),
        });
      },
      editSong: (tune) => {
        setField("bandOpen", false);
        editSong(tune);
      },
      exportSong: () => {
        const tune = stateRef.current.tune;
        if (!tune) return;
        setField("bandOpen", false);
        const blob = new Blob([`${JSON.stringify(tune, null, 2)}\n`], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${tune.slug}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      transpose: async (key) => {
        const wasPlaying = engine.playing;
        ++playId.current;
        engine.stop();
        update((current) => {
          const tune = transposeTune(current.tune, key);
          const section = current.loop || tune.form[0],
            chord = tune.sections[section].bars[0][0];
          return {
            ...current,
            tune,
            chorus: 0,
            section,
            chord,
            playbackChord: chord,
            nextPlaybackChord: null,
            alt: false,
            starting: false,
          };
        });
        if (wasPlaying) queueMicrotask(() => togglePlay());
      },
      feedback,
    }),
    [
      editSong,
      engine,
      feedback,
      initialize,
      loadTune,
      setField,
      soloPhrases,
      togglePlay,
      update,
      voicings,
    ],
  );

  return {
    state: {
      ...state,
      shapePlan,
      soloPhrases,
      voicings,
      reminderShape,
      reminderSymbol,
    },
    actions,
    engine,
  };
}

export default usePractice;
