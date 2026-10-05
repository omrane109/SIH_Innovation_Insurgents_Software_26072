'use client'

import { useEffect, useState } from 'react'
import { availableLanguages, translate as translateText, type Language } from '../lib/i18n'
import { useVajraAccount, type Account } from '../lib/use-vajra-account'
import { AccountPanel } from '../components/account-panel'
import { Operations } from '../components/operations'
import { LiveOverview } from '../components/live-overview'
import { AtmosphereModel } from '../components/nasa-satellite-globe'
import { WindyWorkspace } from '../components/windy-workspace'
import { WindyIntelligence } from '../components/windy-intelligence'
import { HistoricalMlResearch } from '../components/historical-ml-research'
import { KaggleResearch } from '../components/kaggle-research'
import { LightningLive } from '../components/lightning-live'
import { PredictionCenter } from '../components/prediction-center'
import { FusionNowcast } from '../components/fusion-nowcast'
import {
  Activity, AlertTriangle, Bell, BookOpen, BrainCircuit, ChevronDown, CircleHelp,
  CloudLightning, Database, Gauge, Globe2, Layers3, MapPin, Menu, Moon, Play,
  Radio, RefreshCw, Search, Settings, ShieldAlert, Sun, Target, Zap, Box, Cpu, SlidersHorizontal, MessageCircle, Send, X, Check, History, Map, Satellite,
} from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

const navItems = [
  { label: 'Overview', icon: Gauge }, { label: 'Prediction Center', icon: Target }, { label: 'Live Nowcast', icon: Radio },
  { label: '3D System Model', icon: Box }, { label: 'Windy Maps', icon: Map }, { label: 'VAJRA AI/ML Lab', icon: Cpu },
  { label: 'Thunderstorms', icon: CloudLightning }, { label: 'Lightning', icon: Zap },
  { label: 'Hyperlocal Forecast', icon: Target }, { label: 'Alerts', icon: ShieldAlert, count: 0 },
  { label: 'Historical Replay', icon: Play }, { label: 'Analytics', icon: Activity },
  { label: 'Model Intelligence', icon: BrainCircuit },
]

function RouteWorkspace({ active, t, onNavigate, language, account }: { active: string; t: (value: string) => string; onNavigate: (route: string) => void; language: Language; account: Account }) {
  if (active === '3D System Model') return <section className="route-workspace"><WindyIntelligence t={t} focus="3d" compact/><AtmosphereModel t={t} onConfigure={() => onNavigate('Data Sources')} onWindy={() => onNavigate('Windy Maps')} /></section>
  if (active === 'Windy Maps') return <section className="route-workspace"><WindyWorkspace t={t} /></section>
  if (active === 'Prediction Center') return <section className="route-workspace"><PredictionCenter t={t}/></section>
  if (active === 'Thunderstorms') return <section className="route-workspace"><PredictionCenter t={t}/><KaggleResearch t={t} focus="thunder"/><FusionNowcast t={t} mode="compact"/></section>
  if (active === 'Lightning') return <section className="route-workspace"><PredictionCenter t={t}/><LightningLive t={t}/><FusionNowcast t={t} mode="compact"/></section>
  if (active === 'VAJRA AI/ML Lab') return <section className="route-workspace"><PredictionCenter t={t}/><WindyIntelligence t={t} focus="model" /><HistoricalMlResearch t={t}/><KaggleResearch t={t}/><FusionNowcast t={t}/></section>
  if (active === 'Model Intelligence') return <section className="route-workspace"><WindyIntelligence t={t} focus="model" /><LightningLive t={t}/><HistoricalMlResearch t={t}/><KaggleResearch t={t}/></section>
  return <Operations active={active} t={t} account={account} language={language} onOpenWindy={() => onNavigate('Windy Maps')} />
}

