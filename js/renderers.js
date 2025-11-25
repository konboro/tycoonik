import { state, achievementsList } from './state.js';
import { config, lootboxConfig } from './config.js';
import { $, fmt, getIconHtml, getVehicleRarity, ICONS } from './utils.js';
import { map } from './state.js';

// ... (renderEmptyState, renderSectionTitle, getVehicleEcoSpecs, renderVehicleList BEZ ZMIAN) ...
// Upewnij się, że skopiowałeś te funkcje z poprzedniego kroku lub zostawiłeś je bez zmian

export function renderEmptyState(container, message) { 
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-600 p-8 text-center"><i class="ri-ghost-line text-4xl mb-2"></i><span class="font-mono text-xs uppercase tracking-widest">${message}</span></div>`; 
}

export function renderSectionTitle(container, title) { 
    const el = document.createElement('div'); 
    el.className = 'px-2 py-1 mb-2 text-[10px] font-bold text-[#eab308] uppercase tracking-widest border-b border-[#333]'; 
    el.textContent = title; 
    container.appendChild(el); 
}

function getVehicleEcoSpecs(type) {
    let fuel = 'PRĄD';
    let co2 = '0 g/km';
    if (['plane'].includes(type)) { fuel = 'JET-A1'; co2 = '285 g/km'; } 
    else if (['bus', 'river-bus'].includes(type)) { fuel = 'DIESEL'; co2 = type === 'bus' ? '85 g/km' : '110 g/km'; } 
    else if (['bike'].includes(type)) { fuel = 'MIĘŚNIE'; co2 = '0 g/km'; }
    return { fuel, co2 };
}

