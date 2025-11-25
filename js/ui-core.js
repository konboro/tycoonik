import { state } from './state.js';
import { config } from './config.js';
import { map } from './state.js';
import { $, fmt, getProximityBonus, createIcon, getIconHtml, ICONS, getWeatherIcon } from './utils.js';
import { calculateAssetValue } from './logic.js'; 
import { 
    renderVehicleList, renderInfrastructure, renderLootboxTab, renderMarket, 
    renderRankings, renderStats, renderAchievements, renderEnergyPrices, 
    renderTransactionHistory, renderGuildTab, renderCompanyTab, renderFriendsTab, 
    renderStationDetails, renderVehicleCard, renderEmptyState, renderSectionTitle,
    renderRealEstateMarket // <--- NOWY IMPORT
} from './renderers.js';

// ===== 1. FUNKCJE POMOCNICZE UI =====

export function toggleContentPanel(forceVisible) {
    const panel = $('content-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('-translate-x-full');
    const shouldShow = typeof forceVisible === 'boolean' ? forceVisible : isHidden;

    panel.classList.toggle('-translate-x-full', !shouldShow);
    panel.classList.toggle('translate-x-0', shouldShow);

    if (!shouldShow) {
        state.activeTab = null;
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    }
}

function getCompanyInfoPopupContent() {
    const companyName = state.profile.companyName || 'Moja Firma';
    const vehicleCount = Object.keys(state.owned).length;
    let buildingCount = 0;
    Object.values(state.infrastructure).forEach(category => {
        Object.values(category).forEach(item => { if (item.owned) buildingCount++; });
    });
    const companyValue = calculateAssetValue(); 
    return `<div style="font-family: 'Inter', sans-serif;"><h3 style="margin: 0; font-size: 16px; font-weight: bold;">${companyName}</h3><ul style="list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 14px;"><li style="margin-bottom: 4px;"><strong>Pojazdy:</strong> ${vehicleCount}</li><li style="margin-bottom: 4px;"><strong>Budynki:</strong> ${buildingCount}</li><li><strong>Wartość firmy:</strong> ${fmt(companyValue)} VC</li></ul></div>`;
}

export function showPlayerLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(position => {
            const { latitude, longitude } = position.coords;
            state.playerLocation = { lat: latitude, lon: longitude }; 
            
            const playerIcon = L.divIcon({
                className: 'player-location-icon',
                html: `<div class="text-3xl">${state.profile.logo || '🏢'}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            if (state.playerMarker) {
                state.playerMarker.setLatLng([latitude, longitude]);
            } else {
                state.playerMarker = L.marker([latitude, longitude], { icon: playerIcon }).addTo(map);
                state.playerMarker.bindPopup(getCompanyInfoPopupContent);
                map.setView([latitude, longitude], 13);
            }

            if (state.proximityCircle) {
                state.proximityCircle.setLatLng([latitude, longitude]);
            } else {
                state.proximityCircle = L.circle([latitude, longitude], {
                    radius: 100000, 
                    color: 'green',
                    fillColor: '#22c55e',
                    fillOpacity: 0.15,
                    weight: 1
                }).addTo(map);
            }
        }, (error) => { console.warn("Nie można uzyskać lokalizacji:", error.message); }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    } else { console.warn("Geolokalizacja nie jest wspierana."); }
}

export function updatePlayerMarkerIcon() {
    if (state.playerMarker) {
        const playerIcon = L.divIcon({
            className: 'player-location-icon',
            html: `<div class="text-3xl">${state.profile.logo || '🏢'}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        state.playerMarker.setIcon(playerIcon);
    }
}

// ===== NOWA FUNKCJA: Inicjalizacja filtrów na mapie =====
export function initMapFilters() {
    const typesContainer = $('map-filters-types');
    const ownershipContainer = $('map-filters-ownership');
    
    if (!typesContainer || !ownershipContainer) return;

    const types = ['infrastructure', 'plane', 'train', 'bus', 'tube', 'tram', 'river-bus', 'scooter', 'bike'];
    
    if (!state.filters.types.includes('infrastructure')) {
        state.filters.types.push('infrastructure');
    }

    typesContainer.innerHTML = '';
    types.forEach(type => {
        const btn = document.createElement('button');
        btn.className = `w-10 h-10 bg-[#121212] border border-[#333] flex items-center justify-center text-xl shadow-lg transition-all hover:bg-[#222] map-type-filter`;
        btn.dataset.type = type;
        btn.title = type === 'infrastructure' ? 'Pokaż/Ukryj Infrastrukturę' : `Pokaż/Ukryj: ${type}`;
        
        if (type === 'infrastructure') {
            btn.innerHTML = '<i class="ri-community-line"></i>';
        } else {
            btn.innerHTML = getIconHtml(type, "w-6 h-6");
        }
        
        btn.addEventListener('click', () => {
            if (state.filters.types.includes(type)) { state.filters.types = state.filters.types.filter(t => t !== type); } 
            else { state.filters.types.push(type); }
            updateMapFilterButtons(); redrawMap(); 
            if (state.activeTab === 'store' || state.activeTab === 'fleet') render();
        });
        typesContainer.appendChild(btn);
    });

    ownershipContainer.querySelectorAll('