function PuterAssistant({ language, t }: { language: Language; t: (value: string) => string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([{ role: 'assistant', text: 'Ask about a location, forecast horizon, lightning risk or what the uncertainty means. I will distinguish verified warnings from prototype output.' }])
  const [busy, setBusy] = useState(false)
  const send = async () => {
    const question = input.trim(); if (!question || busy) return
    setInput(''); setMessages((m) => [...m, { role: 'user', text: question }]); setBusy(true)
    try {
      if (!window.puter?.ai?.chat) throw new Error('Puter is still loading. Check your connection and try again.')
      const answer = await window.puter.ai.chat(`You are VAJRA AI, an assistant for thunderstorm nowcasting in India. Reply in ${availableLanguages.find(item => item.code === language)?.name || 'English'}.  Never invent live observations or claim an official warning. Forecast indicator tiers are not trained ML probabilities; only show experimental ML scores if a genuinely trained model with independent labels is installed. User asks: ${question}`, { model: 'gpt-5-nano' })
      const text = typeof answer === 'string' ? answer : answer?.message?.content
      setMessages((m) => [...m, { role: 'assistant', text: typeof text === 'string' ? text : 'I could not read the assistant response.' }])
    } catch (error) { setMessages((m) => [...m, { role: 'assistant', text: error instanceof Error ? error.message : 'Puter assistant is unavailable.' }]) }
    finally { setBusy(false) }
  }
  return <><button className="chat-launcher" onClick={() => setOpen(!open)} aria-label={t('Open weather assistant')}>{open ? <X/> : <MessageCircle/>}<span>{t(open ? 'Close' : 'Ask Vajra')}</span></button>{open && <aside className="chat-panel"><header><div><strong>{t('VAJRA weather assistant')}</strong><small>{t('Puter AI · no live data assumed')}</small></div><button onClick={() => setOpen(false)} aria-label="Close"><X/></button></header><div className="chat-messages">{messages.map((message, i) => <div key={i} className={`chat-message ${message.role}`}>{message.role === 'assistant' && i === 0 ? t(message.text) : message.role === 'assistant' ? t(message.text) : message.text}</div>)}{busy && <div className="chat-message assistant">{t('Checking the question…')}</div>}</div><div className="chat-compose"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={t('Ask about a place or forecast…')}/><button onClick={send} disabled={busy || !input.trim()} aria-label={t('Send')}><Send/></button></div><small className="chat-note">{t('Puter may prompt you to authenticate. Do not enter sensitive information.')}</small></aside>}</>
}

export default function Page() {
  const account = useVajraAccount()
  const [active, setActive] = useState('Overview')
  const [theme, setTheme] = useState<'storm' | 'light'>('storm')
  const [settingsReady, setSettingsReady] = useState(false)
  const [language, setLanguage] = useState<Language>('EN')
  const [mobileNav, setMobileNav] = useState(false)
  const [now, setNow] = useState('—')
  useEffect(() => {
    const update = () => setNow(new Intl.DateTimeFormat('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric',hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()))
    update()
    const timer = window.setInterval(update, 30000)
    return () => window.clearInterval(timer)
  }, [])
  // Restore preferences client-side to avoid SSR/client hydration mismatches.
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('vajra-theme')
      const savedLanguage = localStorage.getItem('vajra-language')
      if (savedTheme === 'storm' || savedTheme === 'light') setTheme(savedTheme)
      if (availableLanguages.some(item => item.code === savedLanguage)) setLanguage(savedLanguage as Language)
    } catch { /* storage disabled: user can still use both controls */ }
    setSettingsReady(true)
  }, [])
  useEffect(() => {
    if (!settingsReady) return
    document.documentElement.lang = ({ EN:'en', HI:'hi', MR:'mr', GU:'gu', TE:'te' })[language]
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('vajra-theme', theme); localStorage.setItem('vajra-language', language) } catch {}
  }, [theme, language, settingsReady])
  useEffect(() => {
    if (!account.user || !account.profile) return
    setLanguage(account.profile.preferred_language || 'EN')
    setTheme(account.profile.preferred_theme || 'storm')
  }, [account.user?.id, account.profile?.preferred_language, account.profile?.preferred_theme])
  const t = (value: string) => translateText(language, value)
  const translate = t
  const title = active === 'Overview' ? translate('Operational Overview') : translate(active)

  return <main className={`app-shell ${theme}`}>
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><CloudLightning /></div><div><strong>VAJRA<span>AI</span></strong><small>{t('Weather intelligence')}</small></div><button className="close-nav" onClick={() => setMobileNav(false)} aria-label="Close navigation">×</button></div>
      <div className="workspace-label">{t('COMMAND CENTRE')} <span>v2.5</span></div>
      <nav>{navItems.map(({ label, icon: Icon, count }) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(label); setMobileNav(false) }}><Icon /> <span>{translate(label)}</span>{count && <b>{count}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><button className={`nav-item ${active === 'Data Sources' ? 'active' : ''}`} onClick={() => setActive('Data Sources')}><Database /><span>{translate('Data Sources')}</span></button><button className={`nav-item ${active === 'System Health' ? 'active' : ''}`} onClick={() => setActive('System Health')}><Settings /><span>{translate('System Health')}</span></button><button className={`nav-item ${active === 'Profile' ? 'active' : ''}`} onClick={() => { setActive('Profile'); setMobileNav(false) }}><Settings /><span>{translate('Profile')}</span></button><div className="reliability"><div className="reliability-top"><span>{t('Model readiness')}</span><strong>{t('Research')}</strong></div><div className="progress"><i style={{ width: '0%' }} /></div><small><i className="dot amber" /> {t('Feed validation needed')}</small></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button><div className="location"><MapPin /><div><span>{t('MONITORED LOCATION')}</span><strong>{t('Choose location in each weather panel')} <ChevronDown /></strong></div></div><div className="top-actions"><div className="preferences" role="group" aria-label={t('Appearance')}>
        <label className="language-control"><Globe2 aria-hidden="true"/><span className="pref-text">{t('Language')}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t('Choose language')}>{availableLanguages.map(({code,name}) => <option value={code} key={code}>{name}</option>)}</select><ChevronDown aria-hidden="true"/></label>
        <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'storm' ? 'light' : 'storm')} aria-label={t('Toggle theme')} aria-pressed={theme === 'storm'} title={t(theme === 'storm' ? 'Light mode' : 'Dark mode')}>
          {theme === 'storm' ? <Sun /> : <Moon />}<span>{t(theme === 'storm' ? 'Light mode' : 'Dark mode')}</span>
        </button>
      </div><div className="clock"><span>IST</span><strong>{now}</strong></div><div className="mode-badge"><i /> {t('WINDY POINT FORECAST')}</div><div className="last-update"><RefreshCw /> {t('15-min server task available after setup')}</div><button className="icon-button" onClick={() => setActive('Alerts')} aria-label={t('Alerts')}><Bell /></button><button className="avatar profile-avatar" onClick={() => setActive('Profile')} title={t('Open profile')} aria-label={t('Open profile')}>{account.user ? (account.profile?.full_name || account.user.email || account.user.phone || 'VA').slice(0,2).toUpperCase() : 'VA'}</button></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow"><span className="status-pulse" /> {t('WINDY FORECAST RESEARCH · DATA SOURCE LABELED')}</div><h1>{title}</h1><p>{t('Thunderstorm and lightning nowcasting workspace · India domain.')}</p></div><div className="heading-actions"><button className="outline-button" onClick={() => setActive('Historical Replay')}><BookOpen /> {t('Replay history')}</button><button className="primary-button" onClick={() => setActive('Live Nowcast')}><RefreshCw /> {t('Run nowcast')}</button></div></div>
        <div className="disclaimer"><ShieldAlert /> <span><strong>{t('Prototype preview')}</strong> — {t('Forecast indicators use source-labeled Open-Meteo public guidance on the free Windy plan, or licensed Windy GFS when configured. Research ML runs only with a separately trained matching artifact. NASA satellite and RainViewer are separate viewers. These are not official weather warnings.')}</span><button onClick={() => setActive('Data Sources')}>{t('Configure feeds')} <CircleHelp /></button></div>

        {active === 'Profile' && <AccountPanel account={account} t={t} theme={theme} />}
        {active !== 'Overview' && active !== 'Profile' && <RouteWorkspace key={active} active={active} t={t} onNavigate={setActive} language={language} account={account} />}

        {active === 'Overview' && <><PredictionCenter t={t}/><LiveOverview t={t} onNavigate={setActive}/></>}
      </div>

      <PuterAssistant language={language} t={t} />
    </section>
  </main>
}
