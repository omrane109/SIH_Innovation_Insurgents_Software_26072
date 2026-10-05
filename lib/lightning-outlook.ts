/** Pure, source-labelled forecast interpretation. Not a trained lightning classifier. */
export type WeatherHour = {
  at: string; weatherCode: number | null; precipitationMm: number | null; precipitationProbabilityPct:number|null;
  showersMm: number | null; capeJkg: number | null;
  lightningPotential: number | null; lightningPotentialUnits: string | null;
  thunderstormProbabilityPct: number | null; lightningDensity:number|null;
  providerThunderstormFlag: boolean;
}
export type LightningOutlook = {
  kind: 'MODELED_LIGHTNING_CONDITIONS'; source: 'Open-Meteo NOAA GFS numerical weather forecast';
  location: string; retrievedAt: string; validWindow: string;
  category: 'model_thunderstorm_signal'|'convective_environment_only'|'no_model_thunderstorm_signal'|'data_unavailable';
  description: string; peakCapeJkg: number|null;
  providerMaximumThunderstormProbabilityPct: number|null;
  peakModelLightningPotential: number|null; peakModelLightningDensity:number|null; modelLightningDensityUnits:string|null; modelLightningDensitySource:string|null;
  modelLightningPotentialUnits: string|null;
  detectedStrikes: null; measuredLightningMl: null;
  availableForecastVariables: string[]; hours: WeatherHour[];
  note: string;
}
const numberOrNull=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null
const maximum=(values:(number|null)[])=>{const v=values.filter((x):x is number=>x!==null);return v.length?Math.max(...v):null}
/** UTC hourly timestamps only; refuse partial or malformed provider responses. */
export function interpretLightningForecast(raw:Record<string,any>,location:string,now=new Date()):LightningOutlook {
  const h=raw.hourly;const u=raw.hourly_units||{}
  if(!h||!Array.isArray(h.time)||!Array.isArray(h.weather_code)||h.time.length!==h.weather_code.length){throw Error('Incomplete Open-Meteo thunderstorm input; not displaying estimated conditions.')}
  if(h.precipitation && u.precipitation !== 'mm')throw Error('Unsupported precipitation units in lightning outlook')
  const optional=['lightning_potential','thunderstorm_probability','precipitation_probability','lightning_density'] as const
  const availableForecastVariables=['weather_code',...(['cape','precipitation','showers',...optional] as const).filter(k=>Array.isArray(h[k])&&h[k].length===h.time.length)]
  const start=now.getTime()-60*60*1000,end=now.getTime()+6*60*60*1000
  const hours:WeatherHour[]=h.time.map((at:string,i:number)=>{
    if(typeof at!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(at))return null
    const iso=`${at}:00Z`;const ts=Date.parse(iso)
    if(!Number.isFinite(ts)||ts<start||ts>end)return null
    const code=numberOrNull(h.weather_code[i]);const lpi=numberOrNull(h.lightning_potential?.[i]);
    const probability=numberOrNull(h.thunderstorm_probability?.[i]);
    const rainProbability=numberOrNull(h.precipitation_probability?.[i]);
    const density=numberOrNull(h.lightning_density?.[i]);
    return {at:iso,weatherCode:code,precipitationMm:numberOrNull(h.precipitation?.[i]),precipitationProbabilityPct:rainProbability!==null&&rainProbability>=0&&rainProbability<=100?rainProbability:null,showersMm:numberOrNull(h.showers?.[i]),
      capeJkg:numberOrNull(h.cape?.[i]),lightningPotential:lpi,lightningPotentialUnits:typeof u.lightning_potential==='string'?u.lightning_potential:null,
      thunderstormProbabilityPct:probability!==null&&probability>=0&&probability<=100?probability:null,lightningDensity:density!==null&&density>=0?density:null,
      providerThunderstormFlag:code!==null&&[95,96,97,99].includes(code)}
  }).filter((v:WeatherHour|null):v is WeatherHour=>v!==null)
  if(!hours.length)throw Error('No current forecast hours from Open-Meteo.')
  const peakCapeJkg=maximum(hours.map(h=>h.capeJkg)), peakModelLightningPotential=maximum(hours.map(h=>h.lightningPotential))
  const providerMaximumThunderstormProbabilityPct=maximum(hours.map(h=>h.thunderstormProbabilityPct))
  const peakModelLightningDensity=maximum(hours.map(h=>h.lightningDensity))
  const thunder=hours.some(h=>h.providerThunderstormFlag)
  const hasConvectiveContext=hours.some(h=>h.capeJkg!==null&&h.capeJkg>=800&&(h.showersMm??0)>0)
  const category:LightningOutlook['category']=thunder?'model_thunderstorm_signal':hasConvectiveContext?'convective_environment_only':'no_model_thunderstorm_signal'
  const description=thunder?'Forecast weather codes indicate thunderstorms during the next six hours. Not a measured lightning strike or a trained lightning prediction.':
    hasConvectiveContext?'Modeled CAPE and showers indicate convection-supporting conditions; lightning occurrence is NOT confirmed.':
    'The available model weather codes do not flag thunderstorms in the next six hours. This does NOT prove lightning will be absent.'
  return {kind:'MODELED_LIGHTNING_CONDITIONS',source:'Open-Meteo NOAA GFS numerical weather forecast',location,retrievedAt:now.toISOString(),
    validWindow:`${hours[0].at} to ${hours[hours.length-1].at}`,category,description,peakCapeJkg,
    providerMaximumThunderstormProbabilityPct,peakModelLightningPotential,peakModelLightningDensity,
    modelLightningDensityUnits:typeof u.lightning_density==='string'?u.lightning_density:null,
    modelLightningDensitySource:peakModelLightningDensity===null?null:'ECMWF IFS numerical lightning-density forecast via Open-Meteo',
    modelLightningPotentialUnits:hours.find(h=>h.lightningPotentialUnits)?.lightningPotentialUnits??null,
    detectedStrikes:null,measuredLightningMl:null,availableForecastVariables,hours,
    note:'Forecast model guidance only. Optional LPI/probability variables depend on the weather model. No live lightning strikes are inferred. Do not trigger lightning emergency alerts or Twilio calls from this outlook.'}
}
