(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const result = byId('battle-result');
  const status = byId('battle-status');
  const inputs = [byId('battle-first'), byId('battle-second')];
  const suggestions = [byId('battle-first-results'), byId('battle-second-results')];
  const selected = [null, null];
  const number = value => Number(value).toLocaleString('en-IN');
  const metricKeys = ['runs', 'balls', 'dots', 'fours', 'sixes', 'wickets', 'conceded', 'legal', 'wides', 'noBalls', 'bowlingDots', 'outs'];
  let competition = new URLSearchParams(location.search).get('competition') || 'ipl';
  if (!['ipl', 'wpl', 'international'].includes(competition)) competition = 'ipl';
  let mode = 'direct';
  let view = new URLSearchParams(location.search).get('view')==='careers' || (competition==='international' && !new URLSearchParams(location.search).has('first')) ? 'careers' : 'matchups';
  let detailKey = '';
  let data = null;
  let careerRecords = null;
  let careerScope = 'career';
  let archiveStatus='';
  let archiveMethod='';
  let cardTables = [];
  let restoreLink = true;
  const initialLink = new URLSearchParams(location.search);
  let availablePlayers = [[], []];
  let loadingController = null;
  let requestNumber = 0;

  function emptyStats() {
    return Object.fromEntries(metricKeys.map(key => [key, 0]));
  }

  function addStats(stats, row) {
    metricKeys.forEach((key, index) => { stats[key] += row[index + 4]; });
  }

  function divide(numerator, denominator, multiplier = 1) {
    return denominator ? (numerator * multiplier / denominator).toFixed(2) : '—';
  }

  function overs(legalBalls) {
    return Math.floor(legalBalls / 6) + '.' + legalBalls % 6;
  }

  function groups(format = data.format) {
    if (format === 'Test') return ['Match innings 1', 'Match innings 2', 'Match innings 3', 'Match innings 4'];
    if (format === 'ODI') return ['Powerplay · Overs 1–10', 'Middle · Overs 11–40', 'Death · Overs 41–50'];
    return ['Powerplay · Overs 1–6', 'Middle · Overs 7–15', 'Death · Overs 16–20'];
  }

  function setExpanded(index, expanded) {
    suggestions[index].hidden = !expanded;
    inputs[index].setAttribute('aria-expanded', String(expanded));
  }

  function clearSelections() {
    selected.fill(null);
    inputs.forEach((input, index) => {
      input.value = '';
      setExpanded(index, false);
    });
    result.replaceChildren();
    cardTables = [];
    byId('battle-share-tools').hidden = true;
    byId('battle-card-dialog').hidden = true;
    result.hidden = true;
    byId('battle-detail').replaceChildren();
    byId('battle-detail').hidden = true;
    document.querySelector('.battle-workspace').classList.remove('has-detail');
    detailKey = '';
  }

const venueAliases = [
  "Rajiv Gandhi International Stadium",
  "Narendra Modi Stadium|Sardar Patel Stadium",
  "Maharashtra Cricket Association Stadium",
  "M Chinnaswamy Stadium",
  "Wankhede Stadium",
  "Eden Gardens",
  "Arun Jaitley Stadium|Feroz Shah Kotla",
  "Punjab Cricket Association IS Bindra Stadium|Punjab Cricket Association Stadium",
  "MA Chidambaram Stadium",
  "Sawai Mansingh Stadium",
  "Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium",
  "Sheikh Zayed Stadium|Zayed Cricket Stadium",
  "Brabourne Stadium",
  "Dr DY Patil Sports Academy",
  "Himachal Pradesh Cricket Association Stadium",
  "Maharaja Yadavindra Singh International Cricket Stadium",
  "Shaheed Veer Narayan Singh International Stadium"
];
function venueLabel(name) {
  const label = name.split(',')[0].replace(/^M\./, 'M ');
  return venueAliases.find(group => group.split('|').includes(label))?.split('|')[0] ?? name;
}

  function matchIncluded(match) {
    return (!byId('battle-season').value || match[0] === byId('battle-season').value) &&
      (!byId('battle-venue').value || venueLabel(data.venues[match[1]]) === byId('battle-venue').value);
  }

  function updateChoices() {
    if (!data) return;
    const labels = {
      direct: ['Batter', 'Bowler'],
      batters: ['Batter 1', 'Batter 2'],
      bowlers: ['Bowler 1', 'Bowler 2'],
      teams: ['Team 1', 'Team 2']
    }[mode];
    labels.forEach((label, index) => {
      byId(index ? 'battle-second-label' : 'battle-first-label').textContent = label;
      inputs[index].placeholder = 'Search ' + label.toLowerCase();
    });
    if (mode === 'teams') {
      const teams = [...new Set(data.matches.flatMap(match => match[3]))].sort();
      availablePlayers = [teams, teams];
      return;
    }
    availablePlayers = [0, 1].map(index => {
      const bowling = mode === 'bowlers' || (mode === 'direct' && index === 1);
      const column = bowling ? 2 : 1;
      const ids = new Set(data.rows.filter(row => row[bowling ? 11 : 5] > 0).map(row => row[column]));
      return [...ids].sort((a, b) => data.players[a].localeCompare(data.players[b]));
    });
  }

  function nameFor(value) {
    return mode === 'teams' ? value : data.players[value];
  }

  function searchKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function showSuggestions(index) {
    const query = inputs[index].value.trim().toLowerCase();
    if (selected[index] !== null && inputs[index].value !== nameFor(selected[index])) {
      selected[index] = null;
      render();
    }
    suggestions[index].replaceChildren();
    setExpanded(index, Boolean(query && data));
    if (!query || !data) return;
    const candidates = availablePlayers[index].filter(value =>
      (mode === 'direct' || value !== selected[1 - index]) &&
      query.split(/\s+/).every(term => searchKey(nameFor(value)).includes(searchKey(term)))
    ).slice(0, 30);
    for (const value of candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = nameFor(value);
      // Keep input focus until click fires on Safari and touch browsers.
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        selected[index] = value;
        inputs[index].value = nameFor(value);
        setExpanded(index, false);
        render();
      });
      suggestions[index].appendChild(button);
    }
    if (!candidates.length) suggestions[index].textContent = 'No matching names in this dataset.';
  }

  function makeRows(title, labels, rows, choose) {
    if (title) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      result.appendChild(heading);
    }
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    for (const label of labels) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      header.appendChild(cell);
    }
    const body = table.createTBody();
    rows.forEach((values, index) => {
      const row = body.insertRow();
      values.forEach(value => { row.insertCell().textContent = value; });
      if (choose) {
        row.tabIndex = 0;
        row.addEventListener('click', () => {
          body.querySelectorAll('tr').forEach(item => item.classList.toggle('selected', item === row));
          choose(index);
        });
        row.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            row.click();
          }
        });
      }
    });
    wrap.appendChild(table);
    result.appendChild(wrap);
  }

  function rowIncluded(row, format) {
    const match = data.matches[row[0]];
    return (!format || match[7] === format) && matchIncluded(match) &&
      (!byId('battle-phase').value || (format || data.format) === 'Test' || row[3] === +byId('battle-phase').value);
  }

  function addBars(panel, title, entries, suffix) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    panel.appendChild(heading);
    if (!entries.length) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'No recorded events for this selection.';
      panel.appendChild(note);
      return;
    }
    const max = Math.max(1, ...entries.map(entry => entry[1]));
    for (const [label, value, display] of entries) {
      const name = document.createElement('div');
      name.className = 'bar-label';
      const text = document.createElement('span');
      const figure = document.createElement('b');
      text.textContent = label;
      figure.textContent = display ?? (suffix ? value.toFixed(2) + suffix : number(value));
      name.append(text, figure);
      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = value / max * 100 + '%';
      track.appendChild(fill);
      panel.append(name, track);
    }
  }

  function showDetail(format, id, rows, bowling, fielding = false) {
    const detail = byId('battle-detail');
    detail.replaceChildren();
    detail.hidden = false;
    document.querySelector('.battle-workspace').classList.add('has-detail');
    detailKey = String(id) + ':' + format;
    const panel = document.createElement('section');
    panel.className = 'panel';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'UNDER THE LENS';
    const name = document.createElement('h2');
    name.textContent = data.players[id];
    if(competition==='international'){const coverage=document.createElement('p');coverage.className='battle-coverage-warning';coverage.textContent='Archive analysis only. Phase charts, splits and matchups exclude matches absent from our ball-by-ball archive.';panel.appendChild(coverage);}
    const summary = document.createElement('p');
    summary.className = 'hint';
    const totals = emptyStats();
    rows.forEach(row => addStats(totals, row));
    summary.textContent = (format ? format + ' · ' : '') +
      (fielding ? 'Recorded successful fielding events' : number(bowling ? totals.legal : totals.balls) + (bowling ? ' legal balls bowled' : ' balls faced') +
      ' · ' + new Set(rows.map(row => row[0])).size + ' matches' + (view === 'matchups' && mode === 'direct' ? ' vs ' + data.players[selected[1]] : ''));
    panel.append(eyebrow, name, summary);
    const wickets = (data.dismissals || []).filter(wicket => {
      const match = data.matches[wicket[0]];
      return (!format || match[7] === format) && matchIncluded(match) &&
        (!byId('battle-phase').value || (format || data.format) === 'Test' || wicket[4] === +byId('battle-phase').value) &&
        (fielding ? wicket[5].includes(id) || (wicket[3] === 'caught and bowled' && wicket[2] === id) : bowling ? wicket[2] === id && !['run out','retired hurt','retired out','obstructing the field'].includes(wicket[3]) : wicket[1] === id) &&
        (view !== 'matchups' || mode !== 'direct' || wicket[2] === selected[1]);
    });
    if ((format || data.format) !== 'Test') {
      const phases = groups(format || data.format).map((label, phase) => {
        const stats = emptyStats();
        rows.filter(row => row[3] === phase).forEach(row => addStats(stats, row));
        const value = fielding ? wickets.filter(wicket => wicket[4] === phase).length
          : bowling ? (stats.legal ? stats.conceded / stats.legal * 6 : 0)
          : (stats.balls ? stats.runs / stats.balls * 100 : 0);
        return [label, value];
      });
      addBars(panel, 'Performance by phase', phases, fielding ? '' : bowling ? ' econ' : ' SR');
    }
    detail.appendChild(panel);
    const breakdown = document.createElement('section');
    breakdown.className = 'panel';
    const label = document.createElement('div');
    label.className = 'eyebrow';
    label.textContent = 'HOW THE WICKETS FALL';
    breakdown.appendChild(label);
    const counts = new Map();
    wickets.forEach(wicket => counts.set(wicket[3], (counts.get(wicket[3]) || 0) + 1));
    addBars(breakdown, fielding ? 'Fielding events' : 'Dismissal breakdown', [...counts].sort((a,b) => b[1] - a[1]), '');
    detail.appendChild(breakdown);
    if (!bowling && !fielding && view !== 'matchups') appendInsights(detail, format, [id]);
  }

  function renderTeams(format) {
    const counts = [0, 0, 0, 0, 0];
    for (const match of data.matches) {
      if ((format && match[7] !== format) || !matchIncluded(match) || !selected.every(team => match[3].includes(team))) continue;
      const outcome = match[4];
      if (outcome === 'win') counts[selected.indexOf(match[5])] += 1;
      if (outcome === 'no result') counts[2] += 1;
      if (outcome === 'tie') counts[3] += 1;
      if (outcome === 'draw') counts[4] += 1;
    }
    const labels = ['Matches', selected[0] + ' wins', selected[1] + ' wins', 'No result', 'Ties', 'Draws'];
    const values = [counts.reduce((sum, value) => sum + value, 0), ...counts];
    cardTables.push({format:format||data.format,headers:['Team','Wins','Ties','No result','Draws','Matches'],rows:selected.map((team,i)=>[team,counts[i],counts[3],counts[2],counts[4],values[0]])});
    updateShareTools();
    const list = document.createElement('dl');
    labels.forEach((label, index) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = number(values[index]);
      list.append(term, description);
    });
    result.appendChild(list);
    const note = document.createElement('p');
    note.className = 'battle-note';
    note.textContent = 'Super Over and bowl-out matches are counted as ties. Renamed IPL franchises are grouped together.';
    result.appendChild(note);
  }

  function render() {
    result.replaceChildren();
    cardTables = [];
    byId('battle-share-tools').hidden = true;
    byId('battle-card-dialog').hidden = true;
    byId('battle-detail').replaceChildren();
    byId('battle-detail').hidden = true;
    document.querySelector('.battle-workspace').classList.remove('has-detail');
    detailKey = '';
    const profiles=view==='careers';
    byId('career-view-button').hidden=false;
    byId('player-career-shell').hidden=!profiles;
    document.querySelector('.battle-workspace').hidden=profiles;
    document.querySelector('.battle-filters').hidden=profiles;
    for(const id of ['battle-status','battle-method','battle-source'])byId(id).hidden=profiles;
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
    if(profiles){
      byId('battle-title').textContent=competition==='international'?'International Lens':competition.toUpperCase()+' Lens';
      byId('battle-compare-label').hidden=true;byId('battle-career-scope-label').hidden=true;
      window.TCSPlayerCareers.mount(byId('player-career-shell'),competition===(initialLink.get('competition')||'ipl')?initialLink.get('player'):null,competition);
      return;
    }
    const matchup = view === 'matchups';
    const careerAvailable = false;
    byId('battle-career-scope-label').hidden=!careerAvailable;
    byId('battle-career-scope').value=careerScope;
    const careerView=careerAvailable && careerScope==='career';
    const titles = {direct:'Batter vs Bowler',batters:'Batter vs Batter',bowlers:'Bowler vs Bowler',teams:'Team vs Team'};
    byId('battle-panel-title').textContent = matchup ? titles[mode] : {batting:'Batting leaderboard',bowling:'Bowling leaderboard',fielding:'Fielding leaderboard'}[view];
    if(careerView) byId('battle-panel-title').textContent='All-time batting records';
    if(data){
      status.textContent=careerView?'Career records · top 50 per format · verified '+(careerRecords?.verified||'unavailable'):archiveStatus;
      byId('battle-method').textContent=careerView?'Career totals are verified snapshots for the top 50 men’s run-scorers in each format. Career rankings include matches outside the ball-by-ball archive.':archiveMethod;
      byId('battle-hint').textContent=careerView?'Search the verified career leaders, or click a row for career details.':matchup?'Select two players. Click a player name to explore their archived performance.':'Click a player name to explore their archived performance.';
      const source=byId('battle-source');source.replaceChildren();const link=document.createElement('a');
      link.href=careerView?'https://www.cricbuzz.com/cricket-stats':'https://cricsheet.org/';link.textContent=careerView?'Cricbuzz career records':'Cricsheet ball-by-ball data';link.target='_blank';link.rel='noopener noreferrer';source.append('Source: ',link);
      if(!careerView){const licence=document.createElement('a');licence.href='https://cricsheet.org/licensing/';licence.textContent='ODC Attribution License';source.append(' · ',licence,' · Archive coverage varies; totals may be incomplete.');}
    }
    byId('battle-panel-label').textContent = matchup ? 'MATCHUP EXPLORER' : 'PLAYER EXPLORER';
    byId('battle-players').hidden = !matchup;
    byId('battle-clear').hidden = !matchup;
    byId('battle-compare-label').hidden = !matchup;
    byId('battle-search-label').hidden = matchup;
    byId('battle-phase-label').hidden = matchup && mode === 'teams';
    result.hidden = !data || (matchup && selected.some(value => value === null));
    if (result.hidden) return;
    if(careerView){renderCareerRecords();return;}
    const formats = competition === 'international' ? ['Test','ODI','T20I'] : [null];
    for (const format of formats) {
      if (matchup && mode === 'teams') {
        if (format) {
          const heading = document.createElement('h3');
          heading.textContent = format;
          result.appendChild(heading);
        }
        renderTeams(format);
      } else renderPlayers(format);
    }
  }

  function renderCareerRecords() {
    const notice=document.createElement('p');notice.className='battle-coverage-warning';
    notice.textContent='Full career totals · Top 50 men’s run-scorers per format. Verified '+(careerRecords?.verified||'—')+'. Season, venue and phase filters switch to archived match analysis.';result.appendChild(notice);
    if(!careerRecords){notice.textContent='Career records could not load. Reselect International to retry, or choose Archived match analysis. Partial archive totals are not shown as career records.';return;}
    for(const format of ['Test','ODI','T20I']){
      const source=careerRecords.formats[format];const query=searchKey(byId('battle-search').value);
      const rows=source.map((row,i)=>[i+1,...row]).filter(row=>!query||searchKey(row[1]).includes(query));
      makeRows(format,['Rank','Player','Matches','Innings','Runs','Average'],rows.map(row=>row.map(value=>typeof value==='number'?number(value):value)),index=>{
        const row=rows[index],detail=byId('battle-detail');detail.hidden=false;document.querySelector('.battle-workspace').classList.add('has-detail');detail.replaceChildren();
        const panel=document.createElement('section');panel.className='panel';
        const h=document.createElement('h2');h.textContent=row[1];
        const summary=document.createElement('p');summary.textContent=format+' · Full career: '+number(row[4])+' runs in '+number(row[2])+' matches ('+number(row[3])+' innings), average '+row[5]+'.';
        const note=document.createElement('p');note.className='hint';note.textContent='Verified '+careerRecords.verified+'. Phase and matchup analysis uses a separate, incomplete ball-by-ball archive; it cannot be inferred from career totals.';
        const link=document.createElement('a');link.href=careerRecords.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Career records source ↗';panel.append(h,summary,note,link);detail.appendChild(panel);
      });
      if(!rows.length){const note=document.createElement('p');note.className='hint';note.textContent='No match among the verified top 50 '+format+' run-scorers. Use Archived match analysis to search the ball-by-ball dataset.';result.appendChild(note);}
    }
  }

  function renderBattleBoard(format, headers, rows, choose) {
    const board=document.createElement('section');board.className='duel-board';
    if(format){const heading=document.createElement('h3');heading.textContent=format;board.appendChild(heading);}
    const names=document.createElement('div');names.className='duel-names';
    const ids=mode==='direct'?selected:rows.map(row=>data.players.indexOf(row[0]));
    ids.forEach((id,index)=>{const button=document.createElement('button');button.type='button';button.className='duel-name';
      const small=document.createElement('small');small.textContent=mode==='direct'?(index?'BOWLER':'BATTER'):'PLAYER '+(index+1);
      const name=document.createElement('strong');name.textContent=data.players[id];button.append(small,name);
      button.addEventListener('click',()=>choose(mode==='direct'?0:index));names.appendChild(button);});board.appendChild(names);
    if(mode==='direct'){
      const groups=[
        ['Batter', [['Runs','Runs'],['SR','Strike rate'],['4s','Fours'],['6s','Sixes']]],
        ['Bowler', [['Dismissals','Dismissals'],['Dot %','Dot-ball %']]],
        ['Matchup', [['Balls','Balls faced'],['Average','Batting average']]],
      ];
      const grid=document.createElement('div');
      grid.className='direct-stats';
      for(const [label,metrics] of groups){
        const section=document.createElement('section');
        const heading=document.createElement('h4');
        heading.textContent=label;
        const stats=document.createElement('dl');
        for(const [key,title] of metrics){
          const index=headers.indexOf(key);
          if(index<0)continue;
          const item=document.createElement('div');
          const term=document.createElement('dt');
          term.textContent=title;
          const value=document.createElement('dd');
          value.textContent=rows[0][index];
          item.append(term,value);
          stats.appendChild(item);
        }
        section.append(heading,stats);
        grid.appendChild(section);
      }
      board.appendChild(grid);
      result.appendChild(board);
      return;
    }
    let leads=[0,0],comparable=0;
    headers.slice(1).forEach((label,i)=>{
      const line=document.createElement('div');line.className='duel-row';
      const title=document.createElement('div');title.className='duel-label';title.textContent=label;line.appendChild(title);
      const bars=document.createElement('div');bars.className='duel-bars';
      const values=rows.map(row=>Number(String(row[i+1]).replace(/,/g,'')));
      const valid=rows.length===2&&values.every(Number.isFinite);
      const lower=(mode==='bowlers'&&['Economy','Average','Wides','NB'].includes(label))||(mode!=='bowlers'&&label==='Dot %');
      const neutral=['Balls','Overs'].includes(label);
      let leader=valid&&values[0]!==values[1]&&!neutral?(lower?Number(values[1]<values[0]):Number(values[1]>values[0])):-1;
      if(valid&&!neutral){comparable++;if(leader>=0)leads[leader]++;}
      rows.forEach((row,index)=>{const side=document.createElement('div');side.className='duel-side'+(leader===index?' leads':'');
        const value=document.createElement('strong');value.textContent=row[i+1];
        const track=document.createElement('div');track.className='duel-track';const bar=document.createElement('div');bar.className='duel-bar';
        const max=Math.max(...values.filter(Number.isFinite),1);bar.style.setProperty('--fill',Number.isFinite(values[index])?Math.max(0,values[index]/max*100)+'%':'0%');track.appendChild(bar);side.append(value,track);bars.appendChild(side);});
      line.appendChild(bars);board.appendChild(line);
    });
    const verdict=document.createElement('p');verdict.className='duel-verdict';
    verdict.textContent=rows.length===1?'Batter’s record against this bowler':leads[0]===leads[1]?'Level across the compared metrics':rows[leads[0]>leads[1]?0:1][0]+' leads in '+Math.max(...leads)+' of '+comparable+' metrics';
    board.appendChild(verdict);result.appendChild(board);
  }

  function renderPlayers(format) {
    const matchup = view === 'matchups';
    const bowling = view === 'bowling' || (matchup && mode === 'bowlers');
    const fielding = view === 'fielding';
    if(competition==='international'){
      const scope=document.createElement('p');scope.className='battle-coverage-warning';
      scope.textContent=(format?format+' · ':'')+'Archived ball-by-ball subset — these runs cover available matches only, not complete career totals. Missing matches and early career innings are excluded.';
      result.appendChild(scope);
    }
    const filtered = data.rows.filter(row => rowIncluded(row, format));
    const map = new Map();
    const playerRows = new Map();
    for (const row of filtered) {
      const id = row[bowling ? 2 : 1];
      if (matchup && (mode === 'direct' ? id !== selected[0] || row[2] !== selected[1] : !selected.includes(id))) continue;
      if (!map.has(id)) {
        map.set(id, emptyStats());
        playerRows.set(id, []);
      }
      addStats(map.get(id), row);
      playerRows.get(id).push(row);
    }
    if (fielding) {
      map.clear();
      for (const wicket of data.dismissals || []) {
        const match = data.matches[wicket[0]];
        if ((format && match[7] !== format) || !matchIncluded(match) ||
          (byId('battle-phase').value && (format || data.format) !== 'Test' && wicket[4] !== +byId('battle-phase').value)) continue;
        const fielders = new Set(wicket[5]);
        if (wicket[3] === 'caught and bowled') fielders.add(wicket[2]);
        for (const id of fielders) {
          if (!map.has(id)) map.set(id, {catches:0,runouts:0,stumpings:0});
          const stats = map.get(id);
          if (['caught','caught and bowled'].includes(wicket[3])) stats.catches++;
          if (wicket[3] === 'run out') stats.runouts++;
          if (wicket[3] === 'stumped') stats.stumpings++;
        }
      }
    }
    let entries = [...map].filter(([id]) => !byId('battle-search').value ||
      data.players[id].toLowerCase().includes(byId('battle-search').value.toLowerCase()));
    entries.sort((a,b) => fielding ? b[1].catches - a[1].catches : bowling ? b[1].wickets - a[1].wickets : b[1].runs - a[1].runs);
    if (!entries.length) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = (format ? format + ' · ' : '') + 'No recorded data for this selection.';
      result.appendChild(note);
      return;
    }
    if(matchup && mode!=='direct') entries.sort((a,b)=>selected.indexOf(a[0])-selected.indexOf(b[0]));
    entries = entries.slice(0,150);
    const headers = fielding ? ['Player','Catches','Run-outs','Stumpings']
      : bowling ? ['Player','Wickets','Overs','Economy','Average','Dot %','Wides','NB']
      : ['Player','Runs','Balls','SR','Dot %','4s','6s',...(matchup && mode === 'direct' ? ['Dismissals','Average'] : ['Average'])];
    const rows = entries.map(([id,stats]) => {
      const values = fielding ? [stats.catches,stats.runouts,stats.stumpings]
        : bowling ? [stats.wickets,overs(stats.legal),divide(stats.conceded,stats.legal,6),divide(stats.conceded,stats.wickets),divide(stats.bowlingDots,stats.legal,100),stats.wides,stats.noBalls]
        : [stats.runs,stats.balls,divide(stats.runs,stats.balls,100),divide(stats.dots,stats.balls,100),stats.fours,stats.sixes,...(matchup && mode === 'direct' ? [stats.wickets,divide(stats.runs,stats.wickets)] : [divide(stats.runs,stats.outs)])];
      return [data.players[id], ...values.map(value => typeof value === 'number' ? number(value) : value)];
    });
    if(matchup) renderBattleBoard(format,headers,rows,index=>{
      const id=entries[index][0];showDetail(format,id,playerRows.get(id)||[],bowling,fielding);
    });
    makeRows(format || '', headers, rows, index => {
      const id = entries[index][0];
      showDetail(format,id,playerRows.get(id) || [],bowling,fielding);
    });
    const note = document.createElement('p');
    note.className = 'table-foot';
    note.textContent = matchup ? 'Historical matchup · Small samples may not represent ability.' : map.size + ' players · Showing ' + entries.length;
    result.appendChild(note);
    if (matchup) {
      cardTables.push({format:format || data.format,headers,rows});
      updateShareTools();
      if (!bowling) appendInsights(result,format,entries.map(([id])=>id));
    }
  }

  function appendInsights(parent, format, ids) {
    const block=document.createElement('details');
    block.className='batting-insights'; block.open=true;
    const title=document.createElement('summary'); title.textContent=(format?format+' · ':'')+'Batting insights'; block.appendChild(title);
    if(data.insightsUnavailable){const note=document.createElement('p');note.textContent='Batting insights could not load. Reselect the competition to retry; the main comparison is still available.';block.appendChild(note);parent.appendChild(block);return;}
    const eligible=(data.insights||[]).filter(row=>rowIncluded(row,format) && ids.includes(row[1]) &&
      (view!=='matchups'||mode!=='direct'||row[2]===selected[1]));
    function sum(rows) { const totals=Array(10).fill(0); rows.forEach(row=>totals.forEach((_,i)=>totals[i]+=row[6+i])); return totals; }
    function table(title,headers,rows) {
      const h=document.createElement('h3'); h.textContent=title; block.appendChild(h);
      const wrap=document.createElement('div');wrap.className='table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label',title+'; scroll horizontally for more columns');
      const t=document.createElement('table'); const head=t.createTHead().insertRow();headers.forEach(label=>{const th=document.createElement('th');th.scope='col';th.textContent=label;head.appendChild(th);});
      const body=t.createTBody(); rows.forEach(values=>{const tr=body.insertRow();values.forEach(value=>tr.insertCell().textContent=value);});wrap.appendChild(t);block.appendChild(wrap);
      const mobile=document.createElement('div');mobile.className='insight-mobile';
      for(const values of rows){
        const card=document.createElement('dl');
        values.forEach((value,index)=>{
          const metric=document.createElement('div'), label=document.createElement('dt'), number=document.createElement('dd');
          label.textContent=headers[index];number.textContent=value;
          metric.append(label,number);card.appendChild(metric);
        });
        mobile.appendChild(card);
      }
      block.appendChild(mobile);
    }
    if((format||data.format)!=='Test') {
      const rows=[];
      for(const id of ids) for(const [order,label] of [[1,'Bat first'],[2,'Chase']]) {
        const filtered=eligible.filter(r=>r[1]===id&&r[4]===order);const a=sum(filtered);
        rows.push([data.players[id],label,new Set(filtered.map(r=>r[0]+':'+r[4])).size,number(a[0]),number(a[1]),divide(a[0],a[1],100),divide(a[0],view==='matchups'&&mode==='direct'?a[9]:a[8])]);
      }
      table('Chase vs Bat First',['Player','Situation','Innings','Runs','Balls','SR','Average'],rows);
    }
    const windows=[];
    for(const id of ids) for(const [mask,label] of [[1,'First 10'],[2,'Last 10']]) {
      const filtered=eligible.filter(r=>r[1]===id&&(r[5]&mask));const a=sum(filtered);
      windows.push([data.players[id],label,number(a[0]),number(a[1]),divide(a[0],a[1],100),divide(a[2],a[1],100)]);
    }
    table('First 10 vs Last 10 Balls',['Player','Window','Runs','Balls','SR','Dot %'],windows);
    const scoring=ids.map(id=>{const a=sum(eligible.filter(r=>r[1]===id));return [data.players[id],number(a[0]),number(a[3]),divide(a[3],a[0],100),number(a[4]+a[5]+a[6]),number(a[4]),number(a[5]),number(a[6]),number(a[7])];});
    table('Boundary vs Rotation',['Player','Runs','Boundary runs','Boundary %','Rotation runs','Singles runs','Doubles runs','Triples runs','Other runs'],scoring);
    const note=document.createElement('p');note.className='hint';note.textContent='First/last 10 are each batter’s first/last 10 balls faced in each innings, including not-outs. Wides excluded; no-balls included. Short innings can overlap. Windows are fixed before bowler/phase filters. Rotation = runs from 1s, 2s and 3s; extras excluded. Splits follow the selected filters.';
    if((format||data.format)==='Test')note.textContent+=' Chase vs Bat First is shown only for limited-overs formats.';
    block.appendChild(note);parent.appendChild(block);
  }

  function updateShareTools() {
    const tools=byId('battle-share-tools');tools.hidden=!cardTables.length;
    const select=byId('battle-card-format'); const previous=select.value;
    byId('battle-card-format-field').hidden=competition!=='international'||cardTables.length<2;
    select.replaceChildren(...cardTables.map((table,i)=>new Option(table.format,String(i))));
    if([...select.options].some(o=>o.value===previous))select.value=previous;
    byId('battle-share-status').textContent='';
  }
  let cardBlob=null,cardObjectURL='';
  let cardRender=0;
  const portraitCache=new Map();
  const portraitTitles={
    'DW Steyn':'Dale Steyn', 'MS Dhoni':'MS Dhoni', 'JJ Bumrah':'Jasprit Bumrah', 'V Kohli':'Virat Kohli',
    'RG Sharma':'Rohit Sharma', 'SK Raina':'Suresh Raina', 'AB de Villiers':'AB de Villiers',
    'SR Tendulkar':'Sachin Tendulkar', 'H Kaur':'Harmanpreet Kaur', 'S Mandhana':'Smriti Mandhana',
    'EA Perry':'Ellyse Perry', 'MM Lanning':'Meg Lanning', 'SFM Devine':'Sophie Devine',
  };

  const verifiedPortraits = {
    'Dale Steyn': ['d/d0/Dale_Steyn.jpg', 'Warren Rohner · CC BY-SA 2.0'],
    'MS Dhoni': ['c/c9/MS_Dhoni.jpg', 'Blnguyen · CC BY-SA 3.0'],
    'Jasprit Bumrah': ['a/ac/Jasprit_Bumrah.jpg', 'CRICKETNEXT · CC BY 3.0'],
  };

  async function loadPortrait(name) {
    const title=portraitTitles[name]||name;
    if(portraitCache.has(title))return portraitCache.get(title);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),3500);
    let imageUrl;
    try {
      const known = verifiedPortraits[title];
      let source;
      if (known) {
        source = new URL('https://upload.wikimedia.org/wikipedia/commons/' + known[0]);
      } else {
      const query=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',
        titles:title,redirects:'1',prop:'pageimages|pageterms',wbptterms:'description',
        pithumbsize:'320',pilicense:'free'});
      const response=await fetch('https://en.wikipedia.org/w/api.php?'+query,{signal:controller.signal});
      if(!response.ok)return null;
      const [page]= (await response.json()).query?.pages||[];
      if(!page?.thumbnail?.source||!page.terms?.description?.some(description=>/cricket/i.test(description)))return null;
      source=new URL(page.thumbnail.source);
      }
      if(source.origin!=='https://upload.wikimedia.org'||!source.pathname.startsWith('/wikipedia/commons/'))return null;
      const photo=await fetch(source,{signal:controller.signal});
      if(!photo.ok)return null;
      imageUrl=URL.createObjectURL(await photo.blob());
      const image=new Image();
      image.src=imageUrl;
      await image.decode();
      image.credit = known ? title + ' · ' + known[1] + ' · Wikimedia Commons · cropped' : title + ' · Wikimedia Commons · cropped';
      portraitCache.set(title,image);
      return image;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
      if(imageUrl)URL.revokeObjectURL(imageUrl);
    }
  }

  async function drawBattleCard() {
    const render=++cardRender;
    byId('battle-card-feedback').textContent='';
    try {
    const table=cardTables[+byId('battle-card-format').value||0]; if(!table)return;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const c=canvas.getContext('2d');if(!c)throw new Error('Canvas unavailable');c.fillStyle='#07241A';c.fillRect(0,0,1080,1920);
    const background=c.createLinearGradient(0,0,1080,1920);
    background.addColorStop(0,'#0c3628');
    background.addColorStop(.55,'#09241c');
    background.addColorStop(1,'#071510');
    c.fillStyle=background;c.fillRect(0,0,1080,1920);
    function panel(x,y,w,h,r,fill,stroke){
      c.beginPath();
      c.moveTo(x+r,y);
      c.arcTo(x+w,y,x+w,y+h,r);
      c.arcTo(x+w,y+h,x,y+h,r);
      c.arcTo(x,y+h,x,y,r);
      c.arcTo(x,y,x+w,y,r);
      c.closePath();
      c.fillStyle=fill;c.fill();
      c.strokeStyle=stroke;c.lineWidth=2;c.stroke();
    }
    function text(value,x,y,size=30,color='#F2F5EF',weight=600){c.font=weight+' '+size+'px Arial, sans-serif';c.fillStyle=color;c.fillText(String(value),x,y);}
    function wrap(value,x,y,maxWidth,size=40){c.font='700 '+size+'px Arial, sans-serif';let line='';for(const word of value.split(' ')){if(c.measureText(line+word).width>maxWidth&&line){text(line,x,y,size);line='';y+=size*1.25;}line+=word+' ';}text(line,x,y,size);return y+size*1.25;}
    text('tcs. / THE CRICKET SPACE',82,115,30,'#F6C453');
    panel(675,75,325,60,30,'#e8c468','#e8c468');
    c.textAlign='center';
    text((competition==='international'?'INTERNATIONAL':competition.toUpperCase())+' · '+table.format,837,114,24,'#23190b');
    const gold=c.createLinearGradient(150,0,930,0);
    gold.addColorStop(0,'#fff3c9');gold.addColorStop(.52,'#e8c468');gold.addColorStop(1,'#ba8839');
    text('PLAYER BATTLE',540,237,92,gold,900);
    c.textAlign='left';
    const names=inputs.map(input=>input.value);
    const roles=mode==='direct'?['BATTER','BOWLER']:mode==='bowlers'?['BOWLER','BOWLER']:mode==='teams'?['TEAM','TEAM']:['BATTER','BATTER'];
    const photos=mode==='teams'?[]:await Promise.all(names.map(loadPortrait));
    if(render!==cardRender)return;
    c.textAlign='center';
    names.forEach((name,index)=>{
      const x=index===0?310:770;
      const portrait=photos[index];
      c.save();
      c.beginPath();
      c.arc(x,390,94,0,2*Math.PI);
      c.fillStyle='#245640';
      c.fill();
      c.clip();
      if(portrait){
        const size=Math.min(portrait.naturalWidth,portrait.naturalHeight);
        c.drawImage(portrait,(portrait.naturalWidth-size)/2,(portrait.naturalHeight-size)/2,size,size,x-94,296,188,188);
      }else{
        text(name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(),x,410,58);
      }
      c.restore();
      c.strokeStyle=index===0?'#F6C453':'#f87670';
      c.lineWidth=7;c.stroke();
      c.font='700 38px Arial, sans-serif';
      c.fillStyle='#F2F5EF';
      c.fillText(name,x,537,420);
      text(roles[index],x,578,24,'#F6C453');
    });
    panel(492,342,96,96,48,'#0a1812','#56725f');
    text('VS',540,405,42,'#F6C453');
    c.textAlign='left';
    const context=[
      (byId('battle-season').value||'All seasons')+' · '+(byId('battle-phase').selectedOptions[0]?.textContent||'All overs'),
      byId('battle-venue').value||'All venues',
    ];
    context.forEach((label,index)=>{
      const x=82+index*468;
      c.font='600 24px Arial, sans-serif';
      panel(x,615,Math.min(444,c.measureText(label).width+44),50,25,'#18362a','#466456');
      c.fillStyle='#d3ddd6';c.fillText(label,x+22,648,400);
    });
    const y=732;
    const rows=table.rows.slice(0,2);const columns=rows.length===2?2:1;const columnWidth=916/columns;
    rows.forEach((row,index)=>{
      if(rows.length===1){
        text(row[0].toUpperCase(),82,y,31,'#F6C453');
        c.fillStyle='#68583b';c.fillRect(82,y+15,912,2);
        table.headers.slice(1).forEach((label,i)=>{
          const x=82+(i%2)*470, yy=y+45+Math.floor(i/2)*185;
          const hero=i<2;
          panel(x,yy,442,166,30,hero?'#393927':i===6?'#302421':'#172d23',hero?'#8b743e':'#365147');
          text(label.toUpperCase(),x+24,yy+42,25,'#b7ccba');
          text(row[i+1],x+24,yy+113,hero?68:57,hero?'#f6c453':i===6?'#ff938c':'#f2f5ef');
          const value=Number(String(row[i+1]).replace(/,/g,''));
          if(!Number.isFinite(value))return;
          if(i>=4&&i<=6){
            const color=['#4bd890','#f6c453','#f87670'][i-4];
            for(let mark=0;mark<Math.min(value,16);mark++){
              panel(x+24+mark*19,yy+132,i===6?7:12,i===6?16:12,i===5?6:2,color,color);
            }
          }else{
            const scale=[100,100,200,100,0,0,0,50][i];
            if(!scale)return;
            c.fillStyle='#405044';c.fillRect(x+24,yy+137,394,5);
            c.fillStyle=gold;c.fillRect(x+24,yy+137,394*Math.min(1,Math.max(0,value/scale)),5);
          }
        });
      }else{
        const x=82+index*columnWidth;
        let yy=wrap(row[0],x,y,columnWidth-28,34)+12;
        for(let i=1;i<table.headers.length;i++){
          panel(x,yy-24,columnWidth-24,74,12,'#123529','#315b44');
          text(table.headers[i].toUpperCase(),x+16,yy+2,22,'#B7CCBA');
          text(row[i],x+16,yy+36,32,i===1?'#F6C453':'#F2F5EF');yy+=81;
        }
      }
    });
    text('Archived matches only · not full career totals',82,1665,24,'#B7CCBA');
    text('Cricsheet · ODC Attribution License',82,1705,24,'#B7CCBA');
    text('mstmayank.github.io/player-battle.html',82,1755,28,'#F6C453');
    photos.filter(Boolean).forEach((photo,index)=>text(photo.credit,82,1810+index*34,21,'#B7CCBA'));
    canvas.toBlob(blob=>{
      if(render!==cardRender)return;
      if(!blob){byId('battle-share-status').textContent='Card could not be generated.';return;}
      cardBlob=blob;if(cardObjectURL)URL.revokeObjectURL(cardObjectURL);cardObjectURL=URL.createObjectURL(blob);
      byId('battle-card-image').src=cardObjectURL;byId('battle-card-download').href=cardObjectURL;
      byId('battle-card-open').href=cardObjectURL;
      const dialog=byId('battle-card-dialog');
      if(dialog.hidden){dialog.hidden=false;byId('battle-card-close').focus();}
    },'image/png');
    }catch(error){byId('battle-share-status').textContent='Image preview is unavailable in this browser.';}
  }
  byId('battle-card-format').addEventListener('change',()=>{cardBlob=null;byId('battle-card-dialog').hidden=true;});
  byId('battle-card-dialog').addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const items=[...byId('battle-card-dialog').querySelectorAll('button,a[href],input')];
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  byId('battle-card-preview').addEventListener('click',drawBattleCard);
  byId('battle-card-close').addEventListener('click',()=>{cardRender++;byId('battle-card-dialog').hidden=true;byId('battle-card-preview').focus();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')byId('battle-card-dialog').hidden=true;});
  byId('battle-card-native').addEventListener('click',()=>{
    if(!cardBlob){byId('battle-card-feedback').textContent='Generate a battle card first.';return;}
    const fallback=()=>{byId('battle-card-feedback').textContent='Save with Download PNG or Open image, then upload it in Instagram/WhatsApp.';};
    try{
      if(typeof navigator.share!=='function'||typeof File!=='function'){fallback();return;}
      const file=new File([cardBlob],'thecricketspace-battle.png',{type:'image/png'});
      const payload={files:[file]};
      if(typeof navigator.canShare==='function'&&!navigator.canShare(payload)){fallback();return;}
      // No async work before share(): Safari requires the original tap activation.
      // File-only payload avoids mobile targets rejecting image + URL combinations.
      const promise=navigator.share(payload);
      if(promise?.catch)promise.catch(error=>{if(error.name==='AbortError')byId('battle-card-feedback').textContent='Sharing cancelled. You can try again or save the image.';else fallback();});
    }catch(error){fallback();}
  });

  function combineFormats(datasets) {
    const combined = { players: [], venues: [], matches: [], rows: [], insights: [], dismissals: [], format: 'International' };
    const playerIds = new Map();
    const venueIds = new Map();
    combined.insightsUnavailable=datasets.some(dataset=>dataset.insightsUnavailable);
    for (const dataset of datasets) {
      const players = dataset.players.map(name => {
        if (!playerIds.has(name)) {
          playerIds.set(name, combined.players.length);
          combined.players.push(name);
        }
        return playerIds.get(name);
      });
      const venues = dataset.venues.map(name => {
        if (!venueIds.has(name)) {
          venueIds.set(name, combined.venues.length);
          combined.venues.push(name);
        }
        return venueIds.get(name);
      });
      const matchOffset = combined.matches.length;
      const format = dataset.format === 'T20' ? 'T20I' : dataset.format;
      for (const match of dataset.matches) {
        const merged = match.slice();
        merged[1] = venues[match[1]];
        merged[7] = format;
        combined.matches.push(merged);
      }
      for (const wicket of dataset.dismissals || []) {
        const merged = wicket.slice();
        merged[0] += matchOffset;
        merged[1] = players[wicket[1]];
        merged[2] = players[wicket[2]];
        merged[5] = wicket[5].map(id => players[id]);
        combined.dismissals.push(merged);
      }
      for (const row of dataset.insights || []) {
        const merged = row.slice();
        merged[0] += matchOffset;
        merged[1] = players[row[1]];
        merged[2] = players[row[2]];
        combined.insights.push(merged);
      }
      for (const row of dataset.rows) {
        const merged = row.slice();
        merged[0] += matchOffset;
        merged[1] = players[row[1]];
        merged[2] = players[row[2]];
        combined.rows.push(merged);
      }
    }
    return combined;
  }

  async function loadData(forceArchive=false) {
    const current = ++requestNumber;
    if (loadingController) loadingController.abort();
    loadingController = new AbortController();
    data = null;
    byId('battle-phase').value = '';
    byId('battle-search').value = '';
    clearSelections();
    inputs.forEach(input => { input.disabled = true; });
    const international = competition === 'international';
    byId('career-view-button').hidden=false;
    if(view==='careers' && !forceArchive){
      document.querySelectorAll('[data-competition]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.competition===competition)));
      render();return;
    }
    byId('battle-title').textContent = international ? 'International Lens' : competition.toUpperCase() + ' Lens';
    byId('gender-field').hidden = !international;
    document.querySelectorAll('[data-competition]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.competition === competition));
    });
    byId('battle-season').replaceChildren(new Option('All seasons', ''));
    byId('battle-venue').replaceChildren(new Option('All venues', ''));
    status.textContent = 'Loading ' + (international ? 'international' : competition.toUpperCase()) + ' match data…';
    const keys = international
      ? ['tests', 'odis', 't20s'].map(format => format + '_' + byId('battle-gender').value)
      : [competition];
    try {
      const careerPromise=international && byId('battle-gender').value==='male'
        ? fetch('career-batting-records.json',{signal:loadingController.signal}).then(response=>response.ok?response.json():null).catch(()=>null)
        : Promise.resolve(null);
      const datasets = await Promise.all(keys.map(async key => {
        const response = await fetch('battle-' + key + '.json', { signal: loadingController.signal });
        if (!response.ok) throw new Error('Dataset download failed');
        const dataset = await response.json();
        try {
          const insights = await fetch('battle-insights-' + key + '.json', {signal:loadingController.signal});
          if (!insights.ok) throw new Error('Batting insights download failed');
          dataset.insights = (await insights.json()).rows;
        } catch(error) {
          if(error.name==='AbortError') throw error;
          dataset.insightsUnavailable = true;
        }
        return dataset;
      }));
      if (current !== requestNumber) return;
      data = international ? combineFormats(datasets) : datasets[0];
      careerRecords=await careerPromise;
      if(current!==requestNumber)return;
      const seasons = [...new Set(data.matches.map(match => match[0]))].sort().reverse();
      seasons.forEach(season => { byId('battle-season').add(new Option(season, season)); });
      [...new Set(data.venues.map(venueLabel))].sort().forEach(venue => { byId('battle-venue').add(new Option(venue, venue)); });
      const dates = data.matches.map(match => match[2]).sort();
      status.textContent = number(data.matches.length) + ' archived matches · ' + dates[0] + ' to ' + dates[dates.length - 1];
      archiveStatus=status.textContent;
      byId('battle-method').textContent = international
        ? 'Results are grouped by Test, ODI and T20I. Click a player row for phase charts and dismissal breakdown. Regular innings only. — means no dismissals, wickets or balls to calculate the rate.'
        : data.format === 'Test'
        ? 'Test comparisons show overall figures. Average is runs per dismissal or runs conceded per wicket. — means no dismissals, wickets or balls to calculate the rate.'
        : 'Regular innings only. Phase boundaries use the scheduled over number, including shortened matches. Average is runs per dismissal or runs conceded per wicket. — means no dismissals, wickets or balls to calculate the rate.';
      archiveMethod=byId('battle-method').textContent;
      inputs.forEach(input => { input.disabled = false; });
      if (restoreLink) {
        restoreLink = false;
        const linkedMode = initialLink.get('compare');
        if (['direct','batters','bowlers','teams'].includes(linkedMode)) { mode=linkedMode; byId('battle-compare').value=mode; }
        for (const [param,id] of [['season','battle-season'],['venue','battle-venue'],['phase','battle-phase']]) {
          const value=initialLink.get(param);
          if (value!==null && [...byId(id).options].some(option=>option.value===value)) byId(id).value=value;
        }
        if (initialLink.get('gender')==='female') byId('battle-gender').value='female';
        [0,1].forEach(index=>{const name=initialLink.get(index?'second':'first');const id=mode==='teams'?name:data.players.indexOf(name);if(name && (mode==='teams'?data.matches.some(m=>m[3].includes(name)):id>=0)){selected[index]=id;inputs[index].value=name;}});
      }
      updateChoices();
      render();
    } catch (error) {
      if (current !== requestNumber || error.name === 'AbortError') return;
      status.textContent = 'Match data could not load. Select the competition again to retry.';
    }
  }

  inputs.forEach((input, index) => {
    input.addEventListener('input', () => showSuggestions(index));
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') setExpanded(index, false);
      if (event.key === 'ArrowDown' && !suggestions[index].hidden) {
        const button = suggestions[index].querySelector('button');
        if (button) {
          event.preventDefault();
          button.focus();
        }
      }
    });
  });
  document.addEventListener('click', event => {
    inputs.forEach((input, index) => {
      if (!input.closest('.battle-picker').contains(event.target)) setExpanded(index, false);
    });
  });
  document.querySelectorAll('[data-competition]').forEach(button => button.addEventListener('click', () => {
    competition = button.dataset.competition;
    view=competition==='international'?'careers':view;
    loadData();
  }));
  byId('battle-compare').addEventListener('change', () => {
    mode = byId('battle-compare').value;
    clearSelections();
    updateChoices();
    render();
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active',item === button));
    byId('battle-search').value = '';
    clearSelections();
    if(view!=='careers' && !data){loadData(true);return;}
    updateChoices();
    render();
  }));
  byId('battle-swap').addEventListener('click',()=>{
    if(selected.some(value=>value===null))return;
    selected.reverse();const first=inputs[0].value;inputs[0].value=inputs[1].value;inputs[1].value=first;
    suggestions.forEach((_,index)=>setExpanded(index,false));updateChoices();render();
  });
  byId('battle-search').addEventListener('input', render);
  function filterChanged(){careerScope='archive';render();}
  byId('battle-phase').addEventListener('change', filterChanged);
  byId('battle-reset').addEventListener('click', () => {
    for (const id of ['battle-season','battle-venue','battle-phase','battle-search']) byId(id).value = '';
    clearSelections();
    render();
  });
  byId('battle-gender').addEventListener('change', loadData);
  for (const id of ['battle-season', 'battle-venue']) byId(id).addEventListener('change', filterChanged);
  byId('battle-career-scope').addEventListener('change',()=>{
    careerScope=byId('battle-career-scope').value;
    if(careerScope==='career')for(const id of ['battle-season','battle-venue','battle-phase'])byId(id).value='';
    render();
  });
  byId('battle-clear').addEventListener('click', clearSelections);
  if(initialLink.get('gender')==='female') byId('battle-gender').value='female';
  loadData();
})();
