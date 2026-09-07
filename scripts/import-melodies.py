"""Import matched early standards from OpenEWLD; run with Python + music21.
The collection identifies its scores as public-domain material. Limit imports to
works dated through 1930, retain attribution, and exclude known metadata errors.
"""
import sys,concurrent.futures,json,pathlib,re,sqlite3,urllib.request,urllib.parse,zipfile
from music21 import converter,stream,note,chord,harmony,meter,key
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path('/tmp/changes-openewld');CACHE.mkdir(exist_ok=True)
PRIVATE='--all-private' in sys.argv
BASE='https://raw.githubusercontent.com/00sapo/OpenEWLD/master/'
def fetch(path,dest):
 if not dest.exists():urllib.request.urlretrieve(BASE+urllib.parse.quote(path,safe='/'),dest)
 return dest
fetch('OpenEWLD.db',CACHE/'index.db');db=sqlite3.connect(CACHE/'index.db')
def norm(s):return re.sub(r'[^a-z0-9]','',s.lower()).removeprefix('the')
catalog={norm(t['title']):t for t in json.loads((ROOT/'tunes/index.json').read_text()) if not t['slug'].startswith('melody-')}
rows=db.execute("SELECT id,title,first_performance_date,path_leadsheet FROM works"+("" if PRIVATE else " WHERE substr(first_performance_date,1,4) <= '1930'")).fetchall()
rows=[r for r in rows if (PRIVATE or norm(r[1]) in catalog) and r[1]!='Nobody Else but Me'] # mislabeled 1946 song
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(lambda r:fetch(r[3],CACHE/(str(r[0])+'.mxl')),rows))
accepted={};errors=[]
def normalize_chord(figure):
 s=figure.replace('-','b').replace('ø7','m7b5').replace('o7','dim7').replace('7+','aug7').replace('+','aug')
 s=s.replace('sus add 7 add 9','9sus4').replace('sus add 7','7sus4')
 s=re.sub(r'\s+(add|alter)\s+([b#]\d+)',r'\2',s)
 s=s.replace(' add 9','add9')
 return s
def chord_name(c):
 return normalize_chord(c.figure)
def convert(row):
 ident,title,date,path=row;original=catalog.get(norm(title),{'slug':re.sub('[^a-z0-9]+','-',title.lower()).strip('-'),'title':title,'tempo':100,'style':'swing'})
 score=converter.parse(CACHE/(str(ident)+'.mxl'));part=score.parts[0]
 try:part=part.expandRepeats()
 except Exception as error:raise ValueError('Cannot resolve repeat structure: '+str(error))
 signatures=list(part.recurse().getElementsByClass(meter.TimeSignature));meters={m.ratioString for m in signatures}
 if len(meters)!=1 or next(iter(meters)) not in ['4/4','3/4','2/4','6/8']:raise ValueError('Mixed or unsupported meter')
 signature=next(iter(meters));num,den=map(int,signature.split('/'));scale=den/4
 key_obj=next(iter(part.recurse().getElementsByClass(key.KeySignature)),None)
 song_key=key_obj if isinstance(key_obj,key.Key) else (key_obj.asKey() if key_obj else part.analyze('key'))
 tonic=song_key.tonic.name.replace('-','b')+('m' if song_key.mode=='minor' else '')
 bars=[];melodies=[];durations=[];previous='N.C.'
 for measure in part.getElementsByClass(stream.Measure):
  events=[];changes=[];flat=measure.flatten()
  content=[n for n in flat.notesAndRests if not isinstance(n,harmony.ChordSymbol)]
  if not content:continue
  end=max(float(n.offset+n.duration.quarterLength)*scale for n in content)
  # MusicXML encodes pickup measures with shortened duration.
  offset=max(0,num-end) if not bars and end<num else 0
  for n in content:
   duration=float(n.duration.quarterLength)*scale
   if duration==0:continue # grace notes are ornaments
   if isinstance(n,chord.Chord):raise ValueError('Polyphonic melody')
   beat=float(n.offset)*scale+offset
   if beat+duration>num+1e-5:raise ValueError('Bar exceeds meter')
   events.append({'beat':beat,'duration':duration,'midi':None if n.isRest else int(n.pitch.midi),'tie':bool(n.tie and n.tie.type in ['continue','stop'])})
  events.sort(key=lambda n:n['beat']);clean=[];cursor=0
  for n in events:
   if n['beat']<cursor-1e-5:raise ValueError('Overlapping voices')
   if n['beat']>cursor+1e-5:clean.append({'beat':cursor,'duration':n['beat']-cursor,'midi':None})
   clean.append(n);cursor=n['beat']+n['duration']
  if cursor<num-1e-5:clean.append({'beat':cursor,'duration':num-cursor,'midi':None})
  if not clean:raise ValueError('Empty measure')
  for h in flat.getElementsByClass(harmony.ChordSymbol):
   pos=float(h.offset)*scale+offset
   if pos<num:changes.append((pos,chord_name(h)))
  changes.sort();changes=[(0,previous)]+changes
  merged={}
  for pos,symbol in changes:merged[round(pos,7)]=symbol
  positions=sorted(merged);symbols=[];ds=[]
  for i,pos in enumerate(positions):
   length=(positions[i+1] if i+1<len(positions) else num)-pos
   if length>1e-5:symbols.append(merged[pos]);ds.append(length)
  previous=symbols[-1];bars.append(symbols);durations.append(ds);melodies.append(clean)
 pitches=[n['midi'] for bar in melodies for n in bar if n['midi'] is not None]
 if not pitches:raise ValueError('No pitched melody')
 shift=0
 while max(pitches)+shift>83:shift-=12
 while min(pitches)+shift<40:shift+=12
 if max(pitches)+shift>83:raise ValueError('Range too wide')
 for bar in melodies:
  for n in bar:
   if n['midi'] is not None:n['midi']+=shift
 if not bars or len(bars)>128:raise ValueError('Unsupported length')
 sections={};form=[]
 for start in range(0,len(bars),8):
  sid=chr(65+len(form));form.append(sid);sections[sid]={'label':f'Bars {start+1}–{min(start+8,len(bars))}','bars':bars[start:start+8],'barDurations':durations[start:start+8],'melody':melodies[start:start+8]}
 return {'slug':('custom-openewld-' if PRIVATE else 'melody-')+original['slug'],'title':title+' · Melody','composer':original.get('composer',''),'key':tonic,'tempo':original['tempo'],'style':original['style'],'timeSignature':signature,'form':form,'sections':sections,'melodyNotes':'Melody edition · includes the source chart’s introduction and repeats.','melodySource':{'collection':'OpenEWLD','url':'https://github.com/00sapo/OpenEWLD/blob/master/'+urllib.parse.quote(path,safe='/'),'workDate':date},**({'originalSlug':original['slug']} if norm(title) in catalog else {})}
for row in rows:
 name=norm(row[1])
 if name in accepted:continue
 try:accepted[name]=convert(row)
 except Exception as error:errors.append({'title':row[1],'error':str(error)})
# Stage until JS theory and timeline validation accepts each import.
(CACHE/('all-private.json' if PRIVATE else 'converted.json')).write_text(json.dumps(list(accepted.values())))
(CACHE/'skipped.json').write_text(json.dumps(errors,indent=2))
print(f'{len(accepted)} converted melody editions; {len(errors)} rejected source variants')