export function renderVehicleList(container) {
    const searchTerm = $('search').value.toLowerCase();
    let listSource = [];
    if (state.activeTab === 'store') { 
        let all = []; 
        Object.values(state.vehicles).forEach(m => all.push(...m.values())); 
        listSource = all.filter(v => !state.owned[`${v.type}:${v.id}`]); 
    } else { 
        listSource = Object.values(state.owned).map(od => { 
            const ld = state.vehicles[od.type]?.get(String(od.id)); 
            const d = { ...od, ...(ld || {}) }; 
            d.status = !ld ? 'offline' : (d.isMoving ? 'in-use' : 'online'); 
            return d; 
        }); 
    }
    
    const filtered = listSource.filter(v => {
        if (!v || !v.type) return false;
        const key = `${v.type}:${v.id}`;
        const isMine = !!state.owned[key];
        if (state.activeTab === 'store' && state.globalTaken.has(key) && !isMine) return false;
        
        const safeName = (v.customName || v.title || '').toLowerCase();
        const searchMatch = !searchTerm || safeName.includes(searchTerm);
        const typeMatch = state.filters.types.length === 0 || state.filters.types.includes(v.type);
        const rarity = getVehicleRarity(v);
        const rarityMatch = state.filters.rarities.length === 0 || state.filters.rarities.includes(rarity);
        const countryMatch = state.filters.countries.length === 0 || !v.country || state.filters.countries.includes(v.country);

        return searchMatch && typeMatch && rarityMatch && countryMatch;
    });

    container.innerHTML = ''; 
    if (filtered.length === 0) { renderEmptyState(container, "BRAK POJAZDÓW"); return; }

    filtered.forEach(v => {
        const key = `${v.type}:${v.id}`;
        const isOwned = !!state.owned[key];
        const ownedData = state.owned[key];
        const price = config.basePrice[v.type] || 1000;
        const rarity = getVehicleRarity(v);
        const eco = getVehicleEcoSpecs(v.type);
        const details = config.vehicleDetails[v.type] || { power: '-', maxSpeed: '-' };
        
        const earningsPerKm = config.baseRate[v.type] || 0;
        const isElectric = config.energyConsumption[v.type] > 0;
        const consumption = isElectric ? config.energyConsumption[v.type] : config.fuelConsumption[v.type];
        const pricePerUnit = state.economy.energyPrices[v.country || 'Europe']?.[isElectric ? 'Electricity' : 'Diesel'] || (isElectric ? 0.22 : 1.85);
        const costPerKm = (consumption / 100) * pricePerUnit;
        const netEarnings = earningsPerKm - costPerKm;

        const el = document.createElement('div');
        el.className = `group bg-[#1a1a1a] border border-[#333] p-3 hover:border-[#eab308] transition-colors cursor-pointer relative overflow-hidden mb-3`;
        el.dataset.key = key;
        
        let statusDotClass = 'bg-gray-600 shadow-[0_0_5px_rgba(75,85,99,0.5)]';
        if (v.status === 'in-use') statusDotClass = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse';
        else if (v.status === 'online') statusDotClass = 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]';

        const vTitle = isOwned ? (ownedData.customName || v.title) : v.title;
        
        let locationDisplay = '';
        if (v.type === 'plane') { locationDisplay = '<i class="ri-global-line text-[#eab308]"></i> GLOBAL'; } 
        else { const flag = (v.country && v.country !== 'Unknown') ? v.country : '🏳️'; locationDisplay = `${flag} ${v.country || 'Nieznany'}`; }

        el.innerHTML = `<div class="flex justify-between items-start mb-4"><div class="flex gap-3 items-center"><div class="w-14 h-14 bg-black border border-gray-700 flex items-center justify-center text-gray-400 text-3xl shrink-0">${getIconHtml(v.type)}</div><div><div class="flex items-center gap-2 mb-1">${isOwned ? `<div class="w-3 h-3 rounded-full ${statusDotClass}" title="Status"></div>` : ''}<div class="font-bold text-white text-base group-hover:text-[#eab308] transition-colors font-header tracking-wide uppercase truncate max-w-[150px] leading-none">${vTitle}</div></div><div class="flex items-center gap-2 text-xs font-mono mt-0.5 uppercase text-gray-400"><span>${locationDisplay}</span><span class="text-[#333]">|</span><span class="text-${rarity === 'legendary' ? 'yellow' : rarity === 'epic' ? 'purple' : 'blue'}-500 font-bold">${rarity}</span></div></div></div><div class="text-right shrink-0">${isOwned ? `<div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Całkowity Zysk</div><div class="font-mono text-2xl text-green-500 font-bold">+${fmt(ownedData.earned_vc || 0)}</div>` : `<div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Cena</div><span class="font-mono text-[#eab308] font-bold text-xl">${fmt(price)} VC</span>`}</div></div><div class="grid grid-cols-3 gap-px bg-[#444] border border-[#333] rounded-sm overflow-hidden mb-3 text-center"><div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Paliwo</div><div class="text-sm text-gray-200 font-mono font-bold">${eco.fuel}</div></div><div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Emisja</div><div class="text-sm text-gray-200 font-mono font-bold">${eco.co2}</div></div><div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Przebieg</div><div class="text-sm text-white font-mono font-bold">${isOwned ? fmt(ownedData.odo_km) : '0'} km</div></div><div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Zysk/km</div><div class="text-sm text-green-500 font-mono font-bold">${earningsPerKm.toFixed(1)}</div></div><div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Koszt/km</div><div class="text-sm text-red-400 font-mono font-bold">${costPerKm.toFixed(1)}</div></div><div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Netto</div><div class="text-sm text-blue-400 font-mono font-bold">${netEarnings.toFixed(1)}</div></div></div>${!isOwned ? `<button class="w-full bg-[#222] hover:bg-[#eab308] hover:text-black text-white text-sm font-bold py-2 uppercase transition border border-[#333]" data-buy="${key}|${price}">Zakup Jednostkę</button>` : `<div class="flex justify-between items-center mt-2 px-1"><div class="text-xs font-mono text-gray-400 flex items-center gap-2"><i class="ri-tools-line"></i> Stan techniczny: <span class="${(ownedData.wear||0) > 80 ? 'text-red-500 font-bold' : 'text-white'}">${100 - Math.round(ownedData.wear || 0)}%</span></div><div class="h-1 w-24 bg-[#333] rounded-full overflow-hidden"><div class="h-full bg-${(ownedData.wear||0) > 80 ? 'red' : 'green'}-500" style="width: ${100 - (ownedData.wear||0)}%"></div></div></div>`}`;
        container.appendChild(el);
    });
}

// ===== ZMODYFIKOWANE FUNKCJE DLA INFRASTRUKTURY =====

// 1. Wyświetla TYLKO posiadane stacje (Zakładka "Infrastruktura")
export function renderInfrastructure(container) {
    let count = 0;
    for (const id in config.infrastructure) {
        const conf = config.infrastructure[id];
        let cat; switch(conf.type) { case 'train': cat='trainStations'; break; case 'tube': cat='tubeStations'; break; case 'cable': cat='cableCar'; break; case 'river-bus': cat='riverPiers'; break; case 'bus': cat='busTerminals'; break; default: continue; }
        const data = state.infrastructure[cat]?.[id];
        
        // FILTR: TYLKO POSIADANE
        if (!data || !data.owned) continue;
        count++;
        
        const el = document.createElement('div'); 
        el.className = `bg-[#1a1a1a] border-l-2 border-[#eab308] p-3 mb-2 flex items-center gap-3 hover:bg-[#222] transition border-b border-r border-t border-[#333] cursor-pointer`;
        el.dataset.stationId = id;
        
        // Obsługa kliknięcia żeby rozwinąć szczegóły
        el.onclick = () => {
            if(state.selectedStationId === id) state.selectedStationId = null;
            else state.selectedStationId = id;
            render(); // Przeładowanie widoku
        };
        
        const flag = '📍'; 
        const locationDisplay = `${flag} ${conf.country || 'Global'}`;

        el.innerHTML = `
            <div class="w-10 h-10 bg-black flex items-center justify-center text-xl text-gray-400">${getIconHtml('station_'+conf.type)}</div>
            <div class="flex-grow">
                <h4 class="font-bold text-white font-header uppercase text-sm">${conf.name}</h4>
                <div class="flex justify-between items-center mt-1">
                    <div class="text-[10px] text-gray-500 font-mono uppercase">${locationDisplay}</div>
                    <div class="text-[10px] text-gray-500 font-mono uppercase">ZYSK: <span class="text-green-500">${fmt(data.totalEarnings)} VC</span></div>
                </div>
            </div>
            <button class="text-gray-500 hover:text-white"><i class="ri-settings-3-line"></i></button>
        `;
        container.appendChild(el);
        
        if (id === state.selectedStationId) { 
            const det = document.createElement('div'); 
            det.className='p-2 bg-black border border-[#333] border-t-0 mb-2 text-xs font-mono'; 
            renderStationDetails(id, det); 
            container.appendChild(det); 
        }
    }
    
    if (count === 0) renderEmptyState(container, "BRAK ZAKUPIONEJ INFRASTRUKTURY");
}

