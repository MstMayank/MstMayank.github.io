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
  let view = 'matchups';
  let detailKey = '';
  let data = null;
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
    result.hidden = true;
    byId('battle-detail').replaceChildren();
    byId('battle-detail').hidden = true;
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
      query.split(/\s+/).every(term => nameFor(value).toLowerCase().includes(term))
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
    detailKey = String(id) + ':' + format;
    const panel = document.createElement('section');
    panel.className = 'panel';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'UNDER THE LENS';
    const name = document.createElement('h2');
    name.textContent = data.players[id];
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
    byId('battle-detail').replaceChildren();
    byId('battle-detail').hidden = true;
    detailKey = '';
    const matchup = view === 'matchups';
    const titles = {direct:'Batter vs Bowler',batters:'Batter vs Batter',bowlers:'Bowler vs Bowler',teams:'Team vs Team'};
    byId('battle-panel-title').textContent = matchup ? titles[mode] : {batting:'Batting leaderboard',bowling:'Bowling leaderboard',fielding:'Fielding leaderboard'}[view];
    byId('battle-panel-label').textContent = matchup ? 'MATCHUP EXPLORER' : 'PLAYER EXPLORER';
    byId('battle-players').hidden = !matchup;
    byId('battle-clear').hidden = !matchup;
    byId('battle-compare-label').hidden = !matchup;
    byId('battle-search-label').hidden = matchup;
    byId('battle-phase-label').hidden = matchup && mode === 'teams';
    result.hidden = !data || (matchup && selected.some(value => value === null));
    if (result.hidden) return;
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

  function renderPlayers(format) {
    const matchup = view === 'matchups';
    const bowling = view === 'bowling' || (matchup && mode === 'bowlers');
    const fielding = view === 'fielding';
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
    entries = entries.slice(0,150);
    const headers = fielding ? ['Player','Catches','Run-outs','Stumpings']
      : bowling ? ['Player','Wickets','Overs','Economy','Average','Dot %','Wides','NB']
      : ['Player','Runs','Balls','SR','Dot %','4s','6s',matchup && mode === 'direct' ? 'Dismissals' : 'Average'];
    const rows = entries.map(([id,stats]) => {
      const values = fielding ? [stats.catches,stats.runouts,stats.stumpings]
        : bowling ? [stats.wickets,overs(stats.legal),divide(stats.conceded,stats.legal,6),divide(stats.conceded,stats.wickets),divide(stats.bowlingDots,stats.legal,100),stats.wides,stats.noBalls]
        : [stats.runs,stats.balls,divide(stats.runs,stats.balls,100),divide(stats.dots,stats.balls,100),stats.fours,stats.sixes,matchup && mode === 'direct' ? stats.wickets : divide(stats.runs,stats.outs)];
      return [data.players[id], ...values.map(value => typeof value === 'number' ? number(value) : value)];
    });
    makeRows(format || '', headers, rows, index => {
      const id = entries[index][0];
      showDetail(format,id,playerRows.get(id) || [],bowling,fielding);
    });
    const note = document.createElement('p');
    note.className = 'table-foot';
    note.textContent = matchup ? 'Historical matchup · Small samples may not represent ability.' : map.size + ' players · Showing ' + entries.length;
    result.appendChild(note);
  }

  function combineFormats(datasets) {
    const combined = { players: [], venues: [], matches: [], rows: [], dismissals: [], format: 'International' };
    const playerIds = new Map();
    const venueIds = new Map();
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

  async function loadData() {
    const current = ++requestNumber;
    if (loadingController) loadingController.abort();
    loadingController = new AbortController();
    data = null;
    byId('battle-phase').value = '';
    byId('battle-search').value = '';
    clearSelections();
    inputs.forEach(input => { input.disabled = true; });
    const international = competition === 'international';
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
      const datasets = await Promise.all(keys.map(async key => {
        const response = await fetch('battle-' + key + '.json', { signal: loadingController.signal });
        if (!response.ok) throw new Error('Dataset download failed');
        return response.json();
      }));
      if (current !== requestNumber) return;
      data = international ? combineFormats(datasets) : datasets[0];
      const seasons = [...new Set(data.matches.map(match => match[0]))].sort().reverse();
      seasons.forEach(season => { byId('battle-season').add(new Option(season, season)); });
      [...new Set(data.venues.map(venueLabel))].sort().forEach(venue => { byId('battle-venue').add(new Option(venue, venue)); });
      const dates = data.matches.map(match => match[2]).sort();
      status.textContent = number(data.matches.length) + ' archived matches · ' + dates[0] + ' to ' + dates[dates.length - 1];
      byId('battle-method').textContent = international
        ? 'Results are grouped by Test, ODI and T20I. Click a player row for phase charts and dismissal breakdown. Regular innings only. — means no dismissals, wickets or balls to calculate the rate.'
        : data.format === 'Test'
        ? 'Test comparisons show overall figures. Average is runs per dismissal or runs conceded per wicket. — means no dismissals, wickets or balls to calculate the rate.'
        : 'Regular innings only. Phase boundaries use the scheduled over number, including shortened matches. Average is runs per dismissal or runs conceded per wicket. — means no dismissals, wickets or balls to calculate the rate.';
      inputs.forEach(input => { input.disabled = false; });
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
    updateChoices();
    render();
  }));
  byId('battle-search').addEventListener('input', render);
  byId('battle-phase').addEventListener('change', render);
  byId('battle-reset').addEventListener('click', () => {
    for (const id of ['battle-season','battle-venue','battle-phase','battle-search']) byId(id).value = '';
    clearSelections();
    render();
  });
  byId('battle-gender').addEventListener('change', loadData);
  for (const id of ['battle-season', 'battle-venue']) byId(id).addEventListener('change', render);
  byId('battle-clear').addEventListener('click', clearSelections);
  loadData();
})();
