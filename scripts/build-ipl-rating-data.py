"""IPL-only 2024–26 rating data, quarantined unless official innings totals reconcile."""
import argparse,collections,csv,datetime,hashlib,json,re,unicodedata,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--metadata-csv',required=True);args=p.parse_args()
norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).casefold()).replace('royalchallengersbangalore','royalchallengersbengaluru')
roster=json.loads((ROOT/'prisma/data/ipl-2026-reference-squads.json').read_text());current=[p for t in roster['teams'].values()for p in t['players']]
metadata={r['cricsheet_id']:r for r in csv.DictReader(open(args.metadata_csv))if r['cricsheet_id']}
names=collections.defaultdict(set)
for r in metadata.values():
 for n in [r['name'],r['full_name'],r['unique_name']]:
  if n:names[norm(n)].add(r['cricsheet_id'])
for r in json.loads((ROOT/'player-career-index.json').read_text())['players']:
 if r[0].startswith('cs:')and 'IPL'in r[5]and r[3]=='male':
  for n in [r[1],*r[4]]:names[norm(n)].add(r[0][3:])
  parts=r[1].split()
  if len(parts)>2 and len(parts[0])>1:names[norm(parts[0]+' '+parts[-1])].add(r[0][3:])
alias=json.loads((ROOT/'prisma/data/ipl-player-name-aliases.json').read_text())['aliases'];alias.update({'Sanju Samson':'Sanju Viswanath Samson','Mitch Marsh':'Mitchell Ross Marsh','Mitch Santner':'Mitchell Josef Santner','Matt Short':'Matthew William Short','Aman Khan':'Aman Hakim Khan','Mohammad Shami':'Mohammed Shami'})
z=zipfile.ZipFile(args.archive);raw=[]
for name in z.namelist():
 if not name.endswith('.json'):continue
 d=json.loads(z.read(name));year=str(d['info']['season'])
 if year not in ['2024','2025','2026']:continue
 assert d['info']['event']['name']=='Indian Premier League' and d['info']['match_type']=='T20'
 raw.append((Path(name).stem,d))
 for n,i in d['info']['registry']['people'].items():names[norm(n)].add(i)
cs_to_player={};unmapped=[]
for p in current:
 ids=names[norm(p['name'])]|names[norm(alias.get(p['name'],''))]
 if len(ids)==1:cs_to_player[next(iter(ids))]=p
 else:unmapped.append(p['name'])
def player(cs,name):
 ref=cs_to_player.get(cs);m=metadata.get(cs,{});style=m.get('bowling_style','');profile_role=m.get('playing_role','');role='WICKETKEEPER'if'keeper'in profile_role.lower()else'ALL_ROUNDER'if'allround'in profile_role.lower().replace('-','').replace(' ','')else'BOWLER'if profile_role.lower()=='bowler'else'BATTER'if'batter'in profile_role.lower()else(ref['role']if ref else'BATTER');kind='SPIN' if re.search('break|orthodox|chinaman|spin',style,re.I)else'PACE' if re.search('fast|medium',style,re.I)else'UNKNOWN'
 return dict(id=ref['id']if ref else'cs:'+cs,name=ref['name']if ref else(m.get('name')or m.get('full_name')or name).strip(),rosterRole=ref['role']if ref else('ALL_ROUNDER'if'allround'in m.get('playing_role','').lower()else'WICKETKEEPER'if'keeper'in m.get('playing_role','').lower()else'BOWLER'if m.get('playing_role','').lower()=='bowler'else'BATTER'),playingRole=role,profileRole=profile_role or None,bowlingStyle=kind,styleDescription=style or None,metadataSource='https://www.espncricinfo.com/cricketers/'+re.sub('[^a-z0-9]+','-',(m.get('name')or m.get('full_name')or name).lower()).strip('-')+'-'+m['cricinfo_id']if m.get('cricinfo_id')else(ref['profileUrl']if ref else None),metadataStatus='EXISTING_PROFILE_SNAPSHOT',isOverseas=ref['isOverseas']if ref else None)
def empty():return dict(runs=0,balls=0,outs=0,fours=0,sixes=0,batDots=0,innings=0,contributions=0,legalBalls=0,conceded=0,wickets=0,bowlDots=0,bowlingInnings=0,bowlingContributions=0)
# Only official scorecards that passed the existing independent checks are usable.
official=json.loads((ROOT/'prisma/data/ipl-official-season-stats.json').read_text());index=json.loads((ROOT/'prisma/data/official-scorecards/index.json').read_text());official_by_date=collections.defaultdict(list)
for year,items in index.items():
 valid=set(official['coverage'][year]['matches'])
 for item in items:
  if item['url']not in valid:continue
  match=re.search(r'(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\d{1,2}\s+\w+\s+202[456])',item['summary'])
  if not match:continue
  date=datetime.datetime.strptime(match[1],'%d %b %Y').date().isoformat();d=json.loads((ROOT/'prisma/data/official-scorecards'/ (item['url'].split('/')[4]+'.json')).read_text());official_by_date[date].append(d)
