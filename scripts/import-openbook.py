"""Compile OpenBook notation with LilyPond; stage private-library melodies.
Requires lilypond and Python music21/jinja2. No inference or paid services.
Source checkout and generated artifacts remain outside the published site.
"""
import functools,pathlib,re,tomllib,json,subprocess,concurrent.futures,math
from fractions import Fraction
from jinja2 import Template
from music21 import converter,chord,harmony,meter,key,note
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path('/tmp/changes-openbook');OUT=pathlib.Path('/tmp/changes-openbook-midi');OUT.mkdir(exist_ok=True)
common=(SOURCE/'src/include/common.ly.tera').read_text().replace('{{ lilypond_version }}','2.26.0')
catalog=json.loads((ROOT/'tunes/index.json').read_text())
def norm(s):return re.sub('[^a-z0-9]','',s.lower()).removeprefix('the')
lookup={norm(t['title']):t for t in catalog if not t.get('originalSlug')}
def prepare(path):
 text=path.read_text();meta=tomllib.loads(re.search(r'{#(.*?)#}',text,re.S)[1]);version='Fake' if path.name=='cheek_to_cheek.ly.tera' else meta['default_version'];versions=meta['versions']
 if not versions.get(version,{'doVoice':True}).get('doVoice'):version=next((v for v,flags in versions.items() if flags.get('doVoice')),None)
 if not version:raise ValueError('No written melody')
 template=Template(text);voice=template.render(part='Voice'+version);changes=template.render(part='Chords'+version)
 if not voice.strip() or not changes.strip():raise ValueError('Missing melody or harmony')
 # Keep the original relative-pitch anchor used by OpenBook's MIDI driver.
 ly=common+'\nmelodyMusic = \\relative c\' '+voice+'\nharmonyMusic = '+changes+'\n\\score { \\unfoldRepeats << \\new Staff = "melody" \\melodyMusic \\new Staff = "harmony" \\harmonyMusic >> \\midi {} }\n'
 target=OUT/path.name.replace('.ly.tera','.ly');target.write_text(ly)
 result=subprocess.run(['lilypond','-dno-print','-o',str(target.with_suffix('')),str(target)],capture_output=True,text=True,timeout=40)
 target.with_suffix('.log').write_text(result.stderr)
 if result.returncode:raise ValueError('Notation did not compile')
 return path,meta,voice,target.with_suffix('.midi')
def rational(v):
 fraction=Fraction(float(v)).limit_denominator(96)
 return float(fraction) if fraction.denominator<=32 else round(float(v)*96)/96
PATTERNS=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/chord-patterns.mjs')],text=True))
NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
def symbol(c):
 return match_symbol(tuple(sorted({p.pitchClass for p in c.pitches})),min(p.midi for p in c.pitches)%12)
@functools.lru_cache(maxsize=2048)
def match_symbol(pcs,bass):
 # Exact pitch-class matching avoids MIDI enharmonic spelling errors.
 for root in [bass]+[p for p in sorted(pcs) if p!=bass]:
  intervals=sorted((p-root)%12 for p in pcs)
  for suffix,pattern in PATTERNS:
   if intervals==pattern:return NAMES[root]+suffix+('/'+NAMES[bass] if root!=bass else '')
 raise ValueError('Unsupported harmony pitch set '+str(sorted(pcs)))

