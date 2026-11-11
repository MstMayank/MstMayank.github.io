"""Reproduce 2021–23 archive aggregates; preserve checked official 2024–26 records."""
import argparse, collections, hashlib, json, re, unicodedata, zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--archive',required=True);args=a.parse_args()
norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).casefold())
ro=json.loads((root/'prisma/data/ipl-2026-reference-squads.json').read_text())
players=[p for t in ro['teams'].values() for p in t['players']]
index=json.loads((root/'player-career-index.json').read_text())['players']
alias={'Sanju Samson':'Sanju Viswanath Samson','Mitch Marsh':'Mitchell Ross Marsh','Mitch Santner':'Mitchell Josef Santner','Matt Short':'Matthew William Short','Zak Foulkes':'Zakary Foulkes','Aman Khan':'Aman Hakim Khan','Raj Bawa':'Raj Angad Bawa','Mohammad Shami':'Mohammed Shami','AM Ghazanfar':'Allah Mohammad Ghazanfar'}
alias.update(json.loads((root/'prisma/data/ipl-player-name-aliases.json').read_text())['aliases'])
byname=collections.defaultdict(set)
for p in index:
 if p[0].startswith('cs:') and 'IPL' in p[5] and p[3]=='male':
  for n in [p[1],*p[4]]:byname[norm(n)].add(p[0][3:])
  parts=p[1].split()
  if len(parts)>2 and len(parts[0])>1:byname[norm(parts[0]+' '+parts[-1])].add(p[0][3:])
z=zipfile.ZipFile(args.archive);matches=[];names=collections.defaultdict(set)
for n in z.namelist():
 if not n.endswith('.json'):continue
 d=json.loads(z.read(n))
 if str(d['info']['season']) not in ['2021','2022','2023']:continue
 matches.append((Path(n).stem,d))
 for name,ident in d['info']['registry']['people'].items():names[norm(name)].add(ident)
identity={};unmapped=[]
for p in players:
 candidates=set()
 for n in [p['name'],alias.get(p['name'],'')]:candidates.update(byname[norm(n)]);candidates.update(names[norm(n)])
 if len(candidates)==1:identity[next(iter(candidates))]=p['id']
 else:unmapped.append({'playerId':p['id'],'name':p['name'],'reason':'No unique exact alias identity'})
rows={};coverage={str(y):{'matches':0,'source':'https://cricsheet.org/downloads/ipl_json.zip','licence':'ODC-BY-1.0'} for y in [2021,2022,2023]}
for mid,d in matches:
 info=d['info'];year=int(info['season']);coverage[str(year)]['matches']+=1;reg=info['registry']['people']
 def row(name):
  pid=identity.get(reg.get(name));
  if not pid:return None
  return rows.setdefault((pid,year),dict(playerId=pid,year=year,matches=0,audit=dict(runs=0,balls=0,outs=0,wickets=0,conceded=0,legalBalls=0,battingInnings=0,bowlingInnings=0,fours=0,sixes=0),sourceMatches=[]))
 for team in info['players'].values():
  for name in team:
   r=row(name)
   if r is not None:r['matches']+=1;r['sourceMatches'].append('https://cricsheet.org/downloads/ipl_json.zip#match='+mid)
 for inn in d['innings']:
  if inn.get('super_over'):continue
  bats=set();bowls=set()
  for over in inn['overs']:
   for ball in over['deliveries']:
    assert ball['runs']['batter']+ball['runs']['extras']==ball['runs']['total']
    ex=ball.get('extras',{});b=row(ball['batter']);w=row(ball['bowler'])
    bats.add(ball['batter']);bowls.add(ball['bowler'])
    if b is not None:
     q=b['audit'];q['runs']+=ball['runs']['batter'];q['balls']+=int(not ex.get('wides'));q['fours']+=int(ball['runs']['batter']==4);q['sixes']+=int(ball['runs']['batter']==6)
    if w is not None:
     q=w['audit'];q['legalBalls']+=int(not(ex.get('wides')or ex.get('noballs')));q['conceded']+=ball['runs']['total']-ex.get('byes',0)-ex.get('legbyes',0)-ex.get('penalty',0)
    for wicket in ball.get('wickets',[]):
     out=row(wicket['player_out'])
     if out is not None and wicket['kind'] not in ['retired hurt','obstructing the field','retired not out']:out['audit']['outs']+=1
     if w is not None and wicket['kind'] not in ['run out','retired hurt','obstructing the field','retired out','retired not out']:w['audit']['wickets']+=1
  for nameset,key in [(bats,'battingInnings'),(bowls,'bowlingInnings')]:
   for name in nameset:
    r=row(name)
    if r is not None:r['audit'][key]+=1
from decimal import Decimal,ROUND_HALF_UP
def rate(n,d):return str((Decimal(n)/Decimal(d)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)) if d else None
for r in rows.values():
 q=r['audit'];r.update(runs=q['runs'],wickets=q['wickets'],battingAverage=rate(q['runs'],q['outs']),strikeRate=rate(q['runs']*100,q['balls']),bowlingAverage=rate(q['conceded'],q['wickets']),economy=rate(q['conceded']*6,q['legalBalls']),provider='Cricsheet',sourceUrl='https://cricsheet.org/downloads/',licence='ODC-BY-1.0')
official=json.loads((root/'prisma/data/ipl-official-season-stats.json').read_text())
records=list(rows.values())+[{**r,'provider':'Official IPL scorecards','sourceUrl':f"https://www.iplt20.com/matches?season={r['year']}&status=results"} for r in official['records']]
result=dict(archiveSha256=hashlib.sha256(Path(args.archive).read_bytes()).hexdigest(),updatedAt='2026-11-11',window=[2021,2022,2023,2024,2025,2026],coverage={**coverage,**official['coverage']},records=sorted(records,key=lambda r:(r['playerId'],r['year'])),unmapped=unmapped)
(root/'prisma/data/ipl-six-season-stats.json').write_text(json.dumps(result,indent=2)+'\n')
print('Rows:',len(records),'archive matches:',{y:c['matches'] for y,c in coverage.items()},'unmapped roster names:',len(unmapped))
for name,year in [('Ruturaj Gaikwad',2021),('Harshal Patel',2021),('Jos Buttler',2022),('Yuzvendra Chahal',2022),('Shubman Gill',2023),('Mohammad Shami',2023)]:
 p=next((p for p in players if p['name']==name),None);r=rows.get((p['id'],year)) if p else None;print(name,year, (r['runs'],r['wickets']) if r else 'UNMAPPED')
