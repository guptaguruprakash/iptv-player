let channels = [
  { name:'ESPN Sports HD', prog:'Champions League Final', emoji:'⚽', bg:'#1b263b', cat:'Sports', q:'4K', live:true },
  { name:'CNN International', prog:'World News Tonight', emoji:'📡', bg:'#0d1b2a', cat:'News', q:'HD', live:true },
  { name:'HBO Max', prog:'House of the Dragon S2', emoji:'🎭', bg:'#1c0a00', cat:'Movies', q:'4K', live:true },
  { name:'National Geographic', prog:'Planet Earth IV', emoji:'🌍', bg:'#0a1a14', cat:'Movies', q:'4K', live:true },
  { name:'Cartoon Network', prog:'Adventure Time Marathon', emoji:'🎪', bg:'#0f1a0a', cat:'Kids', q:'HD', live:true },
  { name:'MTV Hits', prog:'Top 40 Countdown', emoji:'🎵', bg:'#1a0a1a', cat:'Music', q:'HD', live:true },
  { name:'BBC World News', prog:'Global Report', emoji:'🇬🇧', bg:'#0a1020', cat:'News', q:'HD', live:true },
  { name:'Discovery Channel', prog:"How It's Made", emoji:'🔬', bg:'#150a00', cat:'Movies', q:'HD', live:true },
  { name:'NBA TV', prog:'Lakers vs Celtics', emoji:'🏀', bg:'#1a0a00', cat:'Sports', q:'4K', live:true },
  { name:'Nick Jr', prog:'Paw Patrol', emoji:'🐾', bg:'#0a120a', cat:'Kids', q:'HD', live:true },
  { name:'VH1 Classic', prog:'80s Rewind', emoji:'🎸', bg:'#1a1000', cat:'Music', q:'HD', live:true },
  { name:'Sky Sports', prog:'Premier League Highlights', emoji:'🏟️', bg:'#001a20', cat:'Sports', q:'4K', live:true },
];

let currentIdx = 0;
let isPlaying = true;
let liveSeconds = 0;
let prevScreen = 'screen-home';
const DEFAULT_PLAYLIST_URL = 'https://raw.githubusercontent.com/guptaguruprakash/iptv/refs/heads/main/Sorted_Indian_TV_Playlist.m3u';
let hlsInstance = null;

function getPlayerVideoElement() {
  return document.getElementById('live-video');
}

function stopActiveStream() {
  const video = getPlayerVideoElement();
  if (!video) return;

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  video.pause();
  video.removeAttribute('src');
  video.load();
}

function playCurrentStream() {
  const ch = channels[currentIdx];
  const video = getPlayerVideoElement();
  const emojiBg = document.getElementById('player-emoji');

  if (!video || !emojiBg) return;

  if (!ch || !ch.stream_url) {
    stopActiveStream();
    emojiBg.style.display = 'flex';
    return;
  }

  emojiBg.style.display = 'none';

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  const streamUrl = ch.stream_url;

  if (window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      if (isPlaying) {
        video.play().catch(() => {
          showToast('Tap play to start stream');
        });
      }
    });
    hlsInstance.on(Hls.Events.ERROR, (_, data) => {
      if (data && data.fatal) {
        showToast('Stream error on this channel');
      }
    });
    return;
  }

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
    if (isPlaying) {
      video.play().catch(() => {
        showToast('Tap play to start stream');
      });
    }
    return;
  }

  showToast('HLS playback is not supported here');
}

