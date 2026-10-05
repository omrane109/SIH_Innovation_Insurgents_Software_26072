'use client'
import { useEffect, useState } from 'react'
import { Cpu, RefreshCw } from 'lucide-react'

type Status={
  researchModelInstalled:boolean;status:string;modelId:string;trainedAt:string;inferenceAt:string;
  inferenceScope:string;existingThreeHourRainModelTrained:boolean;
  metrics:{
    temperature:{trainSamples:number;holdoutSamples:number;baselineMAE:number;holdoutMAE:number};
    humidity:{trainSamples:number;holdoutSamples:number;baselineMAE:number;holdoutMAE:number};
    metarWeatherCode:{trainSamples:number;holdoutSamples:number;trainPrecipitationCodes:number;holdoutPrecipitationCodes:number;holdoutROC_AUC:number;holdoutPR_AUC:number;holdoutBrier:number}
  };
  examples:{historicalForecastValidAt:string;observedMetarCode:number;correctedTemperatureC:number;correctedHumidityPct:number;historicalWeatherCodeDiscriminationScore:number}[];
  note:string;
}
export function HistoricalMlResearch({t}:{t:(s:string)=>string}) {
  const [status,setStatus]=useState<Status|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  async function check(){
    setLoading(true);setError('')
    try{
      const response=await fetch('/api/historical-ml-research',{cache:'no-store'})
      const json=await response.json()
      if (!response.ok || !json.researchModelInstalled) throw Error(json.error||'Historical model unavailable')
      setStatus(json)
    }catch(e){setStatus(null);setError(e instanceof Error?e.message:'Unavailable')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void check()},[])
  return <section className="route-card" aria-label="Experimental historical supervised ML results">
    <div className="card-head"><div><span className="section-kicker">METAR · HISTORICAL SUPERVISED EXPERIMENT</span>
      <h2>{t('Trained historical research model')}</h2><p className="muted-copy">{t('Trained using your uploaded Open-Meteo 2024–2025 forecasts and Juhu METAR-sourced records.')}</p>
    </div><button className="outline-button" disabled={loading} onClick={()=>void check()}><RefreshCw size={16}/>{t('Run historical inference')}</button></div>
    {error&&<p className="operation-tip" role="alert">{error}</p>}
    {status&&<>
      <div className="windy-alert-context"><Cpu size={20}/><div>
        <strong>{t('Historical research model: TRAINED · INFERENCE COMPLETED')}</strong>
        <p>{t('Model')}: {status.modelId}</p>
        <p>{t('Last historical inference request')}: {new Date(status.inferenceAt).toLocaleString()}</p>
        <p>{t('Existing live three-hour rainfall/storm-warning model remains NOT TRAINED.')}</p>
      </div></div>
      <div className="windy-prediction-grid">
        <article className="windy-prediction"><strong>{t('Station temperature correction')}</strong><p>{t('2025 chronological holdout MAE')}: {status.metrics.temperature.holdoutMAE.toFixed(2)}°C; {t('original forecast')}: {status.metrics.temperature.baselineMAE.toFixed(2)}°C</p><small>{status.metrics.temperature.holdoutSamples} {t('independent METAR holdout records')}</small></article>
        <article className="windy-prediction"><strong>{t('Station humidity correction')}</strong><p>{t('2025 chronological holdout MAE')}: {status.metrics.humidity.holdoutMAE.toFixed(2)} {t('percentage points')}; {t('original forecast')}: {status.metrics.humidity.baselineMAE.toFixed(2)}</p><small>{status.metrics.humidity.holdoutSamples} {t('independent METAR holdout records')}</small></article>
        <article className="windy-prediction"><strong>{t('METAR weather-code experiment')}</strong><p>ROC AUC: {status.metrics.metarWeatherCode.holdoutROC_AUC.toFixed(3)} · PR AUC: {status.metrics.metarWeatherCode.holdoutPR_AUC.toFixed(3)}</p><small>{status.metrics.metarWeatherCode.holdoutPrecipitationCodes}/{status.metrics.metarWeatherCode.holdoutSamples} {t('held-out records have reported precipitation-related codes')}</small></article>
      </div>
      <p className="operation-tip">{status.note}</p>
      <details className="raw-details"><summary>{t('View re-executed historical holdout cases')}</summary><div className="windy-forecast-scroll"><div className="windy-forecast-table"><table><thead><tr><th>{t('Historical valid hour')}</th><th>{t('METAR code')}</th><th>{t('Weather-code discrimination score')}</th><th>{t('Corrected temperature')}</th></tr></thead><tbody>
        {status.examples.map(p=><tr key={p.historicalForecastValidAt}><td>{new Date(p.historicalForecastValidAt).toLocaleString()}</td><td>{p.observedMetarCode}</td><td>{(100*p.historicalWeatherCodeDiscriminationScore).toFixed(1)}%</td><td>{p.correctedTemperatureC.toFixed(1)}°C</td></tr>)}
      </tbody></table></div></div></details>
    </>}
    {!status&&!error&&<p className="muted-copy">{t('Loading archived research artifacts…')}</p>}
  </section>
}