players={};rows={};manifest=[];excluded=[];coverage={str(y):dict(archiveMatches=0,verifiedMatches=0,excludedMatches=0)for y in [2024,2025,2026]}
for mid,d in sorted(raw):
 info=d['info'];year=int(info['season']);date=str(info['dates'][0]);coverage[str(year)]['archiveMatches']+=1
 candidates=[x for x in official_by_date[date]if all(norm(t)in norm(x['summary'])for t in info['teams'])]
 match_rows={};match_players={}
 try:
  assert len(candidates)==1,'No unique independently checked official scorecard'
  off=candidates[0];innings=[i for i in d['innings']if not i.get('super_over')];assert len(innings)==len(off['innings']),'Innings count mismatch'
  for inn in innings:
   bats=sum(b['runs']['batter']for o in inn['overs']for b in o['deliveries']);extras=sum(b['runs']['extras']for o in inn['overs']for b in o['deliveries']);total=sum(b['runs']['total']for o in inn['overs']for b in o['deliveries'])
   assert bats+extras==total,'Batting/extras arithmetic mismatch'
   for o in inn['overs']:
    for b in o['deliveries']:assert b['runs']['batter']+b['runs']['extras']==b['runs']['total'],'Delivery arithmetic mismatch'
   shorts={'DC':'Delhi Capitals','RR':'Rajasthan Royals','KKR':'Kolkata Knight Riders','LSG':'Lucknow Super Giants','RCB':'Royal Challengers Bengaluru','CSK':'Chennai Super Kings','MI':'Mumbai Indians','SRH':'Sunrisers Hyderabad','GT':'Gujarat Titans','PBKS':'Punjab Kings'}
   def team_name(value):
    clean=re.sub(r'\s+(?:Innings|Inns)$','',value).strip();return norm(shorts.get(clean,clean))
   oi=next(x for x in off['innings']if team_name(x['team'])==norm(inn['team']));assert total==int(re.match(r'\d+',oi['total'])[0]),'Official innings total mismatch'
   wickets=sum(w['kind']not in ['retired hurt','retired not out']for o in inn['overs']for b in o['deliveries']for w in b.get('wickets',[]))
   if '/'in oi['total']:assert wickets==int(oi['total'].split('/')[1]),'Official wicket total mismatch'
   balls=sum(not(b.get('extras',{}).get('wides')or b.get('extras',{}).get('noballs'))for o in inn['overs']for b in o['deliveries']);ov=re.match(r'(\d+)\.(\d)',oi['overs']);assert ov and balls==int(ov[1])*6+int(ov[2]),'Official overs mismatch'
  # Match totals were validated before any player figures are added.
  reg=info['registry']['people'];seen=set()
  def row(name):
   cs=reg[name];meta=player(cs,name);pid=meta['id'];match_players[pid]=meta
   r=match_rows.setdefault((pid,year),dict(playerId=pid,year=year,competition='IPL',matches=0,battingPositions={},totals=empty(),phases={k:empty()for k in ['POWERPLAY','MIDDLE','DEATH']},matchIds=[]))
   if pid not in seen:r['matches']+=1;r['matchIds'].append(mid);seen.add(pid)
   return r
  for team in info['players'].values():
   for n in team:row(n)
  for inn in innings:
   positions=[];bats=collections.defaultdict(lambda:[0,0]);bowls=collections.defaultdict(lambda:[0,0,0]);phase_bats=collections.defaultdict(set);phase_bowls=collections.defaultdict(set)
   for o in inn['overs']:
    phase='POWERPLAY'if o['over']<6 else'MIDDLE'if o['over']<15 else'DEATH'
    for b in o['deliveries']:
     for n in [b['batter'],b['non_striker']]:
      if n not in positions:positions.append(n)
     ex=b.get('extras',{});br=row(b['batter']);wr=row(b['bowler']);faced=int(not ex.get('wides'));legal=int(not(ex.get('wides')or ex.get('noballs')));runs=b['runs']['batter'];conceded=b['runs']['total']-ex.get('byes',0)-ex.get('legbyes',0)-ex.get('penalty',0)
     for q in [br['totals'],br['phases'][phase]]:
      q['runs']+=runs;q['balls']+=faced;q['fours']+=runs==4;q['sixes']+=runs==6;q['batDots']+=int(faced and runs==0)
     for q in [wr['totals'],wr['phases'][phase]]:q['legalBalls']+=legal;q['conceded']+=conceded;q['bowlDots']+=int(legal and b['runs']['total']==0)
     bats[b['batter']][0]+=runs;bats[b['batter']][1]+=faced;bowls[b['bowler']][0]+=conceded;bowls[b['bowler']][1]+=legal;phase_bats[phase].add(b['batter']);phase_bowls[phase].add(b['bowler'])
     for w in b.get('wickets',[]):
      if w['kind']not in ['retired hurt','retired not out']:
       out=row(w['player_out']);out['totals']['outs']+=1;out['phases'][phase]['outs']+=1
      if w['kind']not in ['run out','retired hurt','retired out','retired not out','obstructing the field']:
       wr['totals']['wickets']+=1;wr['phases'][phase]['wickets']+=1;bowls[b['bowler']][2]+=1
   for n in positions:
    r=row(n);q=r['totals'];q['innings']+=1;pos=str(positions.index(n)+1);r['battingPositions'][pos]=r['battingPositions'].get(pos,0)+1
    runs,balls=bats[n];q['contributions']+=int(runs>=20 or runs>=10 and balls>0 and runs/balls>=1.5)
   for n,(runs,balls,wkts)in bowls.items():
    q=row(n)['totals'];q['bowlingInnings']+=1;q['bowlingContributions']+=int(wkts>=2 or balls>=12 and runs*6/balls<=8.5)
   for phase,ns in phase_bats.items():
    for n in ns:
     q=row(n)['phases'][phase];q['innings']+=1;q['contributions']+=int(q['runs']>=20 or q['runs']>=10 and q['balls']>0 and q['runs']/q['balls']>=1.5)
   for phase,ns in phase_bowls.items():
    for n in ns:
     q=row(n)['phases'][phase];q['bowlingInnings']+=1;q['bowlingContributions']+=int(q['wickets']>=2 or q['legalBalls']>=12 and q['conceded']*6/q['legalBalls']<=8.5)
  for key,r in match_rows.items():
   if key not in rows:rows[key]=r;continue
   dest=rows[key];dest['matches']+=r['matches'];dest['matchIds']+=r['matchIds']
   for pos,n in r['battingPositions'].items():dest['battingPositions'][pos]=dest['battingPositions'].get(pos,0)+n
   for k,v in r['totals'].items():dest['totals'][k]+=v
   for phase,q in r['phases'].items():
    for k,v in q.items():dest['phases'][phase][k]+=v
  players.update(match_players)
  coverage[str(year)]['verifiedMatches']+=1;manifest.append(dict(id=mid,year=year,date=date,teams=info['teams'],officialUrl=off['url'],archiveUrl='https://cricsheet.org/downloads/ipl_json.zip#match='+mid,status='VERIFIED_TOTALS_AND_BALL_ARITHMETIC'))
 except (AssertionError,ValueError,KeyError,StopIteration,TypeError)as e:
  # Only validation above may fail; aggregation should be deterministic after it.
  coverage[str(year)]['excludedMatches']+=1;excluded.append(dict(id=mid,year=year,date=date,reason=str(e)or type(e).__name__))
