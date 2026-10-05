'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BrainCircuit, Clock, Database, RefreshCw, ShieldAlert } from 'lucide-react'

type T = (s: string) => string
type HistoryPoint = { t: string; radarAt: string | null; ts60: number; ts180: number; ts360?: number; ltg60: number; ltg180: number; rain180: number
  alert: string; cells: number; approaching: number; nearestCellKm: number | null; sources: { radar: boolean; satellite: boolean; lightning: boolean; nwp: boolean } }
type V = { n: number; positives: number; pod: number | null; far: number | null; csi: number | null; brier: number | null; baselineCsi: number | null; baselineBrier: number | null; brierSkill: number | null }
type Analytics = { generatedAt: string; storage: string; lastScheduledRun: string | null; pendingForecasts: number
  model: { id: string; source: string; updates: { thunderstorm: number; lightning: number; rain?: number }; lastUpdate: string | null }
  verification: Record<string, Record<string, V>>; history: Record<string, HistoryPoint[]> }

const NAMES: Record<string, string> = { mumbai: 'Mumbai', pune: 'Pune', delhi: 'Delhi', bengaluru: 'Bengaluru', chennai: 'Chennai', hyderabad: 'Hyderabad', kolkata: 'Kolkata', ahmedabad: 'Ahmedabad', jaipur: 'Jaipur', lucknow: 'Lucknow', guwahati: 'Guwahati', bhopal: 'Bhopal', kochi: 'Kochi' }
const SERIES = [
  { key: 'ts60' as const, label: 'Thunderstorm · next 1 h', color: 'var(--fxa-s1)' },
  { key: 'ts180' as const, label: 'Thunderstorm · next 3 h', color: 'var(--fxa-s2)' },
  { key: 'ltg60' as const, label: 'Lightning · next 1 h', color: 'var(--fxa-s3)' },
]
const ALERT = { green: { c: 'var(--green)', l: 'No alert' }, yellow: { c: '#f5d142', l: 'Watch' }, orange: { c: 'var(--orange)', l: 'Warning' }, red: { c: 'var(--rose)', l: 'Severe' } } as Record<string, { c: string; l: string }>
const time = (s: string) => new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const pct = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${Math.round(v * 100)}%`)
const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d))

function ProbabilityChart({ rows, t }: { rows: HistoryPoint[]; t: T }) {
  const W = 900, H = 260, L = 44, R = 175, TOP = 14, B = 30
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const t0 = Date.parse(rows[0].t), t1 = Math.max(t0 + 60_000, Date.parse(rows[rows.length - 1].t))
  const x = (s: string) => L + ((Date.parse(s) - t0) / (t1 - t0)) * (W - L - R)
  const y = (p: number) => TOP + (1 - p) * (H - TOP - B)
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const xTicks = Array.from({ length: 5 }, (_, i) => new Date(t0 + ((t1 - t0) * i) / 4).toISOString())
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W
    let best = 0, bd = Infinity; rows.forEach((row, i) => { const d = Math.abs(x(row.t) - px); if (d < bd) { bd = d; best = i } }); setHover(best)
  }
  const last = rows[rows.length - 1]
  // Direct end labels, nudged apart so they never collide
  const ends = SERIES.map(s => ({ ...s, y: y(last[s.key]) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14
  const h = hover !== null ? rows[hover] : null
  return <div className="fxa-chart">
    <div className="fxa-legend">{SERIES.map(s => <span key={s.key}><i style={{ background: s.color }} />{t(s.label)}</span>)}</div>
    <div className="fxa-plot">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Nowcast probability history')} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="fxa-grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="fxa-axis">{v * 100}%</text></g>)}
        {xTicks.map((s, i) => <text key={i} x={x(s)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="fxa-axis">{time(s)}</text>)}
        {SERIES.map(s => <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={rows.map(r => `${x(r.t).toFixed(1)},${y(r[s.key]).toFixed(1)}`).join(' ')} />)}
        {rows.length === 1 && SERIES.map(s => <circle key={s.key} cx={x(last.t)} cy={y(last[s.key])} r={4} fill={s.color} />)}
        {ends.map(s => <text key={s.key} x={W - R + 8} y={s.y + 4} className="fxa-endlabel">{t(s.label.split(' · ')[0])} {s.label.split(' · ')[1].replace('next ', '')}: {pct(last[s.key])}</text>)}
        {h && <g><line x1={x(h.t)} x2={x(h.t)} y1={TOP} y2={H - B} className="fxa-cross" />{SERIES.map(s => <circle key={s.key} cx={x(h.t)} cy={y(h[s.key])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}</g>}
      </svg>
      {h && <div className="fxa-tip" style={{ left: `${Math.min(70, (x(h.t) / W) * 100)}%` }}>
        <b>{time(h.t)} IST</b>
        {SERIES.map(s => <div key={s.key}><i style={{ background: s.color }} />{t(s.label)}<b>{pct(h[s.key])}</b></div>)}
        <div><i style={{ background: ALERT[h.alert]?.c }} />{t('Alert')}<b>{t(ALERT[h.alert]?.l ?? h.alert)}</b></div>
        <div>{t('Storm cells')}<b>{h.cells}{h.approaching ? ` (${h.approaching} ${t('approaching')})` : ''}</b></div>
      </div>}
    </div>
  </div>
}

export function FusionAnalytics({ t }: { t: T }) {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  const [loc, setLoc] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true); setError('')
    try { const r = await fetch('/api/fusion-nowcast/analytics', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw Error(j.error); setData(j) }
    catch (e) { setError(e instanceof Error ? e.message : 'Analytics unavailable') } finally { setBusy(false) }
  }
  useEffect(() => { load(); const id = setInterval(load, 5 * 60_000); return () => clearInterval(id) }, [])
  const locs = useMemo(() => Object.entries(data?.history ?? {}).filter(([, v]) => v.length).map(([k]) => k), [data])
  useEffect(() => { if (locs.length && !locs.includes(loc)) setLoc(locs.includes('mumbai') ? 'mumbai' : locs[0]) }, [locs, loc])
  const rows = (loc && data?.history[loc]) || []
  const alertCounts = rows.reduce<Record<string, number>>((a, r) => { a[r.alert] = (a[r.alert] ?? 0) + 1; return a }, {})
  const uptime = (k: keyof HistoryPoint['sources']) => (rows.length ? rows.filter(r => r.sources[k]).length / rows.length : null)
  const peak = rows.reduce<HistoryPoint | null>((m, r) => (!m || r.ts180 > m.ts180 ? r : m), null)

  return <section className="route-card fx-card fxa-root">
    <div className="card-head">
      <div><span className="section-kicker">{t('FUSION NOWCAST ANALYTICS · LIVE HISTORY & VERIFICATION')}</span><h2>{t('Nowcast analytics')}</h2>
        <p className="muted-copy">{t('Every 10-minute nowcast for tracked cities is archived here with its probabilities, alert level, storm cells and data-source availability.')}</p></div>
      <div className="fx-controls">
        {locs.length > 0 && <select value={loc} onChange={e => setLoc(e.target.value)} aria-label={t('Location')}>{locs.map(l => <option key={l} value={l}>{NAMES[l] ?? l}</option>)}</select>}
        <button className="outline-button" onClick={load} disabled={busy}><RefreshCw size={14} className={busy ? 'fx-spin' : ''} />{t('Refresh')}</button>
      </div>
    </div>
    {error && <div className="fx-error"><ShieldAlert size={16} />{error}</div>}
    {data && <>
      <div className="fxa-tiles">
        <div><small>{t('Nowcasts archived')}</small><b>{rows.length}</b><span>{NAMES[loc] ?? (loc || '—')}</span></div>
        <div><small>{t('Verified samples learned')}</small><b>{data.model.updates.thunderstorm}</b><span>{t(data.model.source.replace(/_/g, ' '))}</span></div>
        <div><small>{t('Forecast windows awaiting outcome')}</small><b>{data.pendingForecasts}</b><span>{t('resolved automatically')}</span></div>
        <div><small>{t('Peak P(thunderstorm, 3 h)')}</small><b>{peak ? pct(peak.ts180) : '—'}</b><span>{peak ? `${time(peak.t)} IST` : t('no data yet')}</span></div>
        <div><small>{t('Scheduler last run')}</small><b className="fxa-small">{data.lastScheduledRun ? time(data.lastScheduledRun) : t('Not started')}</b><span>{t('store')}: {data.storage}</span></div>
      </div>

      {rows.length === 0 ? <div className="fxa-empty"><Clock size={18} /><div><b>{t('No nowcast history yet.')}</b>
        <p>{t('History starts as soon as a city nowcast runs: open Live Nowcast / Prediction Center for a city, or start the 10-minute scheduler (node scripts/cron-local.mjs) to record every tracked city automatically.')}</p></div></div> : <>
        <ProbabilityChart rows={rows} t={t} />
        <div className="fxa-row">
          <div className="fxa-box"><span className="section-kicker"><ShieldAlert size={12} /> {t('ALERT LEVELS ISSUED')}</span>
            <div className="fxa-strip">{rows.slice(-144).map((r, i) => <i key={i} title={`${time(r.t)} · ${ALERT[r.alert]?.l ?? r.alert}`} style={{ background: ALERT[r.alert]?.c }} />)}</div>
            <div className="fxa-counts">{Object.entries(ALERT).map(([k, v]) => <span key={k}><i style={{ background: v.c }} />{t(v.l)} <b>{alertCounts[k] ?? 0}</b></span>)}</div>
          </div>
          <div className="fxa-box"><span className="section-kicker"><Database size={12} /> {t('DATA-SOURCE AVAILABILITY')}</span>
            {(['radar', 'satellite', 'lightning', 'nwp'] as const).map(k => <div key={k} className="fxa-bar"><span>{t({ radar: 'Multi-radar mosaic', satellite: 'Satellite IR', lightning: 'Lightning network', nwp: 'NWP model' }[k])}</span><div><i style={{ width: `${(uptime(k) ?? 0) * 100}%` }} /></div><b>{pct(uptime(k))}</b></div>)}
          </div>
        </div>
        <details className="fxa-details"><summary>{t('Table view — latest nowcasts')}</summary>
          <div className="fx-table-wrap"><table className="fx-table"><thead><tr><th>{t('Issued (IST)')}</th><th>{t('Thunderstorm 1 h')}</th><th>{t('Thunderstorm 3 h')}</th><th>{t('Lightning 1 h')}</th><th>{t('Rain 3 h')}</th><th>{t('Alert')}</th><th>{t('Cells')}</th><th>{t('Nearest cell')}</th></tr></thead>
            <tbody>{rows.slice(-24).reverse().map(r => <tr key={r.t}><td>{time(r.t)}</td><td>{pct(r.ts60)}</td><td>{pct(r.ts180)}</td><td>{pct(r.ltg60)}</td><td>{pct(r.rain180)}</td><td>{t(ALERT[r.alert]?.l ?? r.alert)}</td><td>{r.cells}</td><td>{r.nearestCellKm === null ? '—' : `${r.nearestCellKm} km`}</td></tr>)}</tbody></table></div>
        </details>
      </>}

      <div className="fx-section"><span className="section-kicker"><BrainCircuit size={12} /> {t('FORECAST VERIFICATION (fused ML vs radar-extrapolation-only baseline)')}</span>
        <div className="fx-table-wrap"><table className="fx-table"><thead><tr><th>{t('Hazard')}</th><th>{t('Window')}</th><th>N</th><th>{t('Events')}</th><th>POD</th><th>FAR</th><th>CSI</th><th>{t('CSI radar-only')}</th><th>Brier</th><th>{t('Brier radar-only')}</th></tr></thead>
          <tbody>{(['thunderstorm', 'lightning', 'rain'] as const).flatMap(hz => Object.entries(data.verification[hz] ?? {}).map(([h, v]) => <tr key={hz + h}><td>{t(hz)}</td><td>{Number(h) >= 60 ? `${Number(h) / 60} h` : `${h} min`}</td><td>{v.n}</td><td>{v.positives}</td><td>{pct(v.pod)}</td><td>{pct(v.far)}</td><td><b>{num(v.csi)}</b></td><td>{num(v.baselineCsi)}</td><td>{num(v.brier, 3)}</td><td>{num(v.baselineBrier, 3)}</td></tr>))}</tbody></table></div>
        <p className="fx-note"><Activity size={11} /> {t('Scores fill in automatically once each forecast window has elapsed and been checked against observed radar/lightning. POD = hits ÷ events, FAR = false alarms ÷ warnings, CSI = hits ÷ (hits + misses + false alarms). Lower Brier is better.')}</p>
      </div>
    </>}
  </section>
}
