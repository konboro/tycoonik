// js/ui-core.js - WERSJA Z NOWOCZESNYMI FILTRAMI W PANELU
import { state } from './state.js';
import { config } from './config.js';
import { map } from './state.js';
import { $, fmt, getProximityBonus, createIcon, getIconHtml, ICONS, getWeatherIcon } from './utils.js';
import { calculateAssetValue } from './logic.js'; 

// Importujemy "Malarzy"
import { 
    renderVehicleList, renderInfrastructure, renderLootboxTab, renderMarket, 
    renderRankings, renderCharts, renderAchievements, renderEnergyPrices, 
    renderTransactionHistory, renderGuildTab, renderCompanyTab, renderFriendsTab, 
    renderStationDetails, renderVehicleCard, renderEmptyState, renderSectionTitle
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
        document.querySelectorAll('.nav-item.bg-gray-800').forEach(el => el.classList.remove('bg-gray-800', 'text-white'));
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

    // 1. Generuj przyciski typów pojazdów (Prawy Górny)
    const types = ['plane', 'train', 'bus', 'tube', 'tram', 'river-bus', 'scooter', 'bike'];
    
    typesContainer.innerHTML = '';
    types.forEach(type => {
        const btn = document.createElement('button');
        btn.className = `w-10 h-10 bg-gray-800/90 border border-gray-600 rounded-lg flex items-center justify-center text-xl shadow-lg transition-all hover:bg-gray-700 map-type-filter`;
        btn.dataset.type = type;
        btn.title = `Pokaż/Ukryj: ${type}`;
        
        btn.innerHTML = getIconHtml(type, "w-6 h-6");
        
        btn.addEventListener('click', () => {
            if (state.filters.types.includes(type)) {
                state.filters.types = state.filters.types.filter(t => t !== type);
            } else {
                state.filters.types.push(type);
            }
            updateMapFilterButtons(); 
            redrawMap(); 
            // Jeśli panel jest otwarty, odśwież go też
            if (state.activeTab === 'store' || state.activeTab === 'fleet') render();
        });
        
        typesContainer.appendChild(btn);
    });

    // 2. Obsługa przełącznika Moje/Wszystkie (Prawy Dolny)
    ownershipContainer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.dataset.mapView;
            state.filters.mapView = mode;
            updateMapFilterButtons();
            redrawMap();
        });
    });

    updateMapFilterButtons();
}

