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
    renderRealEstateMarket
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

    ownershipContainer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.filters.mapView = e.target.dataset.mapView;
            updateMapFilterButtons(); redrawMap();
        });
    });
    updateMapFilterButtons();
}

// EKSPORTUJEMY TĘ FUNKCJĘ, ABY UI.JS MÓGŁ JEJ UŻYWAĆ
export function updateMapFilterButtons() {
    document.querySelectorAll('.map-type-filter').forEach(btn => {
        const type = btn.dataset.type;
        if (state.filters.types.includes(type)) {
            btn.classList.add('filter-btn-active'); 
            btn.classList.remove('opacity-50');
        } else {
            btn.classList.remove('filter-btn-active');
            btn.classList.add('opacity-50');
        }
    });
    document.querySelectorAll('[data-map-view]').forEach(btn => {
        if (btn.dataset.mapView === state.filters.mapView) {
            btn.classList.add('text-black', 'bg-[#eab308]', 'border-[#eab308]');
            btn.classList.remove('text-gray-400', 'bg-[#121212]', 'border-[#333]');
        } else {
            btn.classList.remove('text-black', 'bg-[#eab308]', 'border-[#eab308]');
            btn.classList.add('text-gray-400', 'bg-[#121212]', 'border-[#333]');
        }
    });
}

function createVehicleMarkerHtml(vehicle, isOwned) {
    const iconPath = ICONS[vehicle.type] || '❓';
    
    if (iconPath.includes('.png') || iconPath.includes('/assets/')) {
        return `
            <div class="w-10 h-10 flex items-center justify-center">
                <img src="${iconPath}" 
                     class="w-8 h-8 object-contain drop-shadow-lg" 
                     style="opacity: 0; transition: opacity 0.3s;"
                     onload="this.style.opacity = 1;"
                     onerror="this.parentNode.innerHTML='🛵';">
            </div>
        `;
    }
    
    return `<div class="w-10 h-10 flex items-center justify-center text-2xl">${iconPath}</div>`;
}

