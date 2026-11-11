"""Build match-to-match contribution frequency from available Cricsheet innings."""
import argparse,collections,json,re,unicodedata,zipfile,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];a=argparse.ArgumentParser();a.add_argument('--archive',required=True);args=a.parse_args()
norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).casefold())
players=[p for t in json.loads((root/'prisma/data/ipl-2026-reference-squads.json').read_text())['teams'].values()for p in t['players']]
index=json.loads((root/'player-career-index.json').read_text())['players'];names=collections.defaultdict(set)
for p in index:
 if p[0].startswith('cs:')and 'IPL'in p[5]and p[3]=='male':
  for n in [p[1],*p[4]]:names[norm(n)].add(p[0][3:])
  parts=p[1].split()
  if len(parts)>2 and len(parts[0])>1:names[norm(parts[0]+' '+parts[-1])].add(p[0][3:])
alias={'Sanju Samson':'Sanju Viswanath Samson','Mitch Marsh':'Mitchell Ross Marsh','Mitch Santner':'Mitchell Josef Santner','Matt Short':'Matthew William Short','Zak Foulkes':'Zakary Foulkes','Aman Khan':'Aman Hakim Khan','Raj Bawa':'Raj Angad Bawa','Mohammad Shami':'Mohammed Shami','AM Ghazanfar':'Allah Mohammad Ghazanfar'}
alias.update(json.loads((root/'prisma/data/ipl-player-name-aliases.json').read_text())['aliases'])
z=zipfile.ZipFile(args.archive);matches=[]
for name in z.namelist():
 if not name.endswith('.json'):continue
 d=json.loads(z.read(name))
 if str(d['info']['season'])not in [str(y)for y in range(2021,2027)]:continue
 matches.append((Path(name).stem,d))
 for n,ident in d['info']['registry']['people'].items():names[norm(n)].add(ident)
ids={}
for p in players:
 candidates=names[norm(p['name'])]|names[norm(alias.get(p['name'],''))]
 if len(candidates)==1:ids[next(iter(candidates))]=p['id']
rows={};coverage=collections.Counter()
for mid,d in matches:
 year=int(d['info']['season']);coverage[year]+=1;reg=d['info']['registry']['people']
 for inn in d['innings']:
  if inn.get('super_over'):continue
  batting=collections.defaultdict(lambda:[0,0]);bowling=collections.defaultdict(lambda:[0,0,0])
  for over in inn['overs']:
   for b in over['deliveries']:
    ex=b.get('extras',{});batting[b['batter']][0]+=b['runs']['batter'];batting[b['batter']][1]+=not ex.get('wides')
    w=bowling[b['bowler']];w[0]+=b['runs']['total']-ex.get('byes',0)-ex.get('legbyes',0)-ex.get('penalty',0);w[1]+=not(ex.get('wides')or ex.get('noballs'))
    w[2]+=sum(x['kind']not in ['run out','retired hurt','retired out','obstructing the field','retired not out']for x in b.get('wickets',[]))
  for kind,values in [('batting',batting),('bowling',bowling)]:
   for name,v in values.items():
    pid=ids.get(reg.get(name))
    if not pid or not v[1]:continue
    row=rows.setdefault((pid,year),dict(playerId=pid,year=year,battingInnings=0,battingSuccess=0,bowlingInnings=0,bowlingSuccess=0))
    row[kind+'Innings']+=1
    # Count useful contributions, including short finishing cameos and wicket-taking spells.
    success=(v[0]>=20 or v[0]>=10 and v[0]/v[1]>=1.5)if kind=='batting'else(v[2]>=2 or v[1]>=12 and v[0]*6/v[1]<=8.5)
    row[kind+'Success']+=int(success)
result=dict(source='https://cricsheet.org/downloads/',licence='ODC-BY-1.0',archiveSha256=hashlib.sha256(Path(args.archive).read_bytes()).hexdigest(),coverage=dict(coverage),records=list(rows.values()),method='Available regular innings only; frequency of model-defined useful contributions, not an official consistency metric.')
(root/'prisma/data/ipl-rating-consistency.json').write_text(json.dumps(result,indent=2)+'\n');print('Consistency rows:',len(rows),'matches:',dict(sorted(coverage.items())))
