import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'

const DEFAULT_PLAYLIST_URL = 'https://raw.githubusercontent.com/guptaguruprakash/iptv/refs/heads/main/Sorted_Indian_TV_Playlist.m3u'
const SAMPLE_PLAYLISTS = [
  { label: '🌍 Free IPTV', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { label: '📰 News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { label: '⚽ Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
]

const DEFAULT_CHANNELS = [
  { name: 'ESPN Sports HD', prog: 'Champions League Final', emoji: '⚽', bg: '#1b263b', cat: 'Sports', q: '4K', live: true },
  { name: 'CNN International', prog: 'World News Tonight', emoji: '📡', bg: '#0d1b2a', cat: 'News', q: 'HD', live: true },
  { name: 'HBO Max', prog: 'House of the Dragon S2', emoji: '🎭', bg: '#1c0a00', cat: 'Movies', q: '4K', live: true },
  { name: 'National Geographic', prog: 'Planet Earth IV', emoji: '🌍', bg: '#0a1a14', cat: 'Movies', q: '4K', live: true },
  { name: 'Cartoon Network', prog: 'Adventure Time Marathon', emoji: '🎪', bg: '#0f1a0a', cat: 'Kids', q: 'HD', live: true },
  { name: 'MTV Hits', prog: 'Top 40 Countdown', emoji: '🎵', bg: '#1a0a1a', cat: 'Music', q: 'HD', live: true },
  { name: 'BBC World News', prog: 'Global Report', emoji: '🇬🇧', bg: '#0a1020', cat: 'News', q: 'HD', live: true },
  { name: 'Discovery Channel', prog: "How It's Made", emoji: '🔬', bg: '#150a00', cat: 'Movies', q: 'HD', live: true },
  { name: 'NBA TV', prog: 'Lakers vs Celtics', emoji: '🏀', bg: '#1a0a00', cat: 'Sports', q: '4K', live: true },
  { name: 'Nick Jr', prog: 'Paw Patrol', emoji: '🐾', bg: '#0a120a', cat: 'Kids', q: 'HD', live: true },
  { name: 'VH1 Classic', prog: '80s Rewind', emoji: '🎸', bg: '#1a1000', cat: 'Music', q: 'HD', live: true },
  { name: 'Sky Sports', prog: 'Premier League Highlights', emoji: '🏟️', bg: '#001a20', cat: 'Sports', q: '4K', live: true },
]

const EPG_PROGRAMS = [
  ['Premier League Preview', 'Champions League Final', 'Sports Desk Live', 'FIFA Highlights'],
  ['CNN Morning', 'Breaking News', 'Global Report', 'World Tonight'],
  ['Dune Part Three', 'The Batman Returns', 'Inception', 'Interstellar'],
  ['Paw Patrol', 'SpongeBob', 'Tom & Jerry', 'Bluey'],
]

const EPG_TIMES = ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM']
const EPG_DAYS = ['Today', 'Tomorrow', 'Fri', 'Sat', 'Sun', 'Mon']

function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || ''
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent || '')
}

function isLandscape() {
  return window.matchMedia?.('(orientation: landscape)').matches ?? window.innerWidth > window.innerHeight
}

const VIDEO_MODE_LABELS = {
  original: 'ORI',
  fit: 'FIT',
  stretch: 'STR',
}

const VIDEO_MODE_ORDER = ['original', 'fit', 'stretch']

