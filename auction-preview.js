(() => {
  'use strict';
  const root = document.querySelector('.auction-preview');
  if (!root) return;
  const find = id => root.querySelector('#ap-' + id);
  const lot = find('lot'), current = find('cur'), ladder = find('lad');
  const player = find('pa'), next = find('pb'), stamp = find('stamp'), sold = find('sc');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const bids = [['MI',20.5],['CSK',21],['RCB',21.5],['MI',22],['CSK',22.5],['RCB',23]];
  const timers = new Set();
  let visible = !('IntersectionObserver' in window);
  const money = value => '₹' + value + ' Cr';
  function clear() {
    timers.forEach(clearTimeout);
    timers.clear();
    current.classList.remove('ap-bump');
    lot.classList.remove('ap-shake');
  }
  function later(fn, delay) {
    const timer = setTimeout(() => {timers.delete(timer); fn();}, delay);
    timers.add(timer);
  }
  function showCurrent() {
    player.classList.remove('ap-off');
    next.classList.add('ap-off');
    stamp.classList.remove('ap-hit');
    stamp.style.opacity = '';
    stamp.style.transform = '';
    ladder.replaceChildren();
  }
  function run() {
    clear();
    showCurrent();
    root.dataset.previewState = 'bidding';
    current.textContent = money(20);
    let delay = 900;
    for (const [team, price] of bids) {
      later(() => {
        current.textContent = money(price);
        current.classList.add('ap-bump');
        later(() => current.classList.remove('ap-bump'),180);
        for (const row of ladder.children) row.classList.remove('ap-top');
        const row = document.createElement('div'); row.className = 'ap-bd ap-top';
        const label = document.createElement('span'), badge = document.createElement('i'), amount = document.createElement('em');
        badge.textContent = team;
        label.append(badge,'Bid'); amount.textContent = money(price);
        row.append(label,amount); ladder.prepend(row);
        while (ladder.children.length > 3) ladder.lastElementChild.remove();
      },delay);
      delay += 850;
    }
    later(() => {
      root.dataset.previewState = 'sold';
      sold.textContent = money(23);
      stamp.classList.add('ap-hit'); lot.classList.add('ap-shake');
      later(() => lot.classList.remove('ap-shake'),360);
    },delay + 300);
    later(() => {
      root.dataset.previewState = 'next';
      player.classList.add('ap-off'); next.classList.remove('ap-off'); stamp.classList.remove('ap-hit');
    },delay + 2600);
    later(run,delay + 5400);
  }
  function update() {
    clear();
    if (motion.matches) {
      showCurrent();
      current.textContent = money(23); sold.textContent = money(23);
      stamp.classList.add('ap-hit'); stamp.style.opacity = '1';
      stamp.style.transform = 'translate(-50%,-50%) rotate(-12deg)';
      root.dataset.previewState = 'sold';
    } else if (visible && !document.hidden) run();
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting !== visible) {visible = entry.isIntersecting; update();}
      }
    },{threshold:0.05});
    observer.observe(root);
  }
  document.addEventListener('visibilitychange',update);
  motion.addEventListener?.('change',update);
  update();
})();