// ===== ZAKTUALIZOWANA FUNKCJA: redrawMap =====
export function redrawMap() {
    const visibleKeys = new Set();
    
    Object.values(state.vehicles).forEach(vehicleMap => {
        for (const v of vehicleMap.values()) {
            const key = `${v.type}:${v.id}`;
            const isOwned = !!state.owned[key];

            // 1. FILTR WŁASNOŚCI
            if (state.filters.mapView === 'fleet' && !isOwned) continue;

            // 2. FILTR TYPÓW
            const typeMatch = state.filters.types.includes(v.type);
            
            // 3. FILTR KRAJÓW
            const countryMatch = !v.country || state.filters.countries.includes(v.country);

            let entry = state.markers.get(key);

            if (typeMatch && countryMatch && v.lat != null && isFinite(v.lat) && v.lon != null && isFinite(v.lon)) {
                visibleKeys.add(key);
                
                const iconHtml = createVehicleMarkerHtml(v, isOwned);

                if (!entry) {
                    const marker = L.marker([v.lat, v.lon], { icon: createIcon(isOwned && v.isMoving) }).addTo(map);
                    marker.getElement().innerHTML = iconHtml;
                    marker.on('click', () => { 
                        const vData = state.vehicles[v.type]?.get(v.id);
                        if (!vData) return;
                        state.selectedVehicleKey = key;
                        render(); 
                    });
                    entry = { marker, trail: null };
                    state.markers.set(key, entry);
                } else {
                    entry.marker.setLatLng([v.lat, v.lon]);
                    const iconEl = entry.marker.getElement();
                    if (iconEl) {
                         if(iconEl.innerHTML !== iconHtml) iconEl.innerHTML = iconHtml;
                         
                        if (isOwned && v.isMoving) iconEl.classList.add('is-moving');
                        else iconEl.classList.remove('is-moving');
                    }
                }
                
                if (isOwned && v.history && v.history.length > 1) { 
                    const latlngs = v.history.map(p => [p.lat, p.lon]); 
                    if (entry.trail) { entry.trail.setLatLngs(latlngs); } 
                    else { entry.trail = L.polyline(latlngs, { color: 'rgba(59, 130, 246, 0.5)', weight: 3 }).addTo(map); } 
                } else if (entry.trail) { 
                    entry.trail.remove(); entry.trail = null; 
                }

            }
        }
    });

    for (const [key, entry] of state.markers.entries()) {
        if (!visibleKeys.has(key) && !key.startsWith('station:') && !key.startsWith('guildasset:')) {
            if(entry.marker) entry.marker.remove();
            if(entry.trail) entry.trail.remove();
            state.markers.delete(key);
        }
    }
    
    const showInfrastructure = state.filters.types.includes('infrastructure');

    for (const stationCode in config.infrastructure) {
        const key = `station:${stationCode}`;
        
        if (!showInfrastructure) {
            if (state.markers.has(key)) {
                state.markers.get(key).marker.remove();
                state.markers.delete(key);
            }
            continue;
        }

        const station = config.infrastructure[stationCode];
        if (station && !state.markers.has(key)) {
            const marker = L.marker([station.lat, station.lon], { 
                icon: L.divIcon({ 
                    className: 'leaflet-marker-icon', 
                    html: `<div class="w-16 h-16 drop-shadow-lg">${getIconHtml('station_' + station.type)}</div>`, 
                    iconSize: [64, 64], 
                    iconAnchor: [32, 32] 
                }),
                pane: 'buildingsPane', 
                zIndexOffset: 100
            }).addTo(map);
            marker.bindPopup(`<b>${station.name}</b>`).on('click', () => { 
                state.activeTab = 'stations';
                state.selectedStationId = stationCode;
                render();
                toggleContentPanel(true);
            });
            state.markers.set(key, { marker });
        }
    }

    for (const assetKey in config.guildAssets) {
        const key = `guildasset:${assetKey}`;

        if (!showInfrastructure) {
            if (state.markers.has(key)) {
                state.markers.get(key).marker.remove();
                state.markers.delete(key);
            }
            continue;
        }

        const asset = config.guildAssets[assetKey];
        let ownerGuildName = null;
        for (const guildId in state.guild.guilds) {
            if (state.guild.guilds[guildId].ownedAssets && state.guild.guilds[guildId].ownedAssets[assetKey]) {
                ownerGuildName = state.guild.guilds[guildId].name;
                break;
            }
        }
        let popupContent = `<b>${asset.name}</b><br>${asset.realProduction}`;
        if (ownerGuildName) popupContent += `<br><span class="text-blue-400">Właściciel: ${ownerGuildName}</span>`;
        else popupContent += `<br><span class="text-green-400">Na sprzedaż</span>`;

        if (!state.markers.has(key)) {
             const marker = L.marker([asset.lat, asset.lon], {
                 icon: L.divIcon({ 
                     className: 'leaflet-marker-icon', 
                     html: `<div class="w-16 h-16 drop-shadow-xl">${getIconHtml('asset_power-plant')}</div>`, 
                     iconSize: [64, 64], 
                     iconAnchor: [32, 32] 
                 }),
                 pane: 'buildingsPane', 
                 zIndexOffset: 100
            }).addTo(map);
            marker.bindPopup(popupContent).on('click', () => { 
                state.activeTab = 'guild';
                render();
                toggleContentPanel(true);
            });
            state.markers.set(key, { marker });
        } else {
            state.markers.get(key).marker.getPopup().setContent(popupContent);
        }
    }
}

// ===== 3. GŁÓWNA AKTUALIZACJA UI (KPI) =====

export function updateUI(inM, outM) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    
    const walletEl = $('wallet');
    if (walletEl) {
        const formattedWallet = fmt(state.wallet);
        walletEl.textContent = formattedWallet;
        
        if (walletEl.dataset.lastValue && walletEl.dataset.lastValue !== formattedWallet) {
            walletEl.style.color = '#22c55e';
            setTimeout(() => { walletEl.style.color = ''; }, 500);
        }
        walletEl.dataset.lastValue = formattedWallet;
    }
    
    set('company-name', state.profile.companyName);
    set('level', state.profile.level);
    set('xp', Math.round(state.profile.xp));
    set('xpNext', 100 + (state.profile.level-1)*50);
    const xpBar = $('xpProgressBar'); 
    if(xpBar) xpBar.style.width = `${(state.profile.xp / (100+(state.profile.level-1)*50))*100}%`;
    
    set('owned-vehicles-count', Object.keys(state.owned).length);
    const buildingCount = Object.values(state.infrastructure).reduce((sum, category) => sum + Object.values(category).filter(item => item.owned).length, 0);
    set('owned-buildings-count', buildingCount);
    
    const estimatedAssets = Math.max(0, calculateAssetValue() - state.wallet); 
    // set('estimated-assets', fmt(estimatedAssets)); 
    
    const earningsHistory = state.profile.earnings_history || [];
    
    const validEarnings = earningsHistory.filter(e => 
        typeof e === 'number' && 
        isFinite(e) && 
        !isNaN(e) && 
        e !== null &&