// 2. Wyświetla TYLKO nieposiadane stacje (Zakładka "Rynek Nieruchomości")
export function renderRealEstateMarket(container) {
    let count = 0;
    for (const id in config.infrastructure) {
        const conf = config.infrastructure[id];
        let cat; switch(conf.type) { case 'train': cat='trainStations'; break; case 'tube': cat='tubeStations'; break; case 'cable': cat='cableCar'; break; case 'river-bus': cat='riverPiers'; break; case 'bus': cat='busTerminals'; break; default: continue; }
        const data = state.infrastructure[cat]?.[id];
        
        // FILTR: TYLKO NIEPOSIADANE
        if (!data || data.owned) continue;
        count++;
        
        const el = document.createElement('div'); 
        el.className = `bg-[#1a1a1a] border border-[#333] p-3 mb-2 flex items-center gap-3 hover:bg-[#222] transition`;
        
        const flag = '📍'; 
        const locationDisplay = `${flag} ${conf.country || 'Global'}`;

        el.innerHTML = `
            <div class="w-10 h-10 bg-black flex items-center justify-center text-xl text-gray-400">${getIconHtml('station_'+conf.type)}</div>
            <div class="flex-grow">
                <h4 class="font-bold text-white font-header uppercase text-sm">${conf.name}</h4>
                <div class="flex justify-between items-center mt-1">
                    <div class="text-[10px] text-gray-500 font-mono uppercase">${locationDisplay}</div>
                    <div class="text-[10px] text-gray-500 font-mono uppercase">CENA: <span class="text-[#eab308] font-bold">${fmt(conf.price)} VC</span></div>
                </div>
            </div>
            <button class="bg-[#eab308] text-black text-xs font-bold px-3 py-2 font-header uppercase hover:bg-yellow-400" data-buy-station="${id}|${conf.price}">KUP</button>
        `;
        container.appendChild(el);
    }
    
    if (count === 0) renderEmptyState(container, "WSZYSTKIE NIERUCHOMOŚCI ZAKUPIONE");
}

// ... (renderStationDetails, renderGuildTab, renderVehicleCard, renderLootboxTab, renderRankings, renderMarket, renderCharts, renderEnergyPrices, renderTransactionHistory, renderCompanyTab, renderFriendsTab, renderAchievements - SKOPIUJ TE FUNKCJE Z POPRZEDNIEGO KROKU LUB ZOSTAWM BEZ ZMIAN, SĄ POPRAWNE) ...

export function renderStationDetails(id, container) {
    const stationConfig = config.infrastructure[id];
    const { type } = stationConfig;
    const earnings = state.infrastructure[type === 'train' ? 'trainStations' : 'busTerminals']?.[id]?.hourlyEarnings || 0;
    container.innerHTML = `<div class="grid grid-cols-2 gap-4 text-center"><div><div class="text-[9px] text-gray-500 uppercase">Status</div><div class="text-green-500 font-bold">AKTYWNA</div></div><div><div class="text-[9px] text-gray-500 uppercase">Est. Przychód</div><div class="text-[#eab308] font-bold font-mono">+${fmt(earnings)} VC/h</div></div></div>`;
}

export function renderGuildTab(container) { /* ... */ }
export function renderVehicleCard(key) { /* ... */ }
export function renderLootboxTab(container) { /* ... */ }
export function renderRankings(container) { /* ... */ }
export function renderMarket(container) { /* ... */ }
export function renderCharts(c) { /* ... */ } // Tu jest właściwie renderStats
export function renderStats(container) { /* ... */ }
export function renderEnergyPrices(container) { /* ... */ }
export function renderTransactionHistory(container) { /* ... */ }
export function renderCompanyTab(container) { /* ... */ }
export function renderFriendsTab(container) { /* ... */ }
export function renderAchievements(container) { /* ... */ }