for p in current:
 if p['id']not in players:players[p['id']]=dict(id=p['id'],name=p['name'],rosterRole=p['role'],bowlingStyle='UNKNOWN',styleDescription=None,metadataSource=p['profileUrl'],metadataStatus='NO_MAPPED_ARCHIVE_IDENTITY',isOverseas=p['isOverseas'])
completion={2024:('2024-05-26','https://www.iplt20.com/news/article/tata-ipl-2024-final-kkr-vs-srh-match-report'),2025:('2025-06-03','https://www.iplt20.com/news/article/tata-ipl-2025-final-rcb-vs-pbks-match-report'),2026:('2026-05-31','https://www.iplt20.com/news/article/tata-ipl-2026-final-rcb-v-gt-match-report')}
result=dict(version=3,competition='IPL',checkedAt='2026-11-11',archiveSha256=hashlib.sha256(Path(args.archive).read_bytes()).hexdigest(),metadataSha256=hashlib.sha256(Path(args.metadata_csv).read_bytes()).hexdigest(),source='https://cricsheet.org/downloads/',licence='ODC-BY-1.0',seasons=[dict(year=y,completed=True,verified=True,completedOn=completion[y][0],completionSource=completion[y][1],**coverage[str(y)])for y in [2024,2025,2026]],players=list(players.values()),records=list(rows.values()),matches=manifest,excludedMatches=excluded,unmappedRosterNames=unmapped)
(ROOT/'prisma/data/ipl-rating-data.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(dict(coverage=coverage,players=len(players),rows=len(rows),excluded=excluded),indent=2))