export default function App() {
  const videoRef = useRef(null)
  const playerStageRef = useRef(null)
  const hlsRef = useRef(null)
  const toastTimerRef = useRef(0)

  const [channels, setChannels] = useState(DEFAULT_CHANNELS)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [currentTab, setCurrentTab] = useState('All')
  const [search, setSearch] = useState('')
  const [screen, setScreen] = useState('home')
  const [isPlaying, setIsPlaying] = useState(true)
  const [playlistUrl, setPlaylistUrl] = useState(DEFAULT_PLAYLIST_URL)
  const [toast, setToast] = useState('')
  const [clock, setClock] = useState('9:41')
  const [epgDayIndex, setEpgDayIndex] = useState(0)
  const [fitMode, setFitMode] = useState('original')
  const [videoZoom, setVideoZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggles, setToggles] = useState({ parental: false, hardware: true, cache: true, compact: false })
  const [androidLandscape, setAndroidLandscape] = useState(isAndroid() && isLandscape())

  const activeChannel = channels[currentIdx] || channels[0]
  const showLandscapeControls = isAndroid() && androidLandscape && screen === 'player'
  const filteredChannels = useMemo(() => {
    let list = channels
    if (currentTab !== 'All') {
      list = list.filter((channel) => channel.cat === currentTab)
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase()
      list = list.filter((channel) => channel.name.toLowerCase().includes(query) || channel.prog.toLowerCase().includes(query))
    }
    return list
  }, [channels, currentTab, search])

  const nextList = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => channels[(currentIdx + index + 1) % channels.length])
  }, [channels, currentIdx])

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes().toString().padStart(2, '0')
      setClock(`${hours}:${minutes}`)
    }

    const updateOrientation = () => setAndroidLandscape(isAndroid() && isLandscape())
    updateClock()
    updateOrientation()

    const clockInterval = window.setInterval(updateClock, 10000)
    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', updateOrientation)

    return () => {
      window.clearInterval(clockInterval)
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', updateOrientation)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)
    syncFullscreenState()

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const objectFitMap = {
      original: 'cover',
      fit: 'contain',
      stretch: 'fill',
    }

    video.style.objectFit = objectFitMap[fitMode] || 'cover'
    video.style.transform = fitMode === 'stretch' ? 'none' : `scale(${videoZoom})`
  }, [fitMode, videoZoom])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (screen !== 'player') {
      stopStream()
      return
    }

    playCurrentStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, currentIdx])

  useEffect(() => {
    if (fitMode === 'stretch') {
      setVideoZoom(1)
    }
  }, [fitMode])

  useEffect(() => {
    loadPlaylist(DEFAULT_PLAYLIST_URL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(message) {
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2200)
  }

  function stopStream() {
    const video = videoRef.current
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }

  function safePlay(video) {
    return video.play().catch(async () => {
      video.muted = true
      try {
        await video.play()
        showToast('Tap volume to unmute')
        return true
      } catch {
        return false
      }
    })
  }

  function applyVideoModeStyles() {
    const video = videoRef.current
    if (!video) return
    const objectFitMap = {
      original: 'cover',
      fit: 'contain',
      stretch: 'fill',
    }
    video.style.objectFit = objectFitMap[fitMode] || 'cover'
    video.style.transform = fitMode === 'stretch' ? 'none' : `scale(${videoZoom})`
  }

  function playCurrentStream() {
    const channel = channels[currentIdx]
    const video = videoRef.current
    if (!video || !channel) return

    applyVideoModeStyles()

    if (!channel.stream_url) {
      stopStream()
      return
    }

    stopStream()

    const canUseHls = typeof Hls?.isSupported === 'function' && Hls.isSupported()

    if (canUseHls) {
      const hls = new Hls({
        enableWorker: !isAndroid(),
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
      })
      hlsRef.current = hls
      hls.loadSource(channel.stream_url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        if (isPlaying) {
          const started = await safePlay(video)
          if (!started) {
            showToast('Tap play to start stream')
          }
        }
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data?.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad()
          showToast('Reconnecting stream...')
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          showToast('Recovering playback...')
          return
        }
        hls.destroy()
        hlsRef.current = null
        showToast('Stream error on this channel')
      })
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.stream_url
      if (isPlaying) {
        safePlay(video)
      }
      return
    }

    if (channel.stream_url.endsWith('.m3u8')) {
      video.src = channel.stream_url
      if (isPlaying) {
        safePlay(video)
      }
      return
    }

    showToast('HLS playback is not supported here')
  }

  async function loadPlaylist(url = playlistUrl) {
    const playlist = url.trim()
    if (!playlist) {
      showToast('⚠️ Please enter a playlist URL')
      return
    }

    setLoading(true)
    showToast('⏳ Loading playlist...')

    try {
      const response = await fetch(`${getApiBase()}/api/playlist/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playlist }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Could not load playlist')
      }

      const mapped = data.channels.map((item, index) => ({
        name: item.name || 'Unknown Channel',
        prog: item.category ? `Category: ${item.category}` : 'Live Stream',
        emoji: ['📺', '🎬', '📰', '⚽', '🎵', '🌍'][index % 6],
        bg: ['#1b263b', '#0d1b2a', '#1c0a00', '#0a1a14', '#1a0a1a', '#001a20'][index % 6],
        cat: item.category || 'Other',
        q: 'HD',
        live: true,
        stream_url: item.stream_url || '',
      }))

      setChannels(mapped)
      setCurrentIdx(0)
      setScreen('home')
      setIsPlaying(true)
      showToast(`✅ Loaded ${mapped.length} channels`)
    } catch (error) {
      showToast(`❌ ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  function openPlayer(index) {
    setCurrentIdx(index)
    setIsPlaying(true)
    setScreen('player')
  }

  function prevCh() {
    setCurrentIdx((index) => (index - 1 + channels.length) % channels.length)
    setIsPlaying(true)
    setScreen('player')
  }

  function nextCh() {
    setCurrentIdx((index) => (index + 1) % channels.length)
    setIsPlaying(true)
    setScreen('player')
  }

  function togglePlay() {
    const video = videoRef.current
    setIsPlaying((current) => {
      const next = !current
      if (!video) return next
      if (next) {
        safePlay(video)
      } else {
        video.pause()
      }
      return next
    })
  }

  function goBack() {
    setScreen('home')
  }

  function switchNav(name) {
    const screenMap = {
      home: 'home',
      epg: 'epg',
      playlist: 'playlist',
      settings: 'settings',
    }
    setScreen(screenMap[name] || 'home')
  }

  function setUrl(url) {
    setPlaylistUrl(url)
    showToast('✅ URL loaded. Press LOAD to fetch.')
  }

  function filterTab(tab) {
    setCurrentTab(tab)
  }

  function setVideoMode(mode) {
    if (!['original', 'fit', 'stretch'].includes(mode)) return
    setFitMode(mode)
    if (mode === 'stretch') {
      setVideoZoom(1)
    }
    showToast(`${VIDEO_MODE_LABELS[mode] || 'VIDEO'} mode enabled`)
  }

  function cycleVideoMode() {
    const currentIndex = VIDEO_MODE_ORDER.indexOf(fitMode)
    const nextMode = VIDEO_MODE_ORDER[(currentIndex + 1) % VIDEO_MODE_ORDER.length]
    setVideoMode(nextMode)
  }

  function zoomInVideo() {
    if (!isAndroid() || !androidLandscape || fitMode === 'stretch') return
    setVideoZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))
  }

  function zoomOutVideo() {
    if (!isAndroid() || !androidLandscape || fitMode === 'stretch') return
    setVideoZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))
  }

  function resetVideoZoom() {
    if (!isAndroid() || !androidLandscape || fitMode === 'stretch') return
    setVideoZoom(1)
  }

  async function toggleFullscreen() {
    const target = playerStageRef.current
    if (!target) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      if (target.requestFullscreen) {
        await target.requestFullscreen()
        return
      }

      if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen()
        return
      }

      showToast('Fullscreen is not supported on this device')
    } catch {
      showToast('Could not enter fullscreen')
    }
  }

  function toggleSetting(key) {
    setToggles((current) => ({ ...current, [key]: !current[key] }))
  }

  const playerStyle = {
    width: '100%',
    height: '100%',
    objectFit: fitMode === 'fit' ? 'contain' : fitMode === 'stretch' ? 'fill' : 'cover',
    background: '#000',
    transformOrigin: 'center center',
    transform: fitMode === 'stretch' ? 'none' : `scale(${videoZoom})`,
  }

  const featuredItems = [
    { emoji: '⚽', bg: 'feat-bg-1', title: 'ESPN Sports HD', sub: 'Champions League' },
    { emoji: '🎬', bg: 'feat-bg-2', title: 'Cinema Max 4K', sub: 'Dune Part Three' },
    { emoji: '📰', bg: 'feat-bg-3', title: 'CNN World', sub: 'Breaking News' },
    { emoji: '🎵', bg: 'feat-bg-4', title: 'MTV Hits', sub: 'Top 40 Countdown' },
  ]

  const epgChannels = channels.slice(0, 8)
  const navActive = screen

  return (
    <div id="app">
      <div className={`screen ${navActive === 'home' ? 'active' : ''}`} id="screen-home">
        <div className="status-bar"><span id="clock">{clock}</span></div>
        <div className="app-header">
          <div className="logo">PLAY<em>TV</em></div>
          <div className="header-actions">
            <div className="icon-btn" onClick={() => showToast('🔔 No new notifications')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </div>
          </div>
        </div>

        <div className="search-wrap">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" placeholder="Search channels, shows..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        <div className="tabs-wrap" id="tabs">
          {['All', 'Sports', 'News', 'Movies', 'Kids', 'Music'].map((tab) => (
            <button key={tab} className={`tab-btn ${currentTab === tab ? 'active' : ''}`} onClick={() => filterTab(tab)}>{tab}</button>
          ))}
          <button className={`tab-btn ${currentTab === 'Sports' ? 'active' : ''}`} onClick={() => filterTab('Sports')}>🏀 NBA</button>
        </div>

        <div className="scroll-area">
          <div className="sec-head">
            <span className="sec-title">Featured</span>
            <span className="sec-link">See all</span>
          </div>
          <div className="featured-scroll">
            {featuredItems.map((item, index) => (
              <div key={item.title} className="feat-card" onClick={() => openPlayer(index)}>
                <div className={`feat-bg ${item.bg}`}>{item.emoji}</div>
                <div className="feat-overlay">
                  <div className="feat-live">● LIVE</div>
                  <div className="feat-name">{item.title}</div>
                  <div className="feat-prog">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="sec-head">
            <span className="sec-title">Channels</span>
            <span className="sec-link" id="ch-count">{filteredChannels.length} channels</span>
          </div>
          <div className="ch-list" id="ch-list">
            {filteredChannels.map((channel) => {
              const index = channels.indexOf(channel)
              const active = index === currentIdx
              return (
                <div key={`${channel.name}-${index}`} className={`ch-row ${active ? 'active' : ''}`} onClick={() => openPlayer(index)}>
                  <div className="ch-logo" style={{ background: channel.bg }}>{channel.emoji}</div>
                  <div className="ch-info">
                    <div className="ch-name">{channel.name}</div>
                    <div className="ch-prog-text">{channel.prog}</div>
                  </div>
                  <div className="ch-badges">
                    {channel.live ? <span className="badge badge-live">LIVE</span> : null}
                    <span className={`badge badge-${channel.q === '4K' ? '4k' : 'hd'}`}>{channel.q}</span>
                    {active ? <div className="live-dot"></div> : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ height: '10px' }} />
        </div>

        <div id="mini-player" onClick={() => openPlayer(currentIdx)}>
          <div className="mp-top">
            <div className="mp-thumb" id="mp-thumb">{activeChannel?.emoji || '⚽'}</div>
            <div className="mp-info">
              <div className="mp-ch" id="mp-ch">{activeChannel?.name || 'Unknown Channel'}</div>
              <div className="mp-prog" id="mp-prog">{activeChannel?.prog || 'Live Stream'}</div>
            </div>
            <div className="mp-controls">
              <div className="mp-btn" onClick={(event) => { event.stopPropagation(); prevCh(); }}>⏮</div>
              <div className="mp-btn mp-play" id="mp-play-btn" onClick={(event) => { event.stopPropagation(); togglePlay(); }}>{isPlaying ? '⏸' : '▶'}</div>
              <div className="mp-btn" onClick={(event) => { event.stopPropagation(); nextCh(); }}>⏭</div>
            </div>
          </div>
          <div className="mp-progress">
            <div className="mp-track"><div className="mp-fill" id="mp-fill" style={{ width: isPlaying ? '38%' : '0%' }}><div className="mp-thumb-dot" /></div></div>
            <div className="mp-times"><span id="mp-time">LIVE</span><span id="mp-dur">● ON AIR</span></div>
          </div>
        </div>
      </div>

      <div ref={playerStageRef} className={`screen ${navActive === 'player' ? 'active' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`} id="screen-player" style={{ background: '#000' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className={`player-video-area ${fitMode === 'stretch' ? 'stretch-mode' : ''}`} id="player-video">
            <video ref={videoRef} id="live-video" playsInline muted autoPlay controls preload="metadata" style={playerStyle} />
            <div className="player-live-badge"><div className="player-live-dot" /> LIVE</div>
            <div className="player-fit-indicator is-active" id="player-fit-indicator">{VIDEO_MODE_LABELS[fitMode] || 'ORI'}</div>
            <div className="player-mode-controls" aria-label="Video mode controls">
              <button className="player-zoom-btn player-fit-btn is-active" type="button" onClick={cycleVideoMode} aria-label={`Switch video mode: ${VIDEO_MODE_LABELS[VIDEO_MODE_ORDER[(VIDEO_MODE_ORDER.indexOf(fitMode) + 1) % VIDEO_MODE_ORDER.length]] || 'next'}`}>⟳</button>
            </div>
            {isFullscreen ? (
              <div className="player-fullscreen-controls" aria-label="Fullscreen video controls">
                <button className="player-zoom-btn" type="button" onClick={zoomOutVideo} aria-label="Zoom out">−</button>
                <button className="player-zoom-btn" type="button" onClick={resetVideoZoom} aria-label="Reset zoom">◌</button>
                <button className="player-zoom-btn" type="button" onClick={zoomInVideo} aria-label="Zoom in">+</button>
                <button className="player-zoom-btn" type="button" onClick={prevCh} aria-label="Previous channel">⏮</button>
                <button className={`player-zoom-btn player-fullscreen-btn ${isFullscreen ? 'is-active' : ''}`} type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? '⤫' : '⛶'}</button>
                <button className="player-zoom-btn" type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause video' : 'Play video'}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="player-zoom-btn" type="button" onClick={nextCh} aria-label="Next channel">⏭</button>
                <button className="player-zoom-btn" type="button" onClick={() => showToast('🔇 Muted')} aria-label="Mute video">🔇</button>
              </div>
            ) : null}
            <div className="player-back" onClick={goBack}>✕</div>
          </div>
          <div style={{ background: 'var(--surface)', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <div className="player-info-bar">
              <div className="pib-row">
                <div>
                  <div className="pib-ch" id="player-ch-name">{activeChannel?.name || 'Unknown Channel'}</div>
                  <div className="pib-prog" id="player-prog-name">{activeChannel?.prog || 'Live Stream'} · Live</div>
                </div>
                <div className="pib-actions">
                  <div className="pib-act" onClick={() => showToast('❤️ Added to favorites')}>♡</div>
                  <div className="pib-act" onClick={() => showToast('📤 Link copied')}>⬆</div>
                </div>
              </div>
            </div>
            <div className="player-progress">
              <div className="pp-track"><div className="pp-fill" id="pp-fill" style={{ width: isPlaying ? '38%' : '0%' }}><div className="pp-dot" /></div></div>
              <div className="pp-times"><span id="pp-time">LIVE</span><span>● ON AIR</span></div>
            </div>
            <div className="player-controls-main">
              <div className="pc-btn" onClick={() => showToast('📺 Quality: Auto')}>⚙</div>
              <div className="pc-btn" onClick={prevCh}>⏮</div>
              <div className="pc-btn pc-play" id="player-play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</div>
              <div className="pc-btn" onClick={nextCh}>⏭</div>
              <div className="pc-btn" onClick={() => showToast('🔇 Muted')}>🔊</div>
              <button className={`pc-btn ${isFullscreen ? 'is-active' : ''}`} type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? '⤫' : '⛶'}</button>
            </div>
            <div className="player-next-list">
              <div className="pnl-title">Up Next</div>
              <div id="player-next-list">
                {nextList.map((channel) => {
                  const index = channels.indexOf(channel)
                  return (
                    <div key={`${channel.name}-${index}`} className="pnl-row" onClick={() => openPlayer(index)}>
                      <div className="pnl-icon" style={{ background: channel.bg }}>{channel.emoji}</div>
                      <div className="pnl-info">
                        <div className="pnl-name">{channel.name}</div>
                        <div className="pnl-prog">{channel.prog}</div>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: '14px' }}>▶</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`screen ${navActive === 'epg' ? 'active' : ''}`} id="screen-epg">
        <div className="status-bar"><span id="clock2">{clock}</span></div>
        <div className="app-header"><div className="logo">TV <em>GUIDE</em></div></div>
        <div className="epg-day-tabs" id="epg-days">
          {EPG_DAYS.map((day, index) => (
            <div key={day} className={`epg-day ${index === epgDayIndex ? 'active' : ''}`} onClick={() => setEpgDayIndex(index)}>
              {day}
              {index > 1 ? <div className="epg-day-name">Apr {3 + index}</div> : null}
            </div>
          ))}
        </div>
        <div className="epg-grid" id="epg-grid">
          {epgChannels.map((channel, channelIndex) => {
            const programs = EPG_PROGRAMS[channelIndex % 4]
            return (
              <div key={`${channel.name}-${channelIndex}`} className="epg-ch-row">
                <div className="epg-ch-head">
                  <div className="epg-ch-ico" style={{ background: channel.bg }}>{channel.emoji}</div>
                  <div className="epg-ch-nm">{channel.name}</div>
                </div>
                <div className="epg-slots">
                  {EPG_TIMES.map((time, timeIndex) => (
                    <div key={`${time}-${timeIndex}`} className={`epg-slot ${timeIndex === 1 ? 'now' : ''}`}>
                      <div className="epg-time">{time}</div>
                      <div className="epg-prog-name">{programs[timeIndex] || 'TBA'}</div>
                      {timeIndex === 1 ? <div className="epg-now-tag">▶ NOW</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`screen ${navActive === 'playlist' ? 'active' : ''}`} id="screen-playlist">
        <div className="status-bar"><span id="clock3">{clock}</span></div>
        <div className="app-header"><div className="logo">ADD <em>LIST</em></div></div>
        <div className="m3u-form">
          <div className="form-section">
            <div className="form-label">M3U Playlist URL</div>
            <input className="form-input" type="url" id="m3u-url" placeholder="http://your-provider.com/playlist.m3u" value={playlistUrl} onChange={(event) => setPlaylistUrl(event.target.value)} />
            <div style={{ marginTop: '10px' }}>
              <div className="form-label">Sample lists</div>
              <div className="chips-wrap">
                {SAMPLE_PLAYLISTS.map((item) => (
                  <div key={item.label} className="sample-chip" onClick={() => setUrl(item.url)}>{item.label}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="form-section">
            <div className="form-label">Or enter Xtream Codes</div>
            <input className="form-input" type="text" id="xt-server" placeholder="Server URL" style={{ marginBottom: '8px' }} />
            <input className="form-input" type="text" id="xt-user" placeholder="Username" style={{ marginBottom: '8px' }} />
            <input className="form-input" type="password" id="xt-pass" placeholder="Password" />
          </div>
          <button className="btn-primary" onClick={() => loadPlaylist()}>▶ {loading ? 'LOADING...' : 'LOAD PLAYLIST'}</button>
          <button className="btn-secondary" onClick={() => showToast('📁 File picker not available in browser')}>📁 OPEN FROM FILES</button>
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Supports M3U, M3U8, Xtream Codes API</div>
        </div>
      </div>

      <div className={`screen ${navActive === 'settings' ? 'active' : ''}`} id="screen-settings">
        <div className="status-bar"><span id="clock4">{clock}</span></div>
        <div className="app-header"><div className="logo">SET<em>TINGS</em></div></div>
        <div className="settings-list">
          <div className="settings-group">
            <div className="settings-item">
              <span className="si-icon">🎨</span>
              <div className="si-info"><div className="si-label">Theme</div><div className="si-sub">Dark (default)</div></div>
              <span className="si-right">›</span>
            </div>
            <div className="settings-item">
              <span className="si-icon">🌐</span>
              <div className="si-info"><div className="si-label">Language</div><div className="si-sub">English</div></div>
              <span className="si-right">›</span>
            </div>
            <div className="settings-item" onClick={() => { toggleSetting('parental'); showToast('Parental controls toggled') }}>
              <span className="si-icon">🔒</span>
              <div className="si-info"><div className="si-label">Parental Controls</div><div className="si-sub">PIN protect adult content</div></div>
              <div className={`toggle ${toggles.parental ? 'on' : ''}`} />
            </div>
          </div>
          <div className="settings-group">
            <div className="settings-item" onClick={() => toggleSetting('hardware')}>
              <span className="si-icon">📱</span>
              <div className="si-info"><div className="si-label">Hardware Decoding</div><div className="si-sub">Better performance</div></div>
              <div className={`toggle ${toggles.hardware ? 'on' : ''}`} />
            </div>
            <div className="settings-item">
              <span className="si-icon">📶</span>
              <div className="si-info"><div className="si-label">Stream Quality</div><div className="si-sub">Auto (recommended)</div></div>
              <span className="si-right">›</span>
            </div>
            <div className="settings-item" onClick={() => toggleSetting('cache')}>
              <span className="si-icon">💾</span>
              <div className="si-info"><div className="si-label">Cache Streams</div><div className="si-sub">Faster channel switching</div></div>
              <div className={`toggle ${toggles.cache ? 'on' : ''}`} />
            </div>
          </div>
          <div className="settings-group">
            <div className="settings-item" onClick={() => toggleSetting('compact')}>
              <span className="si-icon">📅</span>
              <div className="si-info"><div className="si-label">Compact Layout</div><div className="si-sub">Denser screens for landscape</div></div>
              <div className={`toggle ${toggles.compact ? 'on' : ''}`} />
            </div>
            <div className="settings-item" onClick={() => showToast('Version 2.0') }>
              <span className="si-icon">ℹ️</span>
              <div className="si-info"><div className="si-label">About</div><div className="si-sub">PlayTV IPTV Player</div></div>
              <span className="si-right">›</span>
            </div>
          </div>
        </div>
      </div>

      <nav id="bottom-nav">
        <div className={`nav-btn ${navActive === 'home' ? 'active' : ''}`} onClick={() => switchNav('home')} data-screen="screen-home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          <span>Home</span>
          <div className="nav-dot" />
        </div>
        <div className={`nav-btn ${navActive === 'epg' ? 'active' : ''}`} onClick={() => switchNav('epg')} data-screen="screen-epg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>Guide</span>
          <div className="nav-dot" />
        </div>
        <div className={`nav-btn ${navActive === 'playlist' ? 'active' : ''}`} onClick={() => switchNav('playlist')} data-screen="screen-playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
          <span>Playlist</span>
          <div className="nav-dot" />
        </div>
        <div className={`nav-btn ${navActive === 'settings' ? 'active' : ''}`} onClick={() => switchNav('settings')} data-screen="screen-settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          <span>Settings</span>
          <div className="nav-dot" />
        </div>
      </nav>

      <div id="toast" className={toast ? 'show' : ''}>{toast}</div>
    </div>
  )
}
