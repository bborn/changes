import {melodyDuration} from './melody.js';
import {loadSamples,nearestSample} from './samples.js';
import { parseChord, getVoicings, chordPitchClasses } from '../theory.js';
import { Timeline, clampTempo } from './timeline.js';

const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const pc = name => ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;

export class AudioEngine extends EventTarget {
  constructor() {
    super();
    this.context = null;
    this.playing = false;
    this.paused = false;
    this._hearPhrases = false;
    this.phraseSources = new Set();
    this.soloPhrases = [];
    this.soloNoteQueue = [];
    this.activeSoloNote = null;
    this.generation = 0;
    this.sources = new Set();
    this.queue = [];
    this.tracks = { bass: { volume: 0.75, muted: false }, drums: { volume: 0.55, muted: false }, chords: { volume: 0.45, muted: false }, melody: { volume: 0.7, muted: false }, solo: { volume: 0.7, muted: false } };
  }
  async initialize() {
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support Web Audio.');
      this.context = new Context();
      const compressor = this.context.createDynamicsCompressor();
      compressor.connect(this.context.destination);
      this.master = this.context.createGain();
      this.master.gain.value = 0.65;
      this.master.connect(compressor);
      for (const track of Object.values(this.tracks)) {
        track.gain = this.context.createGain();
        track.gain.gain.value = track.muted ? 0 : track.volume;
        track.gain.connect(this.master);
      }
      this.chordFilter = this.context.createBiquadFilter();
      this.chordFilter.type = 'lowpass';
      this.chordFilter.frequency.value = 2400;
      this.chordFilter.connect(this.tracks.chords.gain);
      this.melodyFilter = this.context.createBiquadFilter();
      this.melodyFilter.type = 'lowpass';
      this.melodyFilter.frequency.value = 2400;
      this.melodyFilter.connect(this.tracks.melody.gain);
      this.soloFilter=this.context.createBiquadFilter();
      this.soloFilter.type='lowpass';
      this.soloFilter.frequency.value=2400;
      this.soloFilter.connect(this.tracks.solo.gain);
      this.previewFilter = this.context.createBiquadFilter();
      this.previewFilter.type = 'lowpass';
      this.previewFilter.frequency.value = 2400;
      this.previewFilter.connect(this.master);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    await this.context.resume();
  }
  async play(tune, options = {}) {
    this.stop();
    const generation = this.generation;
    await this.initialize();
    if (generation !== this.generation) return;
    await this.prepareSamples();
    if (generation !== this.generation) return;
    this.timeline = new Timeline(tune, { ...options, startTime: this.context.currentTime + 0.08 });
    this.playing = true;
    this.tick();
  }
  async pause() {
    if (!this.playing) return;
    this.previewEngine?.stop();
    this.playing=false;this.paused=true;clearTimeout(this.timer);
    await this.context.suspend();
    this.publishSoloNote(null);
    if(this.paused)this.dispatchEvent(new Event('pause'));
  }
  async resume() {
    if(!this.paused)return;
    const generation=this.generation;
    this.previewEngine?.stop();
    await this.context.resume();
    if(generation!==this.generation||!this.paused)return;
    this.paused=false;this.playing=true;this.tick();
  }
  stop() {
    this.previewEngine?.stop();
    this.generation++;
    this.playing = false;
    this.paused = false;
    clearTimeout(this.timer);
    this.queue = [];
    this.soloNoteQueue = [];
    this.publishSoloNote(null);
    this.melodyHeldUntil=0;this.melodyPitch=null;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* Already ended. */ }
    }
    this.sources.clear();
    this.phraseSources.clear();
    this.dispatchEvent(new Event('stop'));
  }
  setTempo(tempo) { if (this.timeline) this.timeline.pendingTempo = clampTempo(tempo); }
  setLoop(section) {
    if (this.timeline) this.timeline.loopSection = section && this.timeline.tune.sections[section] ? section : null;
  }
  get hearPhrases(){return this._hearPhrases;}
  set hearPhrases(value){
    this._hearPhrases=Boolean(value);
    if(!this._hearPhrases){this.soloNoteQueue=[];this.publishSoloNote(null);for(const source of this.phraseSources){try{source.stop();}catch{}this.sources.delete(source);}this.phraseSources.clear();}
  }
  setSoloPhrases(phrases) { this.soloPhrases = Array.isArray(phrases) ? phrases : []; }
  setTrack(name, { muted, volume } = {}) {
    const track = this.tracks[name];
    if (!track) return;
    if (muted !== undefined) track.muted = Boolean(muted);
    if (volume !== undefined) track.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    if(name==='solo'&&(track.muted||track.volume===0))this.publishSoloNote(null);
    if (track.gain) track.gain.gain.setTargetAtTime(track.muted ? 0 : track.volume, this.context.currentTime, 0.015);
  }
  async preview(pitches) {
    if(this.paused){this.previewEngine ||= new AudioEngine();return this.previewEngine.preview(pitches);}
    const generation=this.generation;
    await this.initialize();
    await this.prepareSamples();
    if(generation!==this.generation)return;
    this.chord(pitches, this.context.currentTime + 0.01, 1.2, this.previewFilter);
  }
  /** Audition an original exercise without moving the song's paused audio clock. */
  async previewPhrase(notes, {tempo=100,beatValue=4}={}) {
    this.previewEngine ||= new AudioEngine();
    const player=this.previewEngine;
    player.stop();
    const generation=player.generation;
    await player.initialize();
    await player.prepareSamples();
    if(generation!==player.generation)return;
    const seconds=60/Math.max(40,Math.min(240,tempo))*4/beatValue;
    const start=player.context.currentTime+.03;
    for(const note of notes){
      const delay=note.tie?0:Math.min(note.timingOffset||0,note.duration*seconds*.15);
      player.schedulePhraseNote(note,start+note.beat*seconds+delay,note.duration*seconds-delay,player.previewFilter);
    }
    const duration=Math.max(0,...notes.map(n=>n.beat+n.duration))*seconds;
    await new Promise(resolve=>{
      const done=()=>{clearTimeout(timer);player.removeEventListener('stop',done);resolve();};
      const timer=setTimeout(done,(duration+.1)*1000);
      player.addEventListener('stop',done,{once:true});
    });
  }
  /** A softer single-note voice with a short release between phrase notes. */
  phraseNote(pitch,time,duration,destination=this.soloFilter,velocity=1,articulation=null) {
    const expression=Math.max(.4,Math.min(1.2,Number(velocity)||1));
    const length=Math.max(.1,duration)+Math.min(.07,duration*.15);
    const connected=articulation?.type==='hammer'||articulation?.type==='pull';
    const sliding=articulation?.type==='slide';
    const level=(this.samples?.22:.12)*expression*(connected?.62:sliding?.82:1);
    const attack=connected?.018:sliding?.012:(this.samples?.003:.008);
    const source=this.samples?this.sample('piano',pitch,time,length,destination,level,attack):this.tone(pitch,time,length,destination,level,'triangle',0,attack);
    if(source)this.phraseSources.add(source);return source;
  }
  schedulePhraseNote(note,time,duration,destination=this.soloFilter) {
    const sources=[];
    sources.push(this.phraseNote(note.pitch,time,duration,destination,note.velocity,note.tie?null:note.articulation));
    if(note.harmony?.pitch!=null)sources.push(this.phraseNote(note.harmony.pitch,time,duration,destination,(Number(note.velocity)||1)*.88,null));
    return sources.filter(Boolean);
  }
  scheduleSoloPhrase(event,now=this.context.currentTime) {
    if(!this.hearPhrases||event.countIn||event.beat!==0)return;
    const phrase=this.soloPhrases.find(item=>item.formIndex===event.formIndex&&item.bars.some(bar=>bar.barIndex===event.barIndex));
    if(!phrase)return;
    const barOffset=phrase.bars.findIndex(bar=>bar.barIndex===event.barIndex)*this.timeline.beatsPerBar,barEnd=barOffset+this.timeline.beatsPerBar;
    for(const note of phrase.riff.filter(item=>item.beat>=barOffset&&item.beat<barEnd)){
      const delay=note.tie?0:Math.min(note.timingOffset||0,note.duration*event.duration*.15);
      const time=event.time+(note.beat-barOffset)*event.duration+delay,duration=note.duration*event.duration-delay;
      if(time>=now-.03){
        if(!note.tie||!this.soloNoteQueue.some(held=>held.pitch===note.pitch&&held.time<time&&held.end>time))this.schedulePhraseNote(note,time,duration,this.soloFilter);
        this.soloNoteQueue.push({...note,phraseId:phrase.id,time,end:time+duration});
      }
    }
  }
  publishSoloNote(note) {
    if(this.activeSoloNote===note)return;
    this.activeSoloNote=note;
    this.dispatchEvent(new CustomEvent('solo-note',{detail:note}));
  }
  updateSoloNote(audibleNow) {
    this.soloNoteQueue=this.soloNoteQueue.filter(note=>note.end>audibleNow);
    const audible=this.playing&&this.hearPhrases&&!this.tracks.solo.muted&&this.tracks.solo.volume>0;
    this.publishSoloNote(audible?this.soloNoteQueue.findLast(note=>note.time<=audibleNow)||null:null);
  }
  /** Short tactile cues share the audio context, and stay silent during practice. */
  async feedback(kind = 'tap') {
    if (this.playing || this.paused) return;
    const generation = this.generation;
    await this.initialize();
    if (this.playing || generation !== this.generation) return;
    const now = this.context.currentTime;
    if (now - (this.lastFeedback ?? -1) < 0.065) return;
    this.lastFeedback = now;
    const notes = { tap: [79], open: [74, 81], close: [76, 69], on: [76, 83], off: [74, 67] }[kind] || [79];
    notes.forEach((note, index) => this.tone(note, now + 0.005 + index * 0.035, 0.065, this.master, 0.035, 'sine'));
  }
  tick() {
    if (!this.playing) return;
    const now = this.context.currentTime;
    while (this.timeline.time < now + 0.12) {
      const event = this.timeline.next();
      // Skip expired audio after a suspended tab instead of playing a burst.
      if (event.time >= now - 0.03) {
        this.schedule(event);
        this.scheduleSoloPhrase(event,now);
        if(this.hearMelody&&!event.countIn){
          const note=melodyDuration(this.timeline.tune,event,this.timeline.loopSection);
          if(note?.midi!=null&&!(note.tie&&this.melodyPitch===note.midi&&this.melodyHeldUntil>event.time+.001)){
            const duration=note.duration*event.duration;
            this.chord([note.midi],event.time,duration*.98,this.melodyFilter);
            this.melodyPitch=note.midi;this.melodyHeldUntil=event.time+duration;
          }
        }else{this.melodyHeldUntil=0;this.melodyPitch=null;}
        this.queue.push(event);
      }
    }
    // currentTime is the render clock; outputTimestamp is the clock reaching the speakers.
    const timestamp = this.context.getOutputTimestamp?.();
    const audibleNow = timestamp?.contextTime > 0 ? timestamp.contextTime : now - (this.context.outputLatency || 0);
    this.updateSoloNote(audibleNow);
    while (this.queue.length && this.queue[0].time <= audibleNow) {
      const event = this.queue.shift();
      if (event.beat === 0) this.dispatchEvent(new CustomEvent('bar', { detail: event }));
      this.dispatchEvent(new CustomEvent('beat', { detail: event }));
    }
    this.timer = setTimeout(() => this.tick(), 25);
  }
  source(node, time, duration, destination, level, attack = 0.008) {
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    node.connect(envelope);
    envelope.connect(destination);
    this.sources.add(node);
    node.onended = () => { this.sources.delete(node); this.phraseSources.delete(node); node.disconnect(); envelope.disconnect(); };
    node.start(time);
    node.stop(time + duration + 0.02);
  }
  tone(midi, time, duration, destination, level = 0.22, type = 'triangle', detune = 0, attack = 0.008) {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency(midi);
    oscillator.detune.value = detune;
    this.source(oscillator, time, duration, destination, level,attack);return oscillator;
  }
  async prepareSamples(){
    if(this.samples)return;
    if(!this.samplePromise)this.samplePromise=loadSamples(this.context).then(samples=>{this.samples=samples;}).finally(()=>{this.samplePromise=null;});
    await this.samplePromise;
  }
  sample(kind,midi,time,duration,destination,level,attack=.003){
    const sample=nearestSample(this.samples[kind],midi),node=this.context.createBufferSource(),gain=this.context.createGain();
    node.buffer=sample.buffer;node.playbackRate.value=2**((midi-sample.midi+(sample.cents||0)/100)/12);
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(level,time+attack);
    gain.gain.setValueAtTime(level,time+Math.max(.004,duration-.055));gain.gain.exponentialRampToValueAtTime(.0001,time+Math.max(.01,duration));
    node.connect(gain);gain.connect(destination);this.sources.add(node);
    node.onended=()=>{this.sources.delete(node);this.phraseSources.delete(node);node.disconnect();gain.disconnect();};node.start(time);node.stop(time+duration+.02);return node;
  }
  chord(pitches, time, duration, destination = this.chordFilter) {
    if(this.samples){pitches.forEach((pitch,i)=>this.sample('piano',pitch,time+Math.min(i*.006,duration*.1),Math.max(.02,duration-i*.006),destination,.3*(i===pitches.length-1?1:.85)));return;}
    for (const pitch of pitches) {
      this.tone(pitch, time, duration, destination, 0.055, 'sine', -4);
      this.tone(pitch, time, duration, destination, 0.045, 'sine', 4);
      this.tone(pitch + 12, time, duration * 0.35, destination, 0.012, 'sine');
    }
  }
  drum(kind, time, accent = 1) {
    const destination = this.tracks.drums.gain;
    if (kind === 'kick' || kind === 'click') {
      const oscillator = this.context.createOscillator();
      oscillator.frequency.setValueAtTime(kind === 'kick' ? 120 : 1100, time);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 42 : 800, time + 0.08);
      this.source(oscillator, time, kind === 'kick' ? 0.18 : 0.055, kind === 'click' ? this.master : destination, 0.18 * accent);
      return;
    }
    const noise = this.context.createBufferSource();
    noise.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = kind === 'snare' ? 1700 : 6500;
    filter.connect(destination);
    this.source(noise, time, kind === 'ride' ? 0.24 : kind === 'snare' ? 0.12 : 0.055, filter, (kind === 'snare' ? 0.23 : 0.12) * accent);
    const ended = noise.onended;
    noise.onended = () => { ended(); filter.disconnect(); };
  }
  schedule(event) {
    const { time, duration: d, beat, chord, nextChord, countIn } = event;
    if (countIn) { this.drum('click', time, beat === 0 ? 1 : 0.65); return; }
    const style = this.timeline.tune.style;
    if(chord==='N.C.'){if(Number.isInteger(beat))this.drum('hat',time,.45);return;}
    const parsed = parseChord(chord);
    const root = 36 + (parsed.bass ? pc(parsed.bass) : parsed.rootPc);
    const next = parseChord(nextChord==='N.C.'?chord:nextChord);
    const nextRoot = 36 + (next.bass ? pc(next.bass) : next.rootPc);
    const bass = (pitch, offset = 0, length = 0.78) => {const available=event.chordRemaining??Infinity;if(offset<available){const at=time+d*offset,duration=d*Math.min(length,available-offset);if(this.samples)this.sample('bass',pitch,at,duration,this.tracks.bass.gain,.32);else this.tone(pitch,at,duration,this.tracks.bass.gain);}};
    const voicing = getVoicings(chord)[0].pitches;
    const tones = chordPitchClasses(chord).map(tone => 36 + parsed.rootPc + ((tone - parsed.rootPc + 12) % 12));
    const chordList = this.timeline.tune.sections[event.section].bars[event.barIndex];
    const chordSpan = this.timeline.beatsPerBar / chordList.length;
    const chordBoundary = event.chordBoundary??(beat % chordSpan === 0);
    const remaining = event.chordRemaining??(chordSpan-beat%chordSpan);
    let playedStab = false;
    const stab = (offset = 0, length = 0.65) => {
      if (playedStab || offset >= remaining) return;
      playedStab = true;
      this.chord(voicing, time + d * offset, d * Math.min(length, remaining - offset));
    };
    if (chordBoundary) stab(0, style === 'ballad' ? 1.8 : style === 'funk' ? 0.3 : 0.65);
    if(!Number.isInteger(beat)){if(chordBoundary)bass(root,0,Math.min(.78,remaining));return;}
    if (style === 'swing') {
      bass(chordBoundary ? root : beat === 1 ? (tones[1] ?? root) : beat === 2 ? (tones[2] ?? root) : nextRoot - 1);
      this.drum('ride', time, beat % 2 ? 0.75 : 1);
      if (beat % 2) { this.drum('ride', time + d * 2 / 3, 0.5); this.drum('hat', time, 0.6); }
      if (beat === 0 || beat === 2) this.drum('kick', time, 0.45);
      if (beat === 0 || beat === 2) stab(beat === 0 ? 0 : 2 / 3);
    } else if (style === 'bossa') {
      if (beat % 2 === 0 || chordBoundary) bass(chordBoundary ? root : (tones[2] ?? root), 0, Math.min(1.3, remaining));
      if (beat % 2) bass(chordBoundary ? root : (tones[2] ?? root), 0.5, 0.35);
      this.drum('hat', time, 0.65); this.drum('hat', time + d / 2, 0.4);
      if (beat % 2 === 0) this.drum('kick', time, 0.65);
      if (beat === 1 || beat === 3) this.drum('snare', time + (beat === 3 ? d / 2 : 0), 0.35);
      if (beat === 0 || beat === 2) stab();
      if (beat === 1) stab(0.5);
    } else if (style === 'funk') {
      if (beat === 0 || beat === 2) bass(root, 0, 0.5);
      if (beat === 1 || beat === 3) bass(beat === 3 ? root + 12 : root, 0.5, 0.4);
      this.drum('hat', time, 0.8); this.drum('hat', time + d / 2, 0.55);
      this.drum(beat % 2 ? 'snare' : 'kick', time);
      if (beat % 2) stab(0.5, 0.3);
    } else {
      if (beat % 2 === 0 || chordBoundary) { bass(chordBoundary ? root : (tones[2] ?? root), 0, Math.min(1.7, remaining)); stab(0, 1.8); }
      this.drum('ride', time, 0.5);
      if (beat === 1 || beat === 3) this.drum('snare', time, 0.2);
    }
  }
}
export default AudioEngine;
