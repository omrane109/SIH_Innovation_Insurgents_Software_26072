'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Script from 'next/script'
import { ArrowLeft, Check, Cloud, LogOut, Phone, ShieldCheck, UserRound } from 'lucide-react'
import type { Account, Profile } from '@/lib/use-vajra-account'
const blank:Omit<Profile,'id'|'alert_phone'|'updated_at'>={full_name:'',city:'',state:'',organization:'',phone:'',alert_opt_in:false,default_horizon:30,preferred_language:'EN',preferred_theme:'storm'}
export function AccountPanel({account,t,theme}:{account:Account;t:(key:string)=>string;theme:'storm'|'light'}){
  const {user,profile}=account
  const [destination,setDestination]=useState('')
  const [code,setCode]=useState('')
  const [otpSent,setOtpSent]=useState(false)
  const [alertDestination,setAlertDestination]=useState('')
  const [alertConsent,setAlertConsent]=useState(false)
  const [alertOtpSent,setAlertOtpSent]=useState(false)
  const [alertCode,setAlertCode]=useState('')
  const [linkPhone,setLinkPhone]=useState('')
  const [linkCode,setLinkCode]=useState('')
  const [linkSent,setLinkSent]=useState(false)
  const [googleLoaded,setGoogleLoaded]=useState(false)
  const googleBox=useRef<HTMLDivElement>(null)
  const googleCallback=useRef<(token:string)=>void>(()=>{})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [draft,setDraft]=useState(blank)
  useEffect(()=>{if(profile)setDraft({full_name:profile.full_name,city:profile.city,state:profile.state,organization:profile.organization,phone:profile.phone,alert_opt_in:profile.alert_opt_in,default_horizon:profile.default_horizon,preferred_language:profile.preferred_language,preferred_theme:profile.preferred_theme})},[profile])
  const run=async(fn:()=>Promise<unknown>,success='')=>{
    setBusy(true);setMessage('');setError('')
    try{await fn();if(success)setMessage(t(success))}
    catch(e){setError(e instanceof Error?e.message:t('Action failed. Try again.'))}
    finally{setBusy(false)}
  }
  googleCallback.current=token=>{void run(()=>account.googleSignIn(token),'Signed in successfully.')}
  useEffect(()=>{
    if(!googleLoaded||!account.config.googleClientId||!account.config.database||user?.google_linked||!googleBox.current)return
    const google=(window as any).google
    if(!google?.accounts?.id)return
    google.accounts.id.initialize({client_id:account.config.googleClientId,auto_select:false,callback:(response:{credential:string})=>googleCallback.current(response.credential)})
    googleBox.current.replaceChildren()
    google.accounts.id.renderButton(googleBox.current,{theme:theme==='storm'?'filled_black':'outline',size:'large',text:'continue_with',shape:'pill',width:270})
  },[googleLoaded,account.config.googleClientId,account.config.database,user?.id,user?.google_linked,theme])
  const requestCode=(e:FormEvent)=>{
    e.preventDefault()
    if(!/^\+[1-9]\d{7,14}$/.test(destination)){setError(t('Enter an international phone number, for example +919876543210.'));return}
    void run(async()=>{await account.sendOtp(destination);setOtpSent(true)},'Verification code requested via Twilio Verify.')
  }
  const verify=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await account.verifyOtp(destination,code);setOtpSent(false);setCode('')},'Signed in successfully.')}
  const requestLink=(e:FormEvent)=>{e.preventDefault();if(!/^\+[1-9]\d{7,14}$/.test(linkPhone)){setError(t('Enter an international phone number, for example +919876543210.'));return}void run(async()=>{await account.sendOtp(linkPhone,'link_phone');setLinkSent(true)},'Verification code requested via Twilio Verify.')}
  const verifyLink=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await account.verifyOtp(linkPhone,linkCode,'link_phone');setLinkSent(false);setLinkCode('')},'Your phone is linked. You can use either Google or phone OTP for this profile.')}
  const requestContact=(e:FormEvent)=>{
    e.preventDefault()
    if(!/^\+[1-9]\d{7,14}$/.test(alertDestination)){setError(t('Enter an international phone number, for example +919876543210.'));return}
    void run(async()=>{await account.sendOtp(alertDestination,'alert_contact',alertConsent);setAlertOtpSent(true)},'Code requested for your alert recipient.')
  }
  const verifyContact=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await account.verifyOtp(alertDestination,alertCode,'alert_contact');setAlertCode('');setAlertOtpSent(false);setAlertConsent(false)},'Alert recipient verified. Enable alerts and save your profile to allow manual test delivery.')}
  const save=(e:FormEvent)=>{e.preventDefault();void run(()=>account.saveProfile({...draft,full_name:draft.full_name.trim(),phone:draft.phone.trim()}),'Profile saved privately in Neon.')}
  return <section className="account-workspace" aria-label={t('Profile and sign in')}>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={()=>setGoogleLoaded(true)} />
    <div className="account-hero"><div className="account-symbol"><UserRound size={26}/></div><div><span className="section-kicker">{t('PERSONAL WORKSPACE')}</span><h2>{user?t('Your VAJRA profile'):t('Sign in or continue as a guest')}</h2><p>{t('Google sign-in and Twilio SMS OTP, with private Neon profile and forecast history.')}</p></div></div>
    {(message||error)&&<p role={error?'alert':'status'} className={error?'account-error':'account-success'}>{error||message}</p>}
    {!account.config.database&&<div className="account-setup"><strong>{t('Authentication setup required')}</strong><p>{t('Add your Neon database URL and run neon/schema.sql. See SETUP_TWILIO_NEON.md.')}</p></div>}
    {account.loading?<p className="empty-state">{t('Checking sign-in status…')}</p>:!user?<div className="account-grid">
      <div className="account-card"><span className="section-kicker">GOOGLE API</span><h3>{t('Continue with Google')}</h3><p>{t('Sign in securely using your Google account. Google tokens are verified on the server.')}</p>
        {account.config.google&&account.config.database?<div ref={googleBox} className="google-login-box" aria-label={t('Continue with Google')} />:<p className="muted-copy">{t('Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local and authorize your site origin.')}</p>}
        {account.config.google&&!googleLoaded&&<p className="muted-copy">{t('Loading Google sign-in…')}</p>}
      </div>
      <div className="account-card"><span className="section-kicker">TWILIO VERIFY</span><h3>{t('Sign in with one-time code')}</h3><p>{t('Receive a one-time SMS code. Your number must include the country code.')}</p>
        {!otpSent?<form className="account-form" onSubmit={requestCode}><label>{t('Phone number with country code')}<input required type="tel" autoComplete="tel" maxLength={16} value={destination} onChange={e=>setDestination(e.target.value)} placeholder="+919876543210"/></label><button className="primary-button" type="submit" disabled={busy||!account.config.otp}>{t('Send one-time code')}</button></form>
          :<form className="account-form" onSubmit={verify}><p>{t('Enter the one-time code sent to')} <strong>{destination}</strong></p><label>{t('Verification code')}<input inputMode="numeric" autoComplete="one-time-code" maxLength={10} pattern="[0-9]{4,10}" required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><div className="auth-actions"><button type="button" className="outline-button" onClick={()=>{setOtpSent(false);setCode('')}}><ArrowLeft size={15}/>{t('Change number')}</button><button className="primary-button" type="submit" disabled={busy}><ShieldCheck size={15}/>{t('Verify and sign in')}</button></div></form>}
        {!account.config.otp&&<p className="muted-copy">{t('Configure Twilio Verify, RATE_LIMIT_SECRET, and Neon to enable SMS codes.')}</p>}
      </div>
    </div>:<div className="account-grid">
      <form className="account-card account-profile" onSubmit={save}><div className="account-header"><div><span className="section-kicker">NEON DATABASE</span><h3>{t('Personal information')}</h3></div><span className="account-verified"><Check size={14}/>{t('Signed in')}</span></div>
        <p className="muted-copy">{t('Account:')} {user.email||user.id}</p>
        <div className="account-field-grid">
          <label>{t('Full name')}<input maxLength={100} value={draft.full_name} onChange={e=>setDraft(d=>({...d,full_name:e.target.value}))}/></label>
          <label>{t('Organization (optional)')}<input maxLength={120} value={draft.organization} onChange={e=>setDraft(d=>({...d,organization:e.target.value}))}/></label>
          <label>{t('City / district')}<input maxLength={100} value={draft.city} onChange={e=>setDraft(d=>({...d,city:e.target.value}))}/></label>
          <label>{t('State')}<input maxLength={100} value={draft.state} onChange={e=>setDraft(d=>({...d,state:e.target.value}))}/></label>
          <label>{t('Contact number (optional)')}<input type="tel" maxLength={20} value={draft.phone} onChange={e=>setDraft(d=>({...d,phone:e.target.value}))} placeholder="+91…"/></label>
          <label>{t('Default forecast horizon')}<select value={draft.default_horizon} onChange={e=>setDraft(d=>({...d,default_horizon:Number(e.target.value)}))}>{[15,30,60,90,120,180].map(x=><option value={x} key={x}>{x} min</option>)}</select></label>
          <label>{t('Preferred language')}<select value={draft.preferred_language} onChange={e=>setDraft(d=>({...d,preferred_language:e.target.value as Profile['preferred_language']}))}><option value="EN">English</option><option value="HI">हिन्दी</option><option value="MR">मराठी</option><option value="GU">ગુજરાતી</option><option value="TE">తెలుగు</option></select></label>
          <label>{t('Preferred appearance')}<select value={draft.preferred_theme} onChange={e=>setDraft(d=>({...d,preferred_theme:e.target.value as Profile['preferred_theme']}))}><option value="storm">{t('Dark mode')}</option><option value="light">{t('Light mode')}</option></select></label>
        </div>
        <label className="auth-checkbox"><input type="checkbox" checked={draft.alert_opt_in} disabled={!profile?.alert_phone} onChange={e=>setDraft(d=>({...d,alert_opt_in:e.target.checked}))}/><span>{t('Allow manual test SMS and calls to my verified alert recipient')}</span></label>
        <div className="auth-actions"><button type="submit" className="primary-button" disabled={busy}><Check size={15}/>{t('Save profile')}</button><button type="button" className="outline-button" onClick={()=>void run(account.signOut,'Signed out.')} disabled={busy}><LogOut size={15}/>{t('Sign out')}</button></div>
      </form>
      <div className="account-card">
        <span className="section-kicker">ACCOUNT LINKING</span><h3>{t('Use either sign-in method')}</h3>
        <p className="muted-copy">{t('Link a second verified sign-in method to the same Neon profile and forecast history.')}</p>
        {user.google_linked?<p className="account-success"><Check size={15}/> {t('Google sign-in linked')}</p>:account.config.google?<div><p>{t('Link your Google account')}</p><div ref={googleBox} className="google-login-box" /></div>:<p>{t('Configure Google sign-in to link it.')}</p>}
        {user.login_phone?<p className="account-success"><Check size={15}/> {t('SMS login linked:')} ••••{user.login_phone.slice(-4)}</p>:
          !linkSent?<form className="account-form" onSubmit={requestLink}><label>{t('Link phone OTP sign-in')}<input type="tel" maxLength={16} required value={linkPhone} placeholder="+919876543210" onChange={e=>setLinkPhone(e.target.value)}/></label><button className="outline-button" type="submit" disabled={!account.config.otp||busy}>{t('Send one-time code')}</button></form>:
          <form className="account-form" onSubmit={verifyLink}><label>{t('Verification code')}<input value={linkCode} required pattern="[0-9]{4,10}" inputMode="numeric" maxLength={10} onChange={e=>setLinkCode(e.target.value.replace(/\D/g,''))}/></label><div className="auth-actions"><button type="button" className="outline-button" onClick={()=>setLinkSent(false)}>{t('Change number')}</button><button type="submit" className="primary-button" disabled={busy}>{t('Link phone')}</button></div></form>}
        <hr className="account-divider"/>
        <span className="section-kicker">TWILIO + NEON</span><h3>{t('Verified alert recipient')}</h3>
        <p>{t('Only a recipient who agrees and enters their SMS verification code can receive manual test alerts.')}</p>
        {profile?.alert_phone&&<p className="account-success"><ShieldCheck size={15}/> {t('Verified:')} ••••{profile.alert_phone.slice(-4)}</p>}
        {!alertOtpSent?<form className="account-form" onSubmit={requestContact}><label>{t('Alert recipient number')}<input type="tel" required maxLength={16} placeholder="+919876543210" value={alertDestination} onChange={e=>setAlertDestination(e.target.value)}/></label>
          <label className="auth-checkbox"><input type="checkbox" checked={alertConsent} onChange={e=>setAlertConsent(e.target.checked)}/><span>{t('The recipient agrees to receive this verification code and manual test alerts.')}</span></label><button className="primary-button" disabled={busy||!alertConsent||!account.config.otp} type="submit"><Phone size={15}/>{t('Verify recipient')}</button></form>
          :<form className="account-form" onSubmit={verifyContact}><p>{t('Enter code received by')} {alertDestination}</p><label>{t('Verification code')}<input required inputMode="numeric" pattern="[0-9]{4,10}" maxLength={10} value={alertCode} onChange={e=>setAlertCode(e.target.value.replace(/\D/g,''))}/></label><div className="auth-actions"><button type="button" className="outline-button" onClick={()=>setAlertOtpSent(false)}>{t('Change number')}</button><button type="submit" disabled={busy} className="primary-button">{t('Verify recipient')}</button></div></form>}
        <div className="account-cloud"><Cloud size={26}/><strong>{t('Private cloud history enabled')}</strong></div><p className="muted-copy">{t('Only your account can read or save your research runs. Guest runs remain in this browser.')}</p>
      </div>
    </div>}
  </section>
}
