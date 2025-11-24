import { state, map } from './state.js';
import { $ } from './utils.js';
//import { fetchPlanes, fetchBUS, fetchTUBE, fetchFI, fetchEnergyPrices, fetchGlobalTakenVehicles, updateVehiclesWithWeather } from './api.js';

import { fetchAllVehicles, fetchEnergyPrices, fetchGlobalTakenVehicles, forceRefreshVehicles, autoRefreshIfNeeded, getApiStatus } from './api-server.js';
import { updateVehiclesWithWeather } from './api.js';

import { 
    tickEconomy, 
    tickAllInfrastructure, 
    tickGuilds, 
    generateAIPlayers, 
    logDailyEarnings, 
    updateRankings 
} from './logic.js';

import { 
    render, 
    updateUI, 
    showPlayerLocation, 
    redrawMap,
    forceUpdateWallet
} from './ui-core.js';

import { setupEventListeners } from './ui.js';
import { handleLogin, handleRegister } from './supabase.js';

// EXPOSE TO GLOBAL SCOPE FOR CONSOLE ACCESS
window.state = state;
window.updateUI = updateUI;
window.forceUpdateWallet = forceUpdateWallet;
window.render = render;
window.tickEconomy = tickEconomy;

// --- POPRAWKA JEST TUTAJ ---
// Usunąłem błędny fragment "/512" z adresu URL.
const MAP_KEY = 'gVLyar0EiT75LpMPvAGQ';
const MAP_URL = `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${MAP_KEY}`;

L.tileLayer(MAP_URL, { 
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
    // Te opcje są poprawne i muszą zostać, aby mapa działała z kafelkami 512px
    tileSize: 512, 
    zoomOffset: -1, 
    
    maxZoom: 22,
    minZoom: 0, 
    crossOrigin: true
}).addTo(map);
// --- KONIEC POPRAWKI ---


// Tworzymy warstwę dla budynków
map.createPane('buildingsPane');
map.getPane('buildingsPane').style.zIndex = 650;

map.on('zoomend', () => {
    redrawMap();
});

async function init() {
  console.log("🎮 Game starting...");
  
  const loginBtn = $('btn-login');
  const regBtn = $('btn-register');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(regBtn) regBtn.addEventListener('click', handleRegister);

  generateAIPlayers(); 
  setupEventListeners();
  showPlayerLocation();
  
  // UPDATED: Better debugging and error handling for server-side API
  try {
    console.log("🔄 Loading vehicles from server cache...");
    const vehicles = await fetchAllVehicles();
    console.log("✅ Vehicles loaded:", vehicles?.length || 0);
    
    // Debug: Check if vehicles were actually loaded into state
    const totalInState = Object.values(state.vehicles).reduce((sum, vehicleMap) => sum + vehicleMap.size, 0);
    console.log("🎯 Vehicles in state:", totalInState);
    
    // Debug: Log each vehicle type count
    Object.keys(state.vehicles).forEach(type => {
        const count = state.vehicles[type].size;
        if (count > 0) {
            console.log(`  ${type}: ${count} vehicles`);
            // Log a sample vehicle for debugging
            const sample = Array.from(state.vehicles[type].values())[0];
            if (sample) {
                console.log(`    Sample ${type}:`, { id: sample.id, lat: sample.lat, lon: sample.lon, title: sample.title });
            }
        }
    });
    
    await fetchEnergyPrices();
    console.log("✅ Loaded vehicle data from server cache");
} catch (e) { 
    console.warn("❌ Server API Error:", e); 
    console.log("🔄 Trying to force refresh server cache...");
    try {
        await forceRefreshVehicles();
        console.log("✅ Force refresh completed, retrying...");
        await fetchAllVehicles();
    } catch (e2) {
        console.error("❌ Force refresh also failed:", e2);
    }
}

  await fetchGlobalTakenVehicles();
  
    // Update the periodic refresh:
    setInterval(async () => {
        console.log("⏰ Auto-refresh check...");
        await autoRefreshIfNeeded();
        await fetchGlobalTakenVehicles();
        updateVehiclesWithWeather(state.vehicles.plane);
        render();
    }, 5 * 60 * 1000); // 5 minutes instead of 1 minute

  setInterval(tickEconomy, 60000);
  setInterval(tickGuilds, 60000);
  setInterval(() => { logDailyEarnings(); updateRankings(); }, 300000);
  setTimeout(tickEconomy, 3000);
  
  tickAllInfrastructure();
  setInterval(tickAllInfrastructure, 90000);
  
  updateRankings();
  
  // Force initial render after everything is loaded
  console.log("🎨 Initial render...");
  render();
  
  // Debug: Check if markers are being created
  setTimeout(() => {
    console.log("🗺️ Map markers count:", state.markers.size);
    console.log("🗺️ Map bounds:", map.getBounds());
    console.log("🗺️ Map center:", map.getCenter());
  }, 2000);
  
  // Log global scope exposure for debugging
  console.log("🌐 Game functions exposed to global scope for console access:");
  console.log("  - window.state (game state)");
  console.log("  - window.updateUI (update UI)");
  console.log("  - window.render (re-render)");
  console.log("  - window.tickEconomy (manual economy tick)");
}

// Add a debug function that can be called from browser console
window.debugVehicles = () => {
    console.log("=== VEHICLE DEBUG INFO ===");
    Object.keys(state.vehicles).forEach(type => {
        const count = state.vehicles[type].size;
        console.log(`${type}: ${count} vehicles`);
        if (count > 0) {
            const vehicles = Array.from(state.vehicles[type].values()).slice(0, 3);
            vehicles.forEach(v => {
                console.log(`  - ${v.id}: ${v.title} at [${v.lat}, ${v.lon}]`);
            });
        }
    });
    console.log("Map markers:", state.markers.size);
    console.log("Active filters:", state.filters);
    console.log("=========================");
};

// Add debug function for forcing refresh
window.debugRefresh = async () => {
    console.log("🔄 Manual refresh triggered...");
    try {
        await forceRefreshVehicles();
        await fetchAllVehicles();
        render();
        console.log("✅ Manual refresh completed");
    } catch (e) {
        console.error("❌ Manual refresh failed:", e);
    }
};

document.addEventListener('DOMContentLoaded', init);