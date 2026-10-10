// Timestamp-based playback shared by the generated HTML and focused checks.
// A held image is labelled with its capture time, never claimed to be a new frame.
export function frameAt(take, ms) {
  if (!take.frames.length) return { state: 'no frames', frame: null };
  if (ms < take.frames[0].ms) return { state: 'before first frame', frame: null };
  if (ms > take.endMs) return { state: 'end of take', frame: null };
  let lo = 0, hi = take.frames.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (take.frames[mid].ms <= ms) lo = mid + 1; else hi = mid;
  }
  const frame = take.frames[lo - 1];
  return { state: frame.src ? 'captured' : 'frame unavailable', frame, index: lo - 1 };
}

export function stepTime(take, ms, direction) {
  if (direction > 0) return take.frames.find(f => f.ms > ms)?.ms ?? ms;
  return take.frames.findLast(f => f.ms < ms)?.ms ?? ms;
}

// This function is embedded verbatim, so it has no module/host dependencies.
export function mountPlayback(data) {
  const $ = id => document.getElementById(id);
  const sides = ['before', 'after'];
  const selected = { before: 0, after: 0 };
  let ms = data.fromMs, playing = false, speed = 1, last = null;
  const signed = n => (n >= 0 ? '+' : '') + n.toFixed(1) + ' ms';
  const take = side => data[side][selected[side]];
  function pause() { playing = false; last = null; $('play').textContent = 'Play'; }
  function draw() {
    $('seek').value = ms;
    $('clock').textContent = signed(ms) + ' from trigger';
    for (const side of sides) {
      const t = take(side), result = frameAt(t, ms), image = $(side + '-image');
      image.hidden = result.state !== 'captured';
      if (!image.hidden && image.getAttribute('src') !== result.frame.src) image.src = result.frame.src;
      $(side + '-empty').hidden = result.state === 'captured';
      $(side + '-empty').textContent = result.state;
      $(side + '-time').textContent = result.frame
        ? 'Frame ' + result.frame.id + ' · captured ' + signed(result.frame.ms) + ' · held for ' + (ms - result.frame.ms).toFixed(1) + ' ms' + (result.state === 'frame unavailable' ? ' · unavailable' : '')
        : result.state;
      $(side + '-identity').textContent = t.takeId + ' · trigger ' + t.trigger + ' · ' + t.frames.length + ' captured frames';
      $(side + '-prev').disabled = stepTime(t, ms, -1) === ms || stepTime(t, ms, -1) < data.fromMs;
      $(side + '-next').disabled = stepTime(t, ms, 1) === ms || stepTime(t, ms, 1) > data.toMs;
    }
    for (const button of $('markers').children) {
      const marker = data.markers[Number(button.dataset.index)];
      button.setAttribute('aria-pressed', String(ms >= marker.fromMs && ms <= marker.toMs));
    }
  }
  function seek(value) { ms = Math.max(data.fromMs, Math.min(data.toMs, value)); draw(); }
  for (const side of sides) {
    const select = $(side + '-take');
    data[side].forEach((t, i) => {
      const option = document.createElement('option');
      option.value = i; option.textContent = (i + 1) + '/' + data[side].length + ' · ' + t.takeId;
      select.append(option);
    });
    select.onchange = () => { selected[side] = Number(select.value); draw(); };
    for (const [suffix, direction] of [['prev', -1], ['next', 1]]) {
      $(side + '-' + suffix).onclick = () => { pause(); seek(stepTime(take(side), ms, direction)); };
    }
    $(side + '-image').onerror = () => {
      const result = frameAt(take(side), ms);
      if (result.frame && result.frame.src === $(side + '-image').getAttribute('src')) { result.frame.src = null; draw(); }
    };
  }
  for (const [i, marker] of data.markers.entries()) {
    const button = document.createElement('button');
    button.dataset.index = i;
    button.textContent = marker.label + ' · ' + signed(marker.fromMs) + ' → ' + signed(marker.toMs);
    button.title = marker.description;
    button.onclick = () => { pause(); seek(marker.fromMs); $('where').textContent = marker.description; };
    $('markers').append(button);
  }
  for (const clip of data.clips) {
    const link = document.createElement('a');
    link.href = clip.src; link.download = clip.name; link.textContent = 'Download ' + clip.label;
    $('downloads').append(link);
  }
  $('seek').min = data.fromMs; $('seek').max = data.toMs;
  $('seek').oninput = e => { pause(); seek(Number(e.target.value)); };
  $('speed').onchange = e => { speed = Number(e.target.value); last = null; };
  $('play').onclick = () => {
    if (playing) pause();
    else { if (ms >= data.toMs) seek(data.fromMs); playing = true; last = null; $('play').textContent = 'Pause'; }
  };
  $('trigger').onclick = () => { pause(); seek(0); };
  function tick(now) {
    if (playing) {
      if (last !== null) seek(ms + (now - last) * speed);
      last = now;
      if (ms >= data.toMs) pause();
    }
    requestAnimationFrame(tick);
  }
  draw(); requestAnimationFrame(tick);
}
