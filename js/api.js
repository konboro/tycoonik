import { state } from './state.js';
import { PROXIES, countryCoords, genericWeather } from './config.js';
import { jitter } from './utils.js'; 
import { supabase } from './supabase.js';

async function getJSON(url) { 
    for (const p of PROXIES) { 
        try { 
            const r = await fetch(p + url); 
            if (!r.ok) throw new Error(`HTTP ${r.status}`); 
            return await r.json(); 
        } catch (e) {} 
    } 
    return null; 
}

export async function fetchGlobalTakenVehicles() {
    const { data } = await supabase.from('vehicles').select('vehicle_api_id, type');
    if (data) { 
        state.globalTaken.clear(); 
        data.forEach(row => state.globalTaken.add(`${row.type}:${row.vehicle_api_id}`)); 
    }
}

// --- AKTUALIZACJA CEN PALIW (GLOBALNA) ---
export async function fetchEnergyPrices() { 
    // Symulacja wahań rynkowych
    const fluctuate = (price) => {
        const change = (Math.random() - 0.5) * 0.02; // +/- 1%
        return Math.max(0.1, parseFloat((price + change).toFixed(2)));
    };

    const fuels = state.economy.globalFuels;
    
    // Aktualizujemy ceny
    fuels['Diesel'].price = fluctuate(fuels['Diesel'].price);
    fuels['Benzyna'].price = fluctuate(fuels['Benzyna'].price);
    fuels['Aviation'].price = fluctuate(fuels['Aviation'].price);
    fuels['Electricity'].price = fluctuate(fuels['Electricity'].price);

    // Losujemy trendy dla UI
    const trends = ['up', 'down', 'stable'];
    for (const key in fuels) {
        if (Math.random() > 0.7) {
            fuels[key].trend = trends[Math.floor(Math.random() * trends.length)];
        }
    }
}

export async function updateVehiclesWithWeather(vehicleMap) { 
    const vehicles = Array.from(vehicleMap.values()).slice(0, 15); 
    for (const v of vehicles) { v.weather = await fetchWeather(v.lat, v.lon) || genericWeather; } 
}

async function fetchWeather(lat, lon) { if (lat == null || lon == null) return null; const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`; if (state.weatherCache.has(key)) return state.weatherCache.get(key); try { const data = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current_weather=true`); state.weatherCache.set(key, data.current_weather); return data.current_weather; } catch (e) { return null; } }

export async function fetchTrainStationData(stationShortCode) { try { const url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationShortCode}?minutes_before_departure=120&minutes_after_departure=15&minutes_before_arrival=120&minutes_after_arrival=15`; const data = await getJSON(url); return data || []; } catch (e) { return []; } }
export async function fetchTfLArrivals(naptanId) { try { const url = `https://api.tfl.gov.uk/StopPoint/${naptanId}/Arrivals`; const data = await getJSON(url); return data || []; } catch (e) { return []; } }
export async function fetchMbtaBusTerminalData(stopId) { try { const url = `https://api-v3.mbta.com/predictions?filter[stop]=${stopId}&include=trip,route`; const data = await getJSON(url); return data || []; } catch (e) { return []; } }
export async function fetchCableCarStatus(lineId) { try { const url = `https://api.tfl.gov.uk/Line/${lineId}/Status`; const data = await getJSON(url); if (!data) return null; return data[0] || null; } catch (e) { return null; } }

// Pozostałe funkcje fetch (fetchPlanes, fetchBUS itd.) mogą zostać usunięte jeśli używasz api-server.js, 
// lub zostawione jako fallback. W tym kodzie skupiamy się na zmianie fetchEnergyPrices.