def convert(prepared):
 path,meta,voice,midi=prepared;attrs=meta['attributes'];title=attrs['title'];original=lookup.get(norm(title),{})
 score=converter.parse(midi,quantizePost=False);parts={p.partName:p for p in score.parts}
 melody=parts.get('melody:');harm=parts.get('harmony:')
 if melody is None or harm is None:raise ValueError('Missing MIDI parts')
 signatures={m.ratioString for m in score.recurse().getElementsByClass(meter.TimeSignature)}
 if len(signatures)!=1:raise ValueError('Mixed meter')
 signature=next(iter(signatures));num,den=map(int,signature.split('/'));scale=den/4
 partial=re.search(r'\\partial\s+(\d+)(\.*)',voice)
 pickup=(4/int(partial[1]))*sum(.5**i for i in range(len(partial[2])+1))*scale if partial else 0
 padding=num-pickup if pickup else 0
 notes=[]
 for n in melody.flatten().notes:
  if isinstance(n,chord.Chord):
   # For harmonized melody hits, retain the upper written line only.
   upper=note.Note(max(p.midi for p in n.pitches));upper.offset=n.offset;upper.duration=n.duration;upper.tie=n.tie;n=upper
  notes.append({'start':rational(float(n.offset)*scale+padding),'duration':rational(float(n.quarterLength)*scale),'midi':int(n.pitch.midi),'tie':bool(n.tie and n.tie.type in ['continue','stop'])})
 if not notes:raise ValueError('No notes')
 rawchords=[]
 for c in harm.flatten().notes:
  if not isinstance(c,chord.Chord):raise ValueError('Single-note harmony')
  rawchords.append((rational(float(c.offset)*scale+padding),symbol(c),rational(float(c.quarterLength)*scale)))
 length=max(max(n['start']+n['duration'] for n in notes),max(s+d for s,c,d in rawchords));count=math.ceil((length-1e-5)/num)
 if count>512:raise ValueError('Form too long')
 pitches=[n['midi'] for n in notes];shift=0
 while max(pitches)+shift>83:shift-=12
 while min(pitches)+shift<40:shift+=12
 if max(pitches)+shift>83:raise ValueError('Melody exceeds guitar range')
 bars=[];durations=[];melodies=[];last='N.C.'
 for bi in range(count):
  start=bi*num;end=start+num;events=[];cursor=0
  for n in notes:
   a=max(start,n['start']);b=min(end,n['start']+n['duration'])
   if b-a<1e-5:continue
   beat=rational(a-start);duration=rational(b-a)
   if beat<cursor-1e-4:raise ValueError('Overlapping melody voices')
   if beat>cursor+1e-5:events.append({'beat':cursor,'duration':rational(beat-cursor),'midi':None})
   events.append({'beat':beat,'duration':duration,'midi':n['midi']+shift,'tie':n['tie'] or a>n['start']+1e-5});cursor=beat+duration
  if cursor<num-1e-5:events.append({'beat':cursor,'duration':rational(num-cursor),'midi':None})
  changes={0:last}
  for s,c,d in rawchords:
   if start-1e-5<=s<end-1e-5:changes[rational(s-start)]=c
  positions=sorted(changes);symbols=[];ds=[]
  for i,pos in enumerate(positions):
   duration=rational((positions[i+1] if i+1<len(positions) else num)-pos)
   if duration>1e-5:
    if symbols and symbols[-1]==changes[pos]:ds[-1]+=duration
    else:symbols.append(changes[pos]);ds.append(duration)
  last=symbols[-1];bars.append(symbols);durations.append(ds);melodies.append(events)
 keys=list(melody.recurse().getElementsByClass(key.Key));song_key=keys[0] if keys else melody.analyze('key')
 tonic=song_key.tonic.name.replace('-','b')+('m' if song_key.mode=='minor' else '')
 sections={};form=[]
 for start in range(0,count,8):
  sid='S'+str(len(form)+1);form.append(sid);sections[sid]={'bars':bars[start:start+8],'barDurations':durations[start:start+8],'melody':melodies[start:start+8]}
 slug='custom-openbook-'+path.name.replace('.ly.tera','').replace('_','-')
 style=original.get('style','bossa' if 'bossa' in attrs.get('piece','').lower() else 'swing')
 return {'slug':slug,'custom':True,'title':title+' · Melody','composer':attrs.get('composer',''),'key':tonic,'tempo':original.get('tempo',100),'style':style,'timeSignature':signature,'form':form,'sections':sections,'hasMelody':True,'melodyNotes':'OpenBook melody · source repeats included.','melodySource':{'collection':'OpenBook','url':'https://github.com/veltzer/book-openbook/blob/master/src/openbook/'+path.name,'copyright':attrs.get('copyright','')},**({'originalSlug':original['slug']} if original else {})}
results=[];errors=[]
def work(path):
 try:
  midi=OUT/path.name.replace('.ly.tera','.midi')
  if midi.exists() and path.name!='cheek_to_cheek.ly.tera':
   text=path.read_text();meta=tomllib.loads(re.search(r'{#(.*?)#}',text,re.S)[1]);voice=Template(text).render(part='Voice'+meta['default_version']);prepared=(path,meta,voice,midi)
  else:prepared=prepare(path)
  return convert(prepared),None
 except Exception as e:return None,{'file':path.name,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for result,error in pool.map(work,sorted((SOURCE/'src/openbook').glob('*.ly.tera'))):
  if result:results.append(result)
  else:errors.append(error)
(OUT/'converted.json').write_text(json.dumps(results));(OUT/'skipped.json').write_text(json.dumps(errors,indent=2));print(json.dumps({'converted':len(results),'skipped':errors},indent=2))
