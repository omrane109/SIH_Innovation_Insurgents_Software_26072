'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BrainCircuit, CloudLightning, Download, Layers, Navigation, Radar, RefreshCw, Satellite, ShieldAlert, Zap, Cpu, Crosshair } from 'lucide-react'
import type { PublicFusion } from '@/lib/server/fusion/engine'
import { rleDecode } from '@/lib/fusion/rle'

type T = (s: string) => string
const CITIES = { mumbai: 'Mumbai', pune: 'Pune', delhi: 'Delhi', bengaluru: 'Bengaluru', chennai: 'Chennai', hyderabad: 'Hyderabad', kolkata: 'Kolkata', ahmedabad: 'Ahmedabad', jaipur: 'Jaipur', lucknow: 'Lucknow', guwahati: 'Guwahati', bhopal: 'Bhopal', kochi: 'Kochi' } as const
type City = keyof typeof CITIES
type Layer = 'radar' | 'thunderstorm' | 'lightning'
type Verification = { metrics: Record<'thunderstorm' | 'lightning' | 'rain', Record<string, { n: number; positives: number; pod: number | null; far: number | null; csi: number | null; brier: number | null; brierSkill: number | null; baselineCsi: number | null; baselineBrier: number | null }>>; labels: Record<string, string> }

const HZ = [30, 60, 120, 180, 360] as const
const TILE = 256, TILES = 3, SIZE = TILE * TILES
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
const pct = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${Math.round(v * 100)}%`)
const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d))
const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

function dbzColour(v: number): [number, number, number, number] {
  if (v < 8) return [0, 0, 0, 0]
  if (v < 15) return [120, 200, 255, 110]
  if (v < 20) return [60, 150, 245, 150]
  if (v < 25) return [30, 110, 230, 170]
  if (v < 30) return [40, 200, 80, 190]
  if (v < 35) return [20, 150, 40, 200]
  if (v < 40) return [230, 230, 40, 215]
  if (v < 45) return [250, 190, 20, 225]
  if (v < 50) return [250, 120, 20, 235]
  if (v < 55) return [230, 30, 30, 240]
  if (v < 60) return [170, 0, 30, 245]
  return [220, 60, 230, 250]
}
function probColour(p: number): [number, number, number, number] {
  if (p < 10) return [0, 0, 0, 0]
  if (p < 20) return [255, 235, 60, 55]
  if (p < 40) return [255, 190, 40, 130]
  if (p < 60) return [255, 120, 30, 165]
  if (p < 80) return [235, 40, 40, 190]
  return [170, 20, 170, 210]
}
const LEVEL = { green: 'var(--green)', yellow: '#f5d142', orange: 'var(--orange)', red: 'var(--rose)' } as const

export function FusionNowcast({ t, mode = 'full', initialCity = 'mumbai' }: { t: T; mode?: 'full' | 'alerts' | 'compact'; initialCity?: City }) {
  const [city, setCity] = useState<City>(initialCity)
  const [custom, setCustom] = useState<{ lat: number; lon: number } | { pincode: string } | null>(null)
  const [coordText, setCoordText] = useState('')
  const [data, setData] = useState<PublicFusion | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [layer, setLayer] = useState<Layer>('thunderstorm')
  const [frame, setFrame] = useState(0)
  const [horizon, setHorizon] = useState<30 | 60 | 120 | 180 | 360>(60)
  const [show, setShow] = useState({ cells: true, vectors: true, cold: false, strikes: true, basemap: true })
  const [probe, setProbe] = useState<null | { lat: number; lon: number; ts: number; ltg: number; dbz: number }>(null)
  const [capXml, setCapXml] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tilesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [tilesReady, setTilesReady] = useState(0)

  const query = !custom ? `city=${city}` : 'pincode' in custom ? `pincode=${custom.pincode}` : `lat=${custom.lat.toFixed(4)}&lon=${custom.lon.toFixed(4)}`
  const load = useCallback(async (refresh = false, signal?: AbortSignal) => {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/fusion-nowcast?${query}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store', signal })
      const j = await res.json()
      if (!res.ok) throw Error(j.error || 'Nowcast unavailable')
      if (!signal?.aborted) { setData(j); setProbe(null); const obs = (j as PublicFusion).radarFrames.filter(f => f.kind === 'observed').length; setFrame(Math.max(0, obs - 1)) }
      fetch('/api/fusion-nowcast/verification', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(v => v && setVerification(v)).catch(() => {})
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Nowcast unavailable') }
    finally { if (!signal?.aborted) setBusy(false) }
  }, [query])
  useEffect(() => { const c = new AbortController(); load(false, c.signal); const id = setInterval(() => load(false), 5 * 60_000); return () => { c.abort(); clearInterval(id) } }, [load])
  useEffect(() => {
    if (mode !== 'alerts') return
    fetch(`/api/fusion-nowcast/cap?${query}`, { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(setCapXml).catch(() => setCapXml(''))
  }, [mode, query, data?.issuedAt])

  // Basemap tiles (same zoom-7 Web-Mercator tiles as the radar grid → exact alignment)
  useEffect(() => {
    if (!data) return
    const dark = typeof document !== 'undefined' && document.documentElement.dataset.theme !== 'light'
    const style = dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'
    for (let j = 0; j < TILES; j++) for (let i = 0; i < TILES; i++) {
      const x = data.domain.tileX0 + i, y = data.domain.tileY0 + j, key = `${style}/${x}/${y}`
      if (tilesRef.current.has(key)) continue
      // Keyless basemap: Esri Canvas (no API key); falls back to OpenStreetMap standard tiles if Esri is unreachable.
      // Pixels are never read back from the canvas, so no CORS mode is needed.
      const img = new Image()
      img.onload = () => setTilesReady(v => v + 1)
      img.onerror = () => { if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = `https://tile.openstreetmap.org/${data.domain.zoom}/${x}/${y}.png` } }
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${style}/MapServer/tile/${data.domain.zoom}/${y}/${x}`
      tilesRef.current.set(key, img)
    }
  }, [data])

  const frames = data?.radarFrames ?? []
  const current = frames[frame]
  const grids = useMemo(() => {
    if (!data) return null
    const g: Record<string, Uint8Array> = {}
    for (const [k, v] of Object.entries(data.probGrids)) g[k] = rleDecode(v, data.domain.probGrid ** 2)
    return g
  }, [data])
  const radarGrid = useMemo(() => (current && data ? rleDecode(current.dbz, data.domain.grid ** 2) : null), [current, data])
  const coldGrid = useMemo(() => (data?.satOverlay ? rleDecode(data.satOverlay, data.domain.grid ** 2) : null), [data])

  // Draw
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !data) return
    const ctx = cv.getContext('2d')!; ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.fillStyle = getComputedStyle(cv).getPropertyValue('--surface-2') || '#122637'; ctx.fillRect(0, 0, SIZE, SIZE)
    const dark = document.documentElement.dataset.theme !== 'light', style = dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'
    if (show.basemap) for (let j = 0; j < TILES; j++) for (let i = 0; i < TILES; i++) {
      const img = tilesRef.current.get(`${style}/${data.domain.tileX0 + i}/${data.domain.tileY0 + j}`)
      if (img?.complete && img.naturalWidth) ctx.drawImage(img, i * TILE, j * TILE, TILE, TILE)
    }
    const paint = (grid: Uint8Array, n: number, colour: (v: number) => [number, number, number, number]) => {
      const off = document.createElement('canvas'); off.width = n; off.height = n
      const oc = off.getContext('2d')!, im = oc.createImageData(n, n)
      for (let i = 0; i < n * n; i++) { const [r, g, b, a] = colour(grid[i]); im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = a }
      oc.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = n < 100; ctx.drawImage(off, 0, 0, SIZE, SIZE)
    }
    if (show.cold && coldGrid) paint(coldGrid, data.domain.grid, v => (v >= 60 ? [230, 80, 255, 120] : v >= 40 ? [120, 200, 255, 80] : [0, 0, 0, 0]))
    if (layer === 'radar' && radarGrid) paint(radarGrid, data.domain.grid, dbzColour)
    if (layer !== 'radar' && grids) { const g = grids[`${layer}_${horizon}`]; if (g) paint(g, data.domain.probGrid, probColour) }
    const s = SIZE / data.domain.grid
    if (show.vectors) {
      ctx.strokeStyle = ctx.fillStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(20,40,60,.6)'; ctx.lineWidth = 1.4
      for (const v of data.motion.vectors) {
        const x = v.gx * s, y = v.gy * s, dx = v.u * 30 * s, dy = v.v * 30 * s
        if (Math.hypot(dx, dy) < 2) continue
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke()
        const a = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx - 6 * Math.cos(a - .4), y + dy - 6 * Math.sin(a - .4)); ctx.lineTo(x + dx - 6 * Math.cos(a + .4), y + dy - 6 * Math.sin(a + .4)); ctx.closePath(); ctx.fill()
      }
    }
    const project = (lat: number, lon: number) => {
      const z = 2 ** data.domain.zoom, r = (lat * Math.PI) / 180
      return { x: (((lon + 180) / 360) * z - data.domain.tileX0) * TILE, y: (((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * z - data.domain.tileY0) * TILE }
    }
    if (show.strikes) { ctx.fillStyle = '#ffe14a'; for (const st of data.strikes) { const p = project(st.lat, st.lon); ctx.fillRect(p.x - 2, p.y - 2, 4, 4) } }
    if (show.cells) for (const c of data.cells) {
      const x = c.gx * s, y = c.gy * s
      ctx.strokeStyle = c.severity === 'severe' ? '#ff4d6d' : c.severity === 'strong' ? '#ff9f43' : '#ffd23f'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c.u * 60 * s, y + c.v * 60 * s); ctx.stroke(); ctx.setLineDash([])
      ctx.font = 'bold 11px Arial'; ctx.fillStyle = dark ? '#fff' : '#102030'; ctx.fillText(c.id, x + 11, y - 8)
    }
    const tp = project(data.target.lat, data.target.lon)
    ctx.strokeStyle = '#42c7ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tp.x, tp.y, (10 / data.domain.cellKm) * s, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#42c7ee'; ctx.beginPath(); ctx.arc(tp.x, tp.y, 4, 0, Math.PI * 2); ctx.fill()
    ctx.font = 'bold 12px Arial'; ctx.fillStyle = dark ? '#fff' : '#102030'; ctx.fillText(data.target.name, tp.x + 8, tp.y + 16)
    if (probe) { const p = project(probe.lat, probe.lon); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 6, p.y - 6, 12, 12) }
  }, [data, radarGrid, grids, coldGrid, layer, horizon, show, tilesReady, probe])

  const onMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data || !grids) return
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * SIZE, py = ((e.clientY - r.top) / r.height) * SIZE
    const z = 2 ** data.domain.zoom, X = data.domain.tileX0 + px / TILE, Y = data.domain.tileY0 + py / TILE
    const lon = (X / z) * 360 - 180, nn = Math.PI - (2 * Math.PI * Y) / z, lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(nn) - Math.exp(-nn)))
    const pg = data.domain.probGrid, gi = Math.min(pg - 1, Math.floor((py / SIZE) * pg)) * pg + Math.min(pg - 1, Math.floor((px / SIZE) * pg))
    const rg = data.domain.grid, ri = Math.min(rg - 1, Math.floor((py / SIZE) * rg)) * rg + Math.min(rg - 1, Math.floor((px / SIZE) * rg))
    setProbe({ lat, lon, ts: grids[`thunderstorm_${horizon}`][gi], ltg: grids[`lightning_${horizon}`][gi], dbz: radarGrid ? radarGrid[ri] : 0 })
  }
  const useCoords = () => {
    const pin = coordText.trim().match(/^[1-9][0-9]{5}$/)
    if (pin) { setCustom({ pincode: pin[0] }); return }
    const m = coordText.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
    if (!m) { setError(t('Enter a 6-digit PIN code (e.g. 400001) or coordinates as lat, lon (e.g. 19.07, 72.88)')); return }
    setCustom({ lat: Number(m[1]), lon: Number(m[2]) })
  }

  const sel = data?.point.find(p => p.minutes === horizon)
  const statusOf = (s: { status: string }) => s.status === 'live' || s.status === 'measured_feed'
  const srcIcon = { radar: Radar, satellite: Satellite, lightning: Zap, nwp: Cpu } as const
  const srcLabel = { radar: 'Multi-radar mosaic', satellite: 'Satellite IR', lightning: 'Lightning network', nwp: 'NWP model' } as const

  return <section className="route-card fx-card">
    <div className="card-head">
      <div><span className="section-kicker">{t('SIH26072 · AI/ML MULTI-SOURCE NOWCAST · 0–3 HOURS')}</span><h2>{t('Thunderstorm & Lightning Fusion Nowcast')}</h2>
        <p className="muted-copy">{t('Radar extrapolation (optical flow) + satellite cloud-top + lightning + NWP instability fused by an online-learning ML model.')}</p></div>
      <div className="fx-controls">
        <select value={custom ? '' : city} onChange={e => { setCustom(null); setCity(e.target.value as City) }} aria-label={t('City')}>
          {custom && <option value="">{'pincode' in custom ? `PIN ${custom.pincode}` : t('Custom point')}</option>}
          {Object.entries(CITIES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
        {<span className="fx-coord"><input value={coordText} onChange={e => setCoordText(e.target.value)} onKeyDown={e => e.key === 'Enter' && useCoords()} placeholder="400001 or 19.07, 72.88" aria-label={t('Coordinates')}/><button className="outline-button" onClick={useCoords}><Crosshair size={14}/></button></span>}
        <button className="primary-button" onClick={() => load(true)} disabled={busy}><RefreshCw size={14} className={busy ? 'fx-spin' : ''}/>{busy ? t('Running…') : t('Run nowcast')}</button>
      </div>
    </div>

    {error && <div className="fx-error"><AlertTriangle size={16}/>{error}</div>}
    {!data && !error && <div className="fx-loading">{t('Fetching radar frames, satellite imagery and NWP fields…')}</div>}

    {data && <>
      <div className="fx-alert" style={{ borderColor: LEVEL[data.alert.level], background: `color-mix(in srgb, ${LEVEL[data.alert.level]} 14%, transparent)` }}>
        <ShieldAlert size={22} style={{ color: LEVEL[data.alert.level] }}/>
        <div><strong>{data.alert.level.toUpperCase()} · {t(data.alert.label)} — {data.target.name}</strong><span>{t(data.alert.action)}</span></div>
        <small>{t('Issued')} {fmtTime(data.issuedAt)} IST · {t('model')} {data.model.id} ({t(data.model.source.replace(/_/g, ' '))})</small>
      </div>

      <div className="fx-sources">
        {(Object.keys(srcLabel) as Array<keyof typeof srcLabel>).map(k => {
          const s = data.sources[k] as Record<string, unknown> & { status: string }, Icon = srcIcon[k], ok = statusOf(s)
          const detail = k === 'radar' && ok ? `${s.frames} ${t('frames')} · ${fmtTime(String(s.latest))} (${s.ageMinutes} ${t('min old')})` :
            k === 'satellite' && ok ? `Himawari-9 B13 · ${fmtTime(String(s.time))}${s.coolingRate ? ' · ' + t('cooling rate') : ''}` :
            k === 'lightning' ? (ok ? `${s.strikes30min} ${t('strikes / 30 min')}` : t('No measured feed — proxies used')) :
            k === 'nwp' && ok ? `${s.points} ${t('grid points')} · GFS${String(s.model).includes('ECMWF') ? ' + ECMWF' : ''}` : t('Unavailable')
          return <div key={k} className={`fx-src ${ok ? 'ok' : 'off'}`}><Icon size={16}/><div><b>{t(srcLabel[k])}</b><small>{detail}</small></div><i/></div>
        })}
      </div>

      <div className={mode === 'compact' ? 'fx-grid compact' : 'fx-grid'}>
        <div className="fx-map-wrap">
          <div className="fx-toolbar">
            <div className="fx-seg">{(['thunderstorm', 'lightning', 'radar'] as Layer[]).map(l => <button key={l} className={layer === l ? 'on' : ''} onClick={() => setLayer(l)}>{l === 'radar' ? <><Radar size={13}/> {t('Radar dBZ')}</> : l === 'thunderstorm' ? <><CloudLightning size={13}/> {t('P(thunderstorm)')}</> : <><Zap size={13}/> {t('P(lightning)')}</>}</button>)}</div>
            {layer === 'radar'
              ? <label className="fx-slider">{current ? `${current.kind === 'observed' ? t('Observed') : t('Forecast')} ${current.lead > 0 ? '+' : ''}${current.lead} min · ${fmtTime(current.validAt)}` : ''}<input type="range" min={0} max={Math.max(0, frames.length - 1)} value={frame} onChange={e => setFrame(Number(e.target.value))}/></label>
              : <div className="fx-seg">{HZ.map(h => <button key={h} className={horizon === h ? 'on' : ''} onClick={() => setHorizon(h)}>{t('next')} {h}′</button>)}</div>}
          </div>
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="fx-map" onClick={onMapClick}/>
          <div className="fx-toggles"><Layers size={13}/>{(['cells', 'vectors', 'cold', 'strikes', 'basemap'] as const).map(k => <label key={k}><input type="checkbox" checked={show[k]} onChange={e => setShow({ ...show, [k]: e.target.checked })}/>{t({ cells: 'Storm cells', vectors: 'Motion vectors', cold: 'Cold cloud tops', strikes: 'Strikes', basemap: 'Basemap' }[k])}</label>)}</div>
          <div className="fx-legend">{layer === 'radar' ? [15, 25, 35, 40, 45, 50, 55, 60].map(v => <span key={v} style={{ background: `rgba(${dbzColour(v).slice(0, 3).join(',')})` }}>{v}</span>) : [10, 30, 50, 70, 90].map(v => <span key={v} style={{ background: `rgba(${probColour(v).slice(0, 3).join(',')})` }}>{v}%</span>)}</div>
          {probe && <div className="fx-probe"><Crosshair size={13}/> {probe.lat.toFixed(3)}, {probe.lon.toFixed(3)} · {t('next')} {horizon} min: <b>P(TS) {probe.ts}%</b> · <b>P(LTG) {probe.ltg}%</b>{layer === 'radar' ? ` · ${probe.dbz} dBZ` : ''}</div>}
          <small className="fx-attr">Radar © RainViewer · Satellite: NASA GIBS / JMA Himawari-9 · NWP: Open-Meteo (NOAA GFS, ECMWF) · Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors</small>
        </div>

        <div className="fx-side">
          <div className="fx-probs">
            <div className="fx-probs-head"><span>{t('Within 10 km of')} {data.target.name}</span><span>{t('Thunderstorm')}</span><span>{t('Lightning')}</span><span>{t('Radar-only')}</span></div>
            {data.point.map(p => <button key={p.minutes} className={`fx-prob-row ${horizon === p.minutes ? 'on' : ''}`} onClick={() => setHorizon(p.minutes as 30 | 60 | 120 | 180 | 360)}>
              <span>{t('next')} {p.minutes} min</span>
              <span className="fx-bar"><i style={{ width: `${p.thunderstorm * 100}%`, background: p.thunderstorm >= .6 ? 'var(--rose)' : p.thunderstorm >= .3 ? 'var(--amber)' : 'var(--green)' }}/><b>{pct(p.thunderstorm)}</b></span>
              <span className="fx-bar"><i style={{ width: `${p.lightning * 100}%`, background: p.lightning >= .55 ? 'var(--rose)' : p.lightning >= .3 ? 'var(--amber)' : 'var(--green)' }}/><b>{pct(p.lightning)}</b></span>
              <span className="fx-muted">{pct(p.radarOnly)}</span>
            </button>)}
          </div>
          {sel && <div className="fx-drivers"><span className="section-kicker"><BrainCircuit size={12}/> {t('WHY — TOP MODEL DRIVERS')} ({t('next')} {horizon} min)</span>
            {sel.drivers.map(dv => <div key={dv.feature} className="fx-driver"><span>{dv.feature.replace(/_/g, ' ')}</span><i className={dv.contribution >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.min(100, Math.abs(dv.contribution) * 28)}%` }}/><b>{dv.contribution >= 0 ? '+' : ''}{dv.contribution.toFixed(2)}</b></div>)}
          </div>}
          <div className="fx-motion"><Navigation size={15} style={{ transform: `rotate(${data.motion.meanHeadingDeg}deg)` }}/> {t('Storm motion')}: <b>{data.motion.meanSpeedKmh} km/h {t('towards')} {compass(data.motion.meanHeadingDeg)}</b> · {t('source')}: {t(data.motion.source.replace(/_/g, ' '))} ({data.motion.vectorsFromRadar} {t('radar vectors')}) · {t('growth')} {data.motion.growthDbzPer10Min >= 0 ? '+' : ''}{data.motion.growthDbzPer10Min} dBZ/10 min</div>
          {data.nwpAtTarget && <div className="fx-nwp">
            <div><small>CAPE</small><b>{data.nwpAtTarget.cape === null ? '—' : Math.round(data.nwpAtTarget.cape)}</b><small>J/kg</small></div>
            <div><small>{t('Lifted index')}</small><b>{num(data.nwpAtTarget.liftedIndex, 1)}</b><small>°C</small></div>
            <div><small>K-index</small><b>{num(data.nwpAtTarget.kIndex, 0)}</b><small>°C</small></div>
            <div><small>CIN</small><b>{data.nwpAtTarget.cin === null ? '—' : Math.round(data.nwpAtTarget.cin)}</b><small>J/kg</small></div>
            <div><small>{t('0–6 km shear')}</small><b>{num(data.nwpAtTarget.shearMs, 0)}</b><small>m/s</small></div>
          </div>}
        </div>
      </div>

      {mode !== 'compact' && <div className="fx-section">
        <span className="section-kicker">{t('TRACKED STORM CELLS (≥40 dBZ)')}</span>
        {data.cells.length === 0 ? <p className="muted-copy">{t('No convective radar cells (≥40 dBZ) in the ~870 km domain right now.')}</p> :
          <div className="fx-table-wrap"><table className="fx-table"><thead><tr><th>ID</th><th>{t('Max dBZ')}</th><th>{t('Area km²')}</th><th>{t('Motion')}</th><th>{t('Trend')}</th><th>{t('Cloud top')}</th><th>{t('Distance')}</th><th>{t('ETA (≤15 km)')}</th></tr></thead>
            <tbody>{data.cells.slice(0, 12).map(c => <tr key={c.id}><td><b>{c.id}</b></td><td className={`sev-${c.severity}`}>{c.maxDbz}</td><td>{c.areaKm2}</td><td>{c.speedKmh} km/h {compass(c.headingDeg)}</td><td>{t(c.trend)}{c.dbzChange !== null ? ` (${c.dbzChange >= 0 ? '+' : ''}${c.dbzChange})` : ''}</td><td>{c.minCloudTopC === null ? '—' : `${c.minCloudTopC} °C`}</td><td>{c.distanceKm} km</td><td>{c.etaMinutes === null ? t('not approaching') : <b>{c.etaMinutes} min</b>}</td></tr>)}</tbody></table></div>}
      </div>}

      {mode === 'alerts' && <div className="fx-section">
        <div className="fx-cap-head"><span className="section-kicker">{t('CAP v1.2 ALERT DRAFT — FORECASTER REVIEW REQUIRED')}</span>
          <a className="outline-button" href={`/api/fusion-nowcast/cap?${query}`} download={`vajra-cap-${custom ? 'point' : city}.xml`}><Download size={14}/>{t('Download CAP XML')}</a></div>
        <pre className="fx-cap">{capXml || t('Generating…')}</pre>
      </div>}

      {mode === 'full' && <div className="fx-section">
        <span className="section-kicker">{t('MODEL & VERIFICATION (online learning against observed radar / lightning)')}</span>
        <p className="muted-copy">{t('Model')}: <b>{data.model.id}</b> · {t('status')}: <b>{t(data.model.source.replace(/_/g, ' '))}</b> · {t('verified samples learned')}: <b>{data.model.updates.thunderstorm}</b>{data.model.lastUpdate ? ` · ${t('last update')} ${fmtTime(data.model.lastUpdate)} IST` : ''} · {t('store')}: {data.learning.storage}{data.learning.error ? ` (${data.learning.error})` : ''}</p>
        {verification && <div className="fx-table-wrap"><table className="fx-table"><thead><tr><th>{t('Hazard')}</th><th>{t('Window')}</th><th>N</th><th>{t('Events')}</th><th>POD</th><th>FAR</th><th>CSI</th><th>{t('CSI radar-only')}</th><th>Brier</th><th>{t('Brier radar-only')}</th><th>BSS</th></tr></thead>
          <tbody>{(['thunderstorm', 'lightning', 'rain'] as const).flatMap(hz => HZ.map(h => { const v = verification.metrics[hz]?.[h]; if (!v) return null; return <tr key={hz + h}><td>{t(hz)}</td><td>{h} min</td><td>{v.n}</td><td>{v.positives}</td><td>{pct(v.pod)}</td><td>{pct(v.far)}</td><td><b>{num(v.csi)}</b></td><td>{num(v.baselineCsi)}</td><td>{num(v.brier, 3)}</td><td>{num(v.baselineBrier, 3)}</td><td>{num(v.brierSkill)}</td></tr> }))}</tbody></table></div>}
        <p className="fx-note">{t('Verification fills automatically as forecast windows elapse (run the 10-minute scheduler). Labels: thunderstorm = observed radar ≥40 dBZ within 10 km; lightning = measured strike within 10 km, or radar ≥45 dBZ proxy when no strike feed is configured. Research prototype — not an official IMD warning.')}</p>
      </div>}
    </>}
  </section>
}
