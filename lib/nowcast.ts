export type NowcastObservation = {
  reflectivityDbz?: number
  reflectivityTrendDbzPer10Min?: number
  cloudTopCoolingCPer15Min?: number
  lightningFlashesPerMin?: number
  lightningTrendPer10Min?: number
  capeJkg?: number
  shearKt?: number
  rainRateMmPerHour?: number
  sourceCount?: number
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Transparent prototype baseline. This is not a trained or operational weather model. */
export function runBaselineNowcast(input: NowcastObservation) {
  const reflectivity = finite(input.reflectivityDbz) ? clamp(input.reflectivityDbz, 0, 75) : null
  const growth = finite(input.reflectivityTrendDbzPer10Min) ? clamp(input.reflectivityTrendDbzPer10Min, -10, 20) : null
  const cooling = finite(input.cloudTopCoolingCPer15Min) ? clamp(input.cloudTopCoolingCPer15Min, -15, 0) : null
  const flashes = finite(input.lightningFlashesPerMin) ? clamp(input.lightningFlashesPerMin, 0, 1000) : null
  const lightningTrend = finite(input.lightningTrendPer10Min) ? clamp(input.lightningTrendPer10Min, -100, 500) : null
  const cape = finite(input.capeJkg) ? clamp(input.capeJkg, 0, 6000) : null
  const shear = finite(input.shearKt) ? clamp(input.shearKt, 0, 100) : null
  const rain = finite(input.rainRateMmPerHour) ? clamp(input.rainRateMmPerHour, 0, 500) : null
  const present = [reflectivity, growth, cooling, flashes, lightningTrend, cape, shear, rain].filter((x) => x !== null).length
  const sources = finite(input.sourceCount) ? clamp(input.sourceCount, 0, 8) : Math.min(4, present)

  // Bounded, interpretable heuristic score; inputs are unit-normalized before combining.
  const components = [
    { name: 'Radar reflectivity', value: reflectivity === null ? null : clamp((reflectivity - 15) * 1.45), weight: 0.26 },
    { name: 'Radar growth', value: growth === null ? null : clamp(50 + growth * 4), weight: 0.17 },
    { name: 'Cloud-top cooling', value: cooling === null ? null : clamp(-cooling * 12), weight: 0.13 },
    { name: 'Lightning rate', value: flashes === null ? null : clamp(flashes * 5), weight: 0.19 },
    { name: 'Lightning escalation', value: lightningTrend === null ? null : clamp(50 + lightningTrend * 0.35), weight: 0.1 },
    { name: 'Instability (CAPE)', value: cape === null ? null : clamp(cape / 24), weight: 0.08 },
    { name: 'Wind shear', value: shear === null ? null : clamp(shear * 1.25), weight: 0.04 },
    { name: 'Rain rate', value: rain === null ? null : clamp(rain * 2.2), weight: 0.03 },
  ]
  const availableWeight = components.reduce((total, item) => total + (item.value === null ? 0 : item.weight), 0)
  const score = availableWeight ? Math.round(components.reduce((total, item) => total + (item.value ?? 0) * item.weight, 0) / availableWeight) : null
  const confidence = Math.round(clamp(25 + present * 7 + sources * 5 - (present < 4 ? 12 : 0), 10, 85))
  const risk = score === null ? 'insufficient_data' : score >= 75 ? 'severe' : score >= 55 ? 'high' : score >= 35 ? 'watch' : 'low'
  const drivers = components.filter((item) => item.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3).map((item) => item.name)
  const missing = ['reflectivityDbz', 'reflectivityTrendDbzPer10Min', 'lightningFlashesPerMin', 'capeJkg', 'shearKt'].filter((field) => !finite(input[field as keyof NowcastObservation]))
  const horizons = [15, 30, 60, 90, 120, 180].map((minutes) => ({ minutes, riskScore: score === null ? null : Math.round(clamp(score + (growth ?? 0) * minutes / 60 + (lightningTrend ?? 0) * minutes / 600)), confidence: Math.max(10, confidence - Math.floor(minutes / 12)) }))
  return { model: 'vajra-transparent-baseline-v0.1', trained: false, operational: false, generatedAt: new Date().toISOString(), score, risk, confidence, sourcesUsed: sources, featuresUsed: present, missingInputs: missing, topDrivers: drivers, horizons, warning: 'Research prototype baseline only. Not a trained model and not an official IMD warning.' }
}

export const requiredNowcastData = [
  { group: 'Radar (DWR)', fields: 'Georeferenced reflectivity (dBZ), radial velocity, scan timestamps, volume files, radar location/metadata; 5–10 minute cadence preferred', priority: 'Essential' },
  { group: 'Lightning network', fields: 'Flash time, latitude/longitude, polarity, peak current, cloud-to-ground/intra-cloud type, network detection efficiency', priority: 'Essential' },
  { group: 'INSAT', fields: 'Calibrated IR / water-vapour / visible imagery, cloud-top temperature, navigation and acquisition timestamps', priority: 'Essential' },
  { group: 'Storm labels', fields: 'Event polygons/cell tracks, initiation and dissipation times, severity, lightning/rain outcomes; matched to each observation time', priority: 'Essential' },
  { group: 'Ground weather', fields: 'AWS/ARG station ID and coordinates, rainfall, pressure, temperature, humidity, wind speed/direction with quality flags', priority: 'Strongly recommended' },
  { group: 'NWP / upper air', fields: 'Model cycles and grids; CAPE, CIN, shear, temperature/moisture/winds by pressure level; radiosonde profiles', priority: 'Strongly recommended' },
  { group: 'Provenance', fields: 'Original units, UTC timestamps, latency, missing-data flags, QC flags, licensing, source/version, stable IDs', priority: 'Required for every source' },
]