// Funkcja aktualizująca wygląd przycisków na podstawie state.filters
function updateMapFilterButtons() {
    // Aktualizuj typy (Prawy Górny)
    document.querySelectorAll('.map-type-filter').forEach(btn => {
        const type = btn.dataset.type;
        if (state.filters.types.includes(type)) {
            btn.classList.add('filter-btn-active');
            btn.classList.remove('filter-btn-inactive');
        } else {
            btn.classList.remove('filter-btn-active');
            btn.classList.add('filter-btn-inactive');
        }
    });

    // Aktualizuj ownership (Prawy Dolny)
    document.querySelectorAll('[data-map-view]').forEach(btn => {
        if (btn.dataset.mapView === state.filters.mapView) {
            btn.classList.add('view-toggle-active');
        } else {
            btn.classList.remove('view-toggle-active');
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
    
    for (const stationCode in config.infrastructure) {
        const station = config.infrastructure[stationCode];
        const key = `station:${stationCode}`;
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
        const asset = config.guildAssets[assetKey];
        const key = `guildasset:${assetKey}`;
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
        walletEl.offsetHeight; 
        
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
    set('estimated-assets', fmt(estimatedAssets));
    
    const earningsHistory = state.profile.earnings_history || [];
    
    const validEarnings = earningsHistory.filter(e => 
        typeof e === 'number' && 
        isFinite(e) && 
        !isNaN(e) && 
        e !== null && 
        e !== undefined
    );
    
    let hourlyEstimate = 0;
    if (validEarnings.length > 0) {
        const totalEarnings = validEarnings.reduce((sum, earning) => sum + earning, 0);
        const avgPerMinute = totalEarnings / validEarnings.length;
        hourlyEstimate = avgPerMinute * 60;
    }
    
    const odometer = $('hourly-earnings-odometer');
    if(odometer) {
        const earnings = Math.max(0, Math.round(hourlyEstimate));
        const formattedEarnings = earnings.toLocaleString('pl-PL').padStart(6, '0');
        
        odometer.innerHTML = '';
        
        for (const char of formattedEarnings) {
            if (char !== ' ' && char !== '.' && char !== ',') {
                const digitEl = document.createElement('span');
                digitEl.className = 'odometer-digit';
                digitEl.textContent = char;
                odometer.appendChild(digitEl);
            }
        }
        
        const labelEl = document.createElement('span');
        labelEl.className = 'odometer-label';
        labelEl.textContent = 'VC/h';
        odometer.appendChild(labelEl);
    }

    const hasUnclaimed = Object.values(state.achievements).some(a => a.unlocked && !a.claimed);
    const dot = $('ach-notification-dot'); if(dot) dot.style.display = hasUnclaimed ? 'block' : 'none';
    setTxt('company-logo', state.profile.logo || '🏢');
    
    const kpiPanel = $('kpi-panel');
    if(kpiPanel) {
        kpiPanel.classList.remove('border-blue-500', 'border-green-500', 'border-red-500', 'border-yellow-500', 'border-purple-500');
        kpiPanel.classList.add(`border-${state.profile.color}-500`);
    }
}

export function forceUpdateWallet() {
    const walletEl = $('wallet');
    if (walletEl) {
        const newValue = fmt(state.wallet);
        walletEl.textContent = newValue;
        walletEl.style.color = '#22c55e';
        setTimeout(() => { walletEl.style.color = ''; }, 300);
        console.log(`💰 Wallet force updated: ${newValue}`);
    }
}

// ===== 4. GŁÓWNY RENDERER =====

const panelTitles = { stations: "Infrastruktura", store: "Sklep", fleet: "Moja Flota", market: "Giełda", lootbox: "Skrzynki", achievements: "Osiągnięcia", stats: "Statystyki", friends: "Znajomi", rankings: "Ranking", energy: "Ceny Energii", guild: "Gildia", transactions: "Historia Transakcji", company: "Personalizacja Firmy" };

export function render() {
    const listContainer = $('mainList');
    if(!listContainer) return;
    
    listContainer.innerHTML = '';
    const titleEl = $('panel-title'); if(titleEl) titleEl.textContent = panelTitles[state.activeTab] || state.activeTab;
    
    const controls = $('panel-controls');
    const filtersContainer = $('filters-container');
    const showControls = ['store', 'fleet', 'stations', 'market'].includes(state.activeTab);
    if(controls) controls.style.display = showControls ? 'block' : 'none';

    // === ZMODYFIKOWANA SEKCJA FILTRÓW W PANELU (Kafelki/Buttony) ===
    if (showControls && filtersContainer) {
        filtersContainer.innerHTML = '';
        let filterHtml = '<div class="space-y-4">';

        if (state.activeTab !== 'stations') { 
            // 1. TYPY POJAZDÓW (Ikony w Gridzie)
            filterHtml += '<div><h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Typ Pojazdu</h4><div class="grid grid-cols-4 gap-2">';
            const types = ['plane', 'train', 'bus', 'tube', 'tram', 'river-bus', 'scooter', 'bike'];
            types.forEach(t => {
                const active = state.filters.types.includes(t);
                const activeClass = active ? 'filter-btn-active' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white';
                filterHtml += `<button class="panel-filter-btn h-10 w-full ${activeClass}" data-filter-category="types" data-filter-value="${t}" title="${t}">${getIconHtml(t, "w-6 h-6")}</button>`;
            });
            filterHtml += '</div></div>';

            // 2. RZADKOŚĆ (Tagi Flex)
            filterHtml += '<div><h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Rzadkość</h4><div class="flex flex-wrap gap-2">';
            const rarities = [
                { id: 'common', label: 'Common', color: 'border-gray-500 text-gray-400' },
                { id: 'rare', label: 'Rare', color: 'border-blue-500 text-blue-400' },
                { id: 'epic', label: 'Epic', color: 'border-purple-500 text-purple-400' },
                { id: 'legendary', label: 'Legendary', color: 'border-amber-500 text-amber-400' }
            ];
            rarities.forEach(r => {
                const active = state.filters.rarities.includes(r.id);
                const baseClass = `px-3 py-1 text-xs font-bold border rounded-full transition-colors`;
                // Jeśli aktywny, dajemy niebieskie tło. Jeśli nie, to przezroczyste z kolorowym borderem
                const activeClass = active ? 'filter-btn-active border-transparent' : `bg-transparent ${r.color} hover:bg-gray-800`;
                filterHtml += `<button class="${baseClass} ${activeClass}" data-filter-category="rarities" data-filter-value="${r.id}">${r.label}</button>`;
            });
            filterHtml += '</div></div>';

            // 3. KRAJ (Tagi Flex)
            filterHtml += '<div><h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Region</h4><div class="flex flex-wrap gap-2">';
            const countries = ['Poland', 'USA', 'Finland', 'UK', 'Greece', 'Europe'];
            countries.forEach(c => {
                const active = state.filters.countries.includes(c);
                const activeClass = active ? 'filter-btn-active' : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white';
                filterHtml += `<button class="px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeClass}" data-filter-category="countries" data-filter-value="${c}">${c}</button>`;
            });
            filterHtml += '</div></div>';
        }

        // Dodatkowe opcje dla widoku stacji
        if (state.activeTab === 'stations') {
             filterHtml += '<div class="text-sm text-gray-400 text-center italic">Filtrowanie stacji wkrótce...</div>';
        }

        filterHtml += '</div>'; // koniec space-y-4
        filtersContainer.innerHTML = filterHtml;
    }
    
    switch (state.activeTab) { 
        case 'stats': renderCharts(listContainer); break; 
        case 'achievements': renderAchievements(listContainer); break; 
        case 'lootbox': renderLootboxTab(listContainer); break; 
        case 'stations': renderInfrastructure(listContainer); break; 
        case 'energy': renderEnergyPrices(listContainer); break; 
        case 'market': renderMarket(listContainer); break; 
        case 'rankings': renderRankings(listContainer); break; 
        case 'guild': renderGuildTab(listContainer); break; 
        case 'friends': renderFriendsTab(listContainer); break; 
        case 'transactions': renderTransactionHistory(listContainer); break; 
        case 'company': renderCompanyTab(listContainer); break; 
        case 'store': case 'fleet': renderVehicleList(listContainer); break; 
        default: break; 
    }
    
    const vehicleCard = $('vehicle-card');
    if (vehicleCard) {
        if (state.selectedVehicleKey) { renderVehicleCard(state.selectedVehicleKey); } 
        else { vehicleCard.classList.add('translate-y-full'); }
    }
    
    redrawMap();
}