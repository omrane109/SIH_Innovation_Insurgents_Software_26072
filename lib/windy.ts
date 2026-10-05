/** Windy public embed URL builder. No proxying, scraping or reuse of Windy tiles/data. */
export const windyLayers = [
  { id: 'wind', label: 'Wind', group: 'forecast' },
  { id: 'rain', label: 'Rain / snow', group: 'forecast' },
  { id: 'temp', label: 'Temperature', group: 'forecast' },
  { id: 'clouds', label: 'Clouds', group: 'forecast' },
  { id: 'pressure', label: 'Pressure', group: 'forecast' },
  { id: 'gust', label: 'Wind gusts', group: 'forecast' },
  { id: 'rainAccu', label: 'Rain accumulation', group: 'forecast' },
  { id: 'thunder', label: 'Rain / thunder', group: 'forecast' },
  { id: 'cape', label: 'CAPE', group: 'forecast' },
  { id: 'radar', label: 'Weather radar', group: 'visual' },
  { id: 'satellite', label: 'Satellite', group: 'visual' },
] as const
export type WindyLayer = typeof windyLayers[number]['id']
export type WindyCoordinates = { lat: number; lon: number; zoom: number }
export const windyLocations = [
  {name:'Mumbai',lat:19.076,lon:72.8777,zoom:6},
  {name:'Pune',lat:18.52,lon:73.8567,zoom:7},
  {name:'Delhi',lat:28.6139,lon:77.209,zoom:6},
  {name:'Kolkata',lat:22.5726,lon:88.3639,zoom:6},
  {name:'Bengaluru',lat:12.9716,lon:77.5946,zoom:6},
] as const
export function validCoords({lat,lon,zoom}:WindyCoordinates) {
  return Number.isFinite(lat)&&lat>=-85&&lat<=85&&Number.isFinite(lon)&&lon>=-180&&lon<=180&&Number.isInteger(zoom)&&zoom>=3&&zoom<=12
}
export function makeWindyEmbedUrl(coords:WindyCoordinates, layer:WindyLayer, forecast=false):string {
  if(!validCoords(coords)) throw new Error('Invalid map coordinates or zoom.')
  if(!windyLayers.some(item=>item.id===layer)) throw new Error('Invalid Windy layer.')
  const params=new URLSearchParams({
    type:forecast?'forecast':'map', location:'coordinates',
    metricRain:'default', metricTemp:'default', metricWind:'default',
  })
  if(forecast){params.set('detail','true');params.set('detailLat',String(coords.lat));params.set('detailLon',String(coords.lon))}
  else{
    params.set('zoom',String(coords.zoom));params.set('overlay',layer)
    params.set('product',layer==='radar'?'radar':layer==='satellite'?'satellite':'')
    params.set('level','surface');params.set('lat',String(coords.lat));params.set('lon',String(coords.lon))
    params.set('detail','true');params.set('detailLat',String(coords.lat));params.set('detailLon',String(coords.lon))
  }
  return `https://embed.windy.com/embed.html?${params.toString()}`
}
export function makeWindyFullUrl(coords:WindyCoordinates, layer:WindyLayer):string {
  if(!validCoords(coords)||!windyLayers.some(x=>x.id===layer))throw new Error('Invalid Windy map configuration')
  return `https://www.windy.com/?${layer},${coords.lat.toFixed(3)},${coords.lon.toFixed(3)},${coords.zoom}`
}
