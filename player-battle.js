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

  function makeTable(title, names, labels, figures) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    for (const label of ['Metric', ...names]) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      header.appendChild(cell);
    }
    const body = table.createTBody();
    labels.forEach((label, index) => {
      const row = body.insertRow();
      const cell = document.createElement('th');
      cell.scope = 'row';
      cell.textContent = label;
      row.appendChild(cell);
      figures.forEach(player => { row.insertCell().textContent = player[index]; });
    });
    result.append(heading, table);
  }

  function battingFigures(stats) {
    return [number(stats.runs), number(stats.balls), divide(stats.runs, stats.balls, 100),
      divide(stats.runs, stats.outs)];
  }

  function bowlingFigures(stats) {
    return [number(stats.wickets), overs(stats.legal),
      divide(stats.conceded, stats.legal, 6), divide(stats.conceded, stats.wickets)];
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
    result.hidden = !data || selected.some(value => value === null);
    if (result.hidden) return;
    const heading = document.createElement('h2');
    heading.className = 'result-heading';
    heading.textContent = selected.map(nameFor).join(' vs ');
    result.appendChild(heading);

    const formats = competition === 'international' ? ['Test', 'ODI', 'T20I'] : [null];
    for (const format of formats) {
      if (format) {
        const formatHeading = document.createElement('h2');
        formatHeading.textContent = format;
        result.appendChild(formatHeading);
      }
      if (mode === 'teams') renderTeams(format);
      else renderPlayers(format);
    }
  }

  function renderPlayers(format) {

    const totals = [emptyStats(), emptyStats()];
    const phases = [0, 1].map(() => groups(format || data.format).map(emptyStats));
    let deliveriesFound = false;
    for (const row of data.rows) {
      const match = data.matches[row[0]];
      if ((format && match[7] !== format) || !matchIncluded(match)) continue;
      if (mode === 'direct') {
        if (row[1] !== selected[0] || row[2] !== selected[1]) continue;
        if (row[5] || row[11]) deliveriesFound = true;
        addStats(totals[0], row);
        if (phases[0][row[3]]) addStats(phases[0][row[3]], row);
      } else {
        const column = mode === 'bowlers' ? 2 : 1;
        const index = selected.indexOf(row[column]);
        if (index < 0) continue;
        if (row[5] || row[11]) deliveriesFound = true;
        addStats(totals[index], row);
        if (phases[index][row[3]]) addStats(phases[index][row[3]], row);
      }
    }
    if (!deliveriesFound) {
      const note = document.createElement('p');
      note.textContent = 'No recorded deliveries for this selection and these filters.';
      result.appendChild(note);
      return;
    }
    const names = selected.map(nameFor);
    const bowling = mode === 'bowlers';
    const labels = bowling
      ? ['Wickets', 'Overs', 'Economy', 'Bowling average']
      : ['Runs', 'Balls', 'Strike rate', 'Batting average'];
    const figures = bowling ? bowlingFigures : battingFigures;
    if (mode === 'direct') {
      const directFigures = stats => [
        number(stats.runs), number(stats.balls), divide(stats.runs, stats.balls, 100), number(stats.wickets),
        number(stats.fours), number(stats.sixes)
      ];
      const directLabels = ['Runs', 'Balls', 'Strike rate', 'Bowler dismissals', 'Fours', 'Sixes'];
      makeTable('Overall matchup', [names[0] + ' facing ' + names[1]], directLabels, [directFigures(totals[0])]);
      renderPhases(format, [names[0]], directLabels, phases, directFigures);
    } else {
      makeTable('Overall', names, labels, totals.map(figures));
      renderPhases(format, names, labels, phases, figures);
    }
  }


  function renderPhases(format, names, labels, phases, figures) {
    if ((format || data.format) === 'Test') return;
    const section = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Performance by phase';
    section.appendChild(summary);
    groups(format || data.format).forEach((phase, index) => {
      makeTable(phase, names, labels, phases.slice(0, names.length).map(player => figures(player[index])));
      const table = result.lastElementChild;
      const heading = table.previousElementSibling;
      section.append(heading, table);
    });
    result.appendChild(section);
  }

  function combineFormats(datasets) {
    const combined = { players: [], venues: [], matches: [], rows: [], format: 'International' };
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
    clearSelections();
    inputs.forEach(input => { input.disabled = true; });
    const international = competition === 'international';
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
        ? 'Results are grouped by Test, ODI and T20I. Open Performance by phase for limited-overs breakdowns. Regular innings only. — means no dismissals, wickets or balls to calculate the rate.'
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
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    clearSelections();
    updateChoices();
  }));
  byId('battle-gender').addEventListener('change', loadData);
  for (const id of ['battle-season', 'battle-venue']) byId(id).addEventListener('change', render);
  byId('battle-clear').addEventListener('click', clearSelections);
  loadData();
})();
