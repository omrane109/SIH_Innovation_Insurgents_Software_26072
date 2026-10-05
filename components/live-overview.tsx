'use client'
import { LiveWeather } from './live-weather'
import { WindyIntelligence } from './windy-intelligence'
import { RadarViewer } from './radar-viewer'
import { ArrowRight, Database, History, ShieldAlert } from 'lucide-react'

type T=(key:string)=>string
export function LiveOverview({t,onNavigate}:{t:T;onNavigate:(route:string)=>void}) {
  return <div className="realtime-overview">
    <div className="realtime-intro">
      <div><span className="section-kicker">{t('AUTO-UPDATED SOURCES · CURRENT IST DATE')}</span><h2>{t('Latest available weather information')}</h2><p>{t('Open-Meteo forecasts update automatically; RainViewer provides recent radar frames where coverage exists. Each source shows its own timestamp.')}</p></div>
      <span className="realtime-tag">{t('Automatically refreshed')}</span>
    </div>
    <WindyIntelligence t={t} compact/><LiveWeather t={t}/>
    <RadarViewer t={t} compact/>
    <div className="realtime-navigation">
      <button type="button" onClick={()=>onNavigate('Historical Replay')}><History size={18}/><span><strong>{t('Recent NASA archive')}</strong><small>{t('Auto-select latest published historical records · typically 2–3 days behind today')}</small></span><ArrowRight size={17}/></button>
      <button type="button" onClick={()=>onNavigate('Alerts')}><ShieldAlert size={18}/><span><strong>{t('Forecast advisories')}</strong><small>{t('Optional source-labeled forecast advisory settings and manual Twilio tests')}</small></span><ArrowRight size={17}/></button>
      <button type="button" onClick={()=>onNavigate('Data Sources')}><Database size={18}/><span><strong>{t('Data-source diagnostics')}</strong><small>{t('Check connections and which data is actually available')}</small></span><ArrowRight size={17}/></button>
    </div>
  </div>
}
