(() => {
  'use strict';
  const day = document.getElementById('otd-d');
  const month = document.getElementById('otd-m');
  const container = document.getElementById('otd-b');
  if (!day || !month || !container) return;
  const timezone = 'Asia/Kolkata';
  let lastDate = '';
  let request = 0;
  let cached;
  function parts(now) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p => [p.type,p.value]));
  }
  function paint(event) {
    const label = document.createElement('span');
    label.className = 'live';
    label.textContent = 'Today in cricket history';
    const heading = document.createElement('h3');
    heading.className = 'D';
    const text = document.createElement('p');
    if (event) {
      const year = document.createElement('span');
      year.className = 'yr D';
      year.textContent = event.date.slice(0,4);
      heading.textContent = event.title;
      text.textContent = event.summary;
      container.replaceChildren(label,year,heading,text);
    } else {
      heading.textContent = 'Cricket history';
      text.textContent = 'Today’s cricket moment is temporarily unavailable. Please try again shortly.';
      container.replaceChildren(label,heading,text);
    }
  }
  async function refresh() {
    const now = new Date();
    const p = parts(now);
    const today = `${p.year}-${p.month}-${p.day}`;
    if (today === lastDate) return;
    lastDate = today;
    const current = ++request;
    day.textContent = p.day;
    month.textContent = new Intl.DateTimeFormat('en-GB',{timeZone:timezone,month:'long'}).format(now);
    const key = `${p.month}-${p.day}`;
    // Clear yesterday's entry immediately if an open page crosses midnight.
    if (cached) paint((cached.days[key] || []).find(e => e.date < today));
    else container.textContent = 'Loading today’s cricket moment…';
    try {
      const response = await fetch(`cricket-history.json?v=${today}`,{cache:'no-cache'});
      if (!response.ok) throw new Error('History unavailable');
      const data = await response.json();
      if (data.version !== 1 || !data.days) throw new Error('Invalid history calendar');
      if (current !== request) return;
      cached = data;
      const event = (data.days[key] || []).find(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date.slice(5) === key && e.date < today && typeof e.title === 'string' && typeof e.summary === 'string');
      paint(event);
    } catch {
      if (current !== request) return;
      if (!cached) paint(null);
      // A failed request can retry without requiring the visitor to reload.
      lastDate = '';
    }
  }
  refresh();
  setInterval(refresh,60000);
  document.addEventListener('visibilitychange',() => {if (!document.hidden) refresh();});
})();