function renderChannels(list) {
  const el = document.getElementById('ch-list');
  const cnt = document.getElementById('ch-count');
  cnt.textContent = list.length + ' channels';
  el.innerHTML = list.map((ch,i) => {
    const idx = channels.indexOf(ch);
    return `<div class="ch-row${idx===currentIdx?' active':''}" onclick="openPlayer(${idx})">
      <div class="ch-logo" style="background:${ch.bg}">${ch.emoji}</div>
      <div class="ch-info">
        <div class="ch-name">${ch.name}</div>
        <div class="ch-prog-text">${ch.prog}</div>
      </div>
      <div class="ch-badges">
        ${ch.live?'<span class="badge badge-live">LIVE</span>':''}
        <span class="badge badge-${ch.q==='4K'?'4k':'hd'}">${ch.q}</span>
        ${idx===currentIdx?'<div class="live-dot"></div>':''}
      </div>
    </div>`;
  }).join('');
}

function filterChannels(q) {
  const filtered = channels.filter(ch =>
    ch.name.toLowerCase().includes(q.toLowerCase()) ||
    ch.prog.toLowerCase().includes(q.toLowerCase())
  );
  renderChannels(filtered);
}

let currentTab = 'All';
function filterTab(cat, btn) {
  currentTab = cat;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'All' ? channels : channels.filter(ch => ch.cat === cat);
  renderChannels(filtered);
}

function openPlayer(idx) {
  currentIdx = idx;
  isPlaying = true;
  updatePlayerUI();
  playCurrentStream();
  prevScreen = document.querySelector('.screen.active').id;
  if (prevScreen !== 'screen-player') {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-player').classList.add('active');
    document.getElementById('bottom-nav').style.display = 'none';
  }
  renderNextList();
  renderChannels(channels);
}

function updatePlayerUI() {
  const ch = channels[currentIdx];
  // mini player
  document.getElementById('mp-thumb').textContent = ch.emoji;
  document.getElementById('mp-ch').textContent = ch.name;
  document.getElementById('mp-prog').textContent = ch.prog;
  // full player
  document.getElementById('player-emoji').textContent = ch.emoji;
  document.getElementById('player-ch-name').textContent = ch.name;
  document.getElementById('player-prog-name').textContent = ch.prog + ' · Live';
  // play btns
  const icon = isPlaying ? '⏸' : '▶';
  document.getElementById('mp-play-btn').textContent = icon;
  document.getElementById('player-play-btn').textContent = icon;
}

function togglePlay() {
  isPlaying = !isPlaying;
  updatePlayerUI();

  const video = getPlayerVideoElement();
  if (!video) return;

  if (isPlaying) {
    video.play().catch(() => {
      showToast('Unable to start playback');
    });
  } else {
    video.pause();
  }
}

function prevCh() {
  currentIdx = (currentIdx - 1 + channels.length) % channels.length;
  isPlaying = true;
  updatePlayerUI();
  playCurrentStream();
  renderChannels(channels);
  renderNextList();
}

function nextCh() {
  currentIdx = (currentIdx + 1) % channels.length;
  isPlaying = true;
  updatePlayerUI();
  playCurrentStream();
  renderChannels(channels);
  renderNextList();
}

function renderNextList() {
  const el = document.getElementById('player-next-list');
  const next = [];
  for (let i = 1; i <= 5; i++) next.push(channels[(currentIdx + i) % channels.length]);
  el.innerHTML = next.map((ch, i) => {
    const idx = channels.indexOf(ch);
    return `<div class="pnl-row" onclick="openPlayer(${idx})">
      <div class="pnl-icon" style="background:${ch.bg}">${ch.emoji}</div>
      <div class="pnl-info">
        <div class="pnl-name">${ch.name}</div>
        <div class="pnl-prog">${ch.prog}</div>
      </div>
      <span style="color:var(--muted);font-size:14px;">▶</span>
    </div>`;
  }).join('');
}

function goBack() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
  document.getElementById('bottom-nav').style.display = '';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-screen="screen-home"]').classList.add('active');
}

function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';
}

function switchNav(name, btn) {
  const screenMap = { home:'screen-home', epg:'screen-epg', playlist:'screen-playlist', settings:'screen-settings' };
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenMap[name]).classList.add('active');
  document.getElementById('bottom-nav').style.display = '';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function setUrl(url) {
  document.getElementById('m3u-url').value = url;
  showToast('✅ URL loaded. Press LOAD to fetch.');
}

