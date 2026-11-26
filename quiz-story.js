// Prepare the PNG when the result opens so the share sheet can open on the tap itself.
async function makeQuizStory(league, day, score, total) {
  const display = '"Big Shoulders Display", sans-serif';
  await Promise.all([document.fonts.load('800 240px ' + display), document.fonts.load('700 40px "Space Grotesk"')]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const c = canvas.getContext('2d');
  const cream = '#fff4dc', gold = '#ffcf54';
  const bg = c.createLinearGradient(0, 0, 1080, 1920);
  bg.addColorStop(0, '#08152b');
  bg.addColorStop(.52, '#101f3e');
  bg.addColorStop(1, '#070c19');
  c.fillStyle = bg;
  c.fillRect(0, 0, 1080, 1920);
  for (let i = 1; i < 240; i++) {
    const noise = n => Math.abs(Math.sin(i * n) * 43758.54) % 1;
    c.fillStyle = 'rgba(215,231,255,' + (.16 + .56 * noise(5)) + ')';
    c.beginPath();
    c.arc(noise(13) * 1080, noise(79) * 1920, .6 + noise(39) * 1.6, 0, Math.PI * 2);
    c.fill();
  }
  // A floodlit leather ball rises into the frame from the right edge.
  c.save();
  c.translate(972, 740);
  c.rotate(-.48);
  const leather = c.createRadialGradient(-180, -240, 16, 0, 0, 420);
  leather.addColorStop(0, '#ff775d');
  leather.addColorStop(.36, '#c83940');
  leather.addColorStop(.79, '#531c34');
  leather.addColorStop(1, '#15192f');
  c.fillStyle = leather;
  c.beginPath();
  c.arc(0, 0, 416, 0, 2 * Math.PI);
  c.fill();
  c.clip();
  for (const offset of [-20, -8, 8, 20]) {
    c.strokeStyle = '#de9b89';
    c.lineWidth = 4;
    c.setLineDash([9, 8]);
    c.beginPath();
    c.ellipse(offset - 35, 0, 105, 430, 0, -Math.PI / 2, Math.PI / 2);
    c.stroke();
  }
  c.restore();
  c.strokeStyle = '#bca575';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(925, 788, 582, 108, -.53, 0, Math.PI * 2);
  c.stroke();

  function label(value, x, y, font, color = cream) {
    c.font = font;
    c.fillStyle = color;
    c.fillText(value, x, y);
  }
  const small = '700 33px "Space Grotesk", sans-serif';
  const date = new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  label('THE CRICKET SPACE', 80, 234, small);
  label(date.toUpperCase(), 80, 294, small, '#aabbd0');
  label(league.toUpperCase() + ' DAILY', 74, 485, '800 114px ' + display);
  label('QUIZ', 70, 657, '800 196px ' + display);
  label('MY SCORE', 80, 1015, small, gold);
  label(String(score), 65, 1315, '800 358px ' + display, gold);
  const numberWidth = c.measureText(String(score)).width;
  label('/ ' + total, 86 + numberWidth, 1315, '800 164px ' + display);
  for (let i = 0; i < total; i++) {
    c.fillStyle = i < score ? gold : '#34425a';
    c.fillRect(80 + i * (920 / total), 1372, 920 / total - 12, 8);
  }
  label('Can you beat my score?', 80, 1538, '700 76px ' + display);
  label('thecricketspace.in', 80, 1610, small, '#b5c5d9');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('PNG export failed')), 'image/png'));
}