async function loadPlaylist() {
  const url = document.getElementById('m3u-url').value.trim();
  if (!url) { showToast('⚠️ Please enter a playlist URL'); return; }

  showToast('⏳ Loading playlist...');

  try {
    const response = await fetch('/api/playlist/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Could not load playlist');
    }

    channels = data.channels.map((item, idx) => ({
      name: item.name || 'Unknown Channel',
      prog: item.category ? ('Category: ' + item.category) : 'Live Stream',
      emoji: ['📺', '🎬', '📰', '⚽', '🎵', '🌍'][idx % 6],
      bg: ['#1b263b', '#0d1b2a', '#1c0a00', '#0a1a14', '#1a0a1a', '#001a20'][idx % 6],
      cat: item.category || 'Other',
      q: 'HD',
      live: true,
      stream_url: item.stream_url || '',
    }));

    currentIdx = 0;
    isPlaying = true;
    renderChannels(channels);
    updatePlayerUI();
    renderNextList();
    buildEPG();

    showToast('✅ Loaded ' + channels.length + ' channels');
    switchNav('home', document.querySelector('[data-screen="screen-home"]'));
  } catch (error) {
    showToast('❌ ' + error.message);
  }
}

// Progress simulation
let prog = 38;
setInterval(() => {
  if (!isPlaying) return;
  prog = (prog + 0.02) % 100;
  const pct = prog.toFixed(1) + '%';
  const mpf = document.getElementById('mp-fill');
  const ppf = document.getElementById('pp-fill');
  if (mpf) mpf.style.width = pct;
  if (ppf) ppf.style.width = pct;
}, 500);

// Clock
function updateClock() {
  const now = new Date();
  const t = now.getHours()+':'+(now.getMinutes()<10?'0':'')+now.getMinutes();
  ['clock','clock2','clock3','clock4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  });
}
updateClock();
setInterval(updateClock, 10000);

// EPG
function buildEPG() {
  const days = ['Today','Tomorrow','Fri','Sat','Sun','Mon'];
  const daysEl = document.getElementById('epg-days');
  daysEl.innerHTML = days.map((d,i) => `<div class="epg-day${i===0?' active':''}" onclick="this.parentNode.querySelectorAll('.epg-day').forEach(x=>x.classList.remove('active'));this.classList.add('active')">${d}${i>1?'<div class="epg-day-name">Apr '+(3+i)+'</div>':''}</div>`).join('');

  const programs = [
    ['Premier League Preview','Champions League Final','Sports Desk Live','FIFA Highlights'],
    ['CNN Morning','Breaking News','Global Report','World Tonight'],
    ['Dune Part Three','The Batman Returns','Inception','Interstellar'],
    ['Paw Patrol','SpongeBob','Tom & Jerry','Bluey'],
  ];

  const times = ['8:00 AM','10:00 AM','12:00 PM','2:00 PM'];
  const grid = document.getElementById('epg-grid');
  grid.innerHTML = channels.slice(0,8).map((ch,ci) => {
    const progs = programs[ci%4];
    return `<div class="epg-ch-row">
      <div class="epg-ch-head">
        <div class="epg-ch-ico" style="background:${ch.bg}">${ch.emoji}</div>
        <div class="epg-ch-nm">${ch.name}</div>
      </div>
      <div class="epg-slots">
        ${times.map((t,ti) => `<div class="epg-slot${ti===1?' now':''}">
          <div class="epg-time">${t}</div>
          <div class="epg-prog-name">${progs[ti]||'TBA'}</div>
          ${ti===1?'<div class="epg-now-tag">▶ NOW</div>':''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// Init
renderChannels(channels);
buildEPG();
updatePlayerUI();
renderNextList();
document.getElementById('m3u-url').value = DEFAULT_PLAYLIST_URL;
loadPlaylist();