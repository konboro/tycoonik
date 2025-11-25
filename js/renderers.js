import { state, achievementsList } from './state.js';
import { config, lootboxConfig } from './config.js';
import { $, fmt, getIconHtml, getVehicleRarity, ICONS } from './utils.js';
import { map } from './state.js';

// ===== RENDERERS DLA INDUSTRIAL THEME =====

const FLAGS = {
    'Poland': '🇵🇱', 'USA': '🇺🇸', 'UK': '🇬🇧', 'Finland': '🇫🇮', 
    'Greece': '🇬🇷', 'Europe': '🇪🇺', 'Germany': '🇩🇪', 'France': '🇫🇷'
};

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
    if (filtered.length === 0) { renderEmptyState(container, "BRAK POJAZDÓW SPEŁNIAJĄCYCH KRYTERIA"); return; }

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
        
        // --- LOGIKA LOKALIZACJI ---
        let locationDisplay = '';
        if (v.type === 'plane') {
            locationDisplay = '<i class="ri-global-line text-[#eab308]"></i> GLOBAL';
        } else {
            const flag = FLAGS[v.country] || '🏳️';
            locationDisplay = `${flag} ${v.country || 'Nieznany'}`;
        }

        el.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex gap-3 items-center">
                    <div class="w-14 h-14 bg-black border border-gray-700 flex items-center justify-center text-gray-400 text-3xl shrink-0">
                        ${getIconHtml(v.type)}
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            ${isOwned ? `<div class="w-3 h-3 rounded-full ${statusDotClass}" title="Status"></div>` : ''}
                            <div class="font-bold text-white text-base group-hover:text-[#eab308] transition-colors font-header tracking-wide uppercase truncate max-w-[150px] leading-none">${vTitle}</div>
                        </div>
                        
                        <div class="flex items-center gap-2 text-xs font-mono mt-0.5 uppercase text-gray-400">
                            <span>${locationDisplay}</span>
                            <span class="text-[#333]">|</span>
                            <span class="text-${rarity === 'legendary' ? 'yellow' : rarity === 'epic' ? 'purple' : 'blue'}-500 font-bold">${rarity}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    ${isOwned ? 
                        `<div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Całkowity Zysk</div><div class="font-mono text-2xl text-green-500 font-bold">+${fmt(ownedData.earned_vc || 0)}</div>` : 
                        `<div class="text-[10px] text-gray-500 font-bold uppercase mb-1">Cena</div><span class="font-mono text-[#eab308] font-bold text-xl">${fmt(price)} VC</span>`
                    }
                </div>
            </div>
            <div class="grid grid-cols-3 gap-px bg-[#444] border border-[#333] rounded-sm overflow-hidden mb-3 text-center">
                <div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Paliwo</div><div class="text-sm text-gray-200 font-mono font-bold">${eco.fuel}</div></div>
                <div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Emisja</div><div class="text-sm text-gray-200 font-mono font-bold">${eco.co2}</div></div>
                <div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Przebieg</div><div class="text-sm text-white font-mono font-bold">${isOwned ? fmt(ownedData.odo_km) : '0'} km</div></div>
                <div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Zysk/km</div><div class="text-sm text-green-500 font-mono font-bold">${earningsPerKm.toFixed(1)}</div></div>
                <div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Koszt/km</div><div class="text-sm text-red-400 font-mono font-bold">${costPerKm.toFixed(1)}</div></div>
                <div class="bg-[#1a1a1a] p-2"><div class="text-[10px] text-gray-500 uppercase mb-1">Netto</div><div class="text-sm text-blue-400 font-mono font-bold">${netEarnings.toFixed(1)}</div></div>
            </div>
            ${!isOwned ? `<button class="w-full bg-[#222] hover:bg-[#eab308] hover:text-black text-white text-sm font-bold py-2 uppercase transition border border-[#333]" data-buy="${key}|${price}">Zakup Jednostkę</button>` : 
            `<div class="flex justify-between items-center mt-2 px-1"><div class="text-xs font-mono text-gray-400 flex items-center gap-2"><i class="ri-tools-line"></i> Stan techniczny: <span class="${(ownedData.wear||0) > 80 ? 'text-red-500 font-bold' : 'text-white'}">${100 - Math.round(ownedData.wear || 0)}%</span></div><div class="h-1 w-24 bg-[#333] rounded-full overflow-hidden"><div class="h-full bg-${(ownedData.wear||0) > 80 ? 'red' : 'green'}-500" style="width: ${100 - (ownedData.wear||0)}%"></div></div></div>`}
        `;
        container.appendChild(el);
    });
}

export function renderInfrastructure(container) {
    for (const id in config.infrastructure) {
        const conf = config.infrastructure[id];
        let cat; switch(conf.type) { case 'train': cat='trainStations'; break; case 'tube': cat='tubeStations'; break; case 'cable': cat='cableCar'; break; case 'river-bus': cat='riverPiers'; break; case 'bus': cat='busTerminals'; break; default: continue; }
        const data = state.infrastructure[cat]?.[id];
        if (!data) continue;
        
        const el = document.createElement('div'); 
        el.className = `bg-[#1a1a1a] border-l-2 border-[#333] p-3 mb-2 flex items-center gap-3 hover:bg-[#222] transition border-b border-r border-t border-[#333]`;
        if (data.owned) el.classList.replace('border-[#333]', 'border-[#eab308]');
        el.dataset.stationId = id;
        
        // Lokalizacja stacji
        const flag = FLAGS[conf.country] || '🏳️';
        const locationDisplay = `${flag} ${conf.country || 'Global'}`;

        el.innerHTML = `
            <div class="w-10 h-10 bg-black flex items-center justify-center text-xl text-gray-400">
                ${getIconHtml('station_'+conf.type)}
            </div>
            <div class="flex-grow">
                <h4 class="font-bold text-white font-header uppercase text-sm">${conf.name}</h4>
                <div class="flex justify-between items-center mt-1">
                    <div class="text-[10px] text-gray-500 font-mono uppercase">${locationDisplay}</div>
                    <div class="text-[10px] text-gray-500 font-mono uppercase">ZYSK: <span class="text-green-500">${fmt(data.totalEarnings)} VC</span></div>
                </div>
            </div>
            ${data.owned ? 
                `<button class="text-gray-500 hover:text-white" data-info-key="station:${id}"><i class="ri-settings-3-line"></i></button>` : 
                `<button class="bg-[#eab308] text-black text-xs font-bold px-3 py-1 font-header uppercase hover:bg-yellow-400" data-buy-station="${id}|${conf.price}">KUP ${fmt(conf.price)}</button>`}
        `;
        container.appendChild(el);
        
        if (id === state.selectedStationId && data.owned) { 
            const det = document.createElement('div'); 
            det.className='p-2 bg-black border border-[#333] border-t-0 mb-2 text-xs font-mono'; 
            renderStationDetails(id, det); 
            container.appendChild(det); 
        }
    }
}

export function renderStationDetails(id, container) {
    const stationConfig = config.infrastructure[id];
    const { type } = stationConfig;
    const earnings = state.infrastructure[type === 'train' ? 'trainStations' : 'busTerminals']?.[id]?.hourlyEarnings || 0;
    container.innerHTML = `<div class="grid grid-cols-2 gap-4 text-center"><div><div class="text-[9px] text-gray-500 uppercase">Status</div><div class="text-green-500 font-bold">AKTYWNA</div></div><div><div class="text-[9px] text-gray-500 uppercase">Est. Przychód</div><div class="text-[#eab308] font-bold font-mono">+${fmt(earnings)} VC/h</div></div></div>`;
}

export function renderGuildTab(container) {
    const { playerGuildId, guilds } = state.guild;
    if (!playerGuildId) {
        container.innerHTML = `<div class="p-4 space-y-6"><div class="bg-[#1a1a1a] border border-[#333] p-4"><h3 class="text-lg font-bold text-[#eab308] font-header uppercase mb-2">Rejestracja Gildii</h3><p class="text-xs text-gray-500 mb-4">Utwórz nową organizację handlową.</p><input type="text" id="guild-name-input" placeholder="NAZWA KORPORACJI..." class="w-full bg-black border border-[#333] text-white p-2 text-sm font-mono mb-2 focus:border-[#eab308] outline-none"><button id="create-guild-btn" class="w-full btn-action py-2 text-sm">Utwórz (${fmt(config.guilds.creationCost)} VC)</button></div><div><h3 class="text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">Dostępne Gildie</h3><div id="guild-list" class="space-y-2"></div></div></div>`;
        const list = document.getElementById('guild-list');
        if(list) { for (const gid in guilds) { const g = guilds[gid]; list.innerHTML += `<div class="flex justify-between items-center bg-[#151515] p-3 border border-[#333]"><span class="text-white font-header text-sm">${g.name} <span class="text-gray-600 text-xs">(${g.members.length} os.)</span></span><button class="text-[#eab308] hover:text-white text-xs font-bold uppercase border border-[#eab308] px-2 py-1 hover:bg-[#eab308] hover:text-black transition" data-join-guild="${gid}">Dołącz</button></div>`; } }
    } else {
        const myGuild = guilds[playerGuildId]; if(!myGuild) return;
        container.innerHTML = `<div class="p-4 flex flex-col h-full"><div class="bg-[#1a1a1a] p-4 border border-[#333] border-l-4 border-l-[#eab308] mb-4"><h2 class="text-2xl font-bold text-white font-header">${myGuild.name}</h2><div class="flex justify-between items-end mt-2"><div class="text-xs text-gray-500 font-mono">CEO: ${myGuild.leader}</div><div class="text-right"><div class="text-[10px] text-gray-500 uppercase">Skarbiec</div><div class="text-xl font-mono font-bold text-[#eab308]">${fmt(myGuild.bank)} VC</div></div></div><div class="flex gap-2 mt-4 pt-4 border-t border-[#333]"><input type="number" id="treasury-amount" placeholder="KWOTA" class="w-24 bg-black text-white text-xs p-1 border border-[#333] font-mono"><button id="deposit-treasury-btn" class="bg-green-900/30 text-green-500 border border-green-900 text-xs px-3 py-1 uppercase hover:bg-green-900/50">Wpłać</button><button id="withdraw-treasury-btn" class="bg-red-900/30 text-red-500 border border-red-900 text-xs px-3 py-1 uppercase hover:bg-red-900/50">Wypłać</button></div></div><div class="flex-grow overflow-y-auto space-y-4 mb-4 custom-scrollbar"><div><h3 class="font-bold text-gray-500 text-xs uppercase mb-2">Aktywa Przemysłowe</h3><div id="guild-owned-list" class="space-y-2"></div></div></div><div class="h-40 bg-black border border-[#333] flex flex-col"><div id="guild-chat-messages" class="flex-grow overflow-y-auto p-2 text-xs font-mono space-y-1 custom-scrollbar"></div><div class="flex p-1 border-t border-[#333]"><input id="chat-message-input" class="flex-grow bg-transparent text-white px-2 text-xs font-mono outline-none" placeholder="TRANSMISJA..."><button id="send-chat-msg-btn" class="text-[#eab308] px-2"><i class="ri-send-plane-fill"></i></button></div></div></div>`;
        const ownedDiv = document.getElementById('guild-owned-list');
        if(ownedDiv) { for(const k in myGuild.ownedAssets) { const a = config.guildAssets[k]; ownedDiv.innerHTML += `<div class="bg-[#151515] border border-[#333] p-2 flex justify-between items-center"><div class="flex items-center gap-2"><i class="ri-government-line text-gray-500"></i><div><div class="font-bold text-white text-xs uppercase">${a.name}</div><div class="text-[10px] text-green-500 font-mono">+${fmt(a.incomePerTick)}/min</div></div></div></div>`; } }
    }
}

export function renderVehicleCard(key) {
    const [type, ...idParts] = key.split(':'); const id = idParts.join(':');
    const isOwned = !!state.owned[key];
    const baseData = isOwned ? state.owned[key] : state.vehicles[type]?.get(id);
    if (!baseData) { $('vehicle-card').classList.add('translate-y-[150%]'); return; }
    const v = { ...baseData, ...(state.vehicles[type]?.get(id) || {}) };
    const eco = getVehicleEcoSpecs(type);
    
    // Karta pływająca też musi mieć logikę flag
    let locationDisplay = '';
    if (type === 'plane') {
        locationDisplay = '<i class="ri-global-line text-[#eab308]"></i> GLOBAL';
    } else {
        const flag = FLAGS[v.country] || '🏳️';
        locationDisplay = `${flag} ${v.country || 'Nieznany'}`;
    }

    const container = document.getElementById('vehicle-card-content');
    container.innerHTML = `<div class="grid grid-cols-3 gap-6"><div class="col-span-1 flex flex-col gap-2"><div class="aspect-square bg-black border border-[#333] flex items-center justify-center relative group"><div class="text-6xl scale-125 transition-transform group-hover:scale-110">${getIconHtml(type)}</div><div class="absolute top-2 right-2 text-[10px] font-bold text-gray-500 border border-gray-800 bg-black px-1 uppercase">${type}</div></div><div class="text-center"><div class="text-[10px] text-gray-500 font-bold uppercase">Wartość</div><div class="text-lg font-mono font-bold text-[#eab308]">${fmt(config.basePrice[type])} VC</div></div></div><div class="col-span-2 flex flex-col justify-between"><div><h2 class="font-header text-2xl text-white leading-none mb-1 uppercase">${isOwned ? v.customName : v.title}</h2><div class="text-xs text-gray-500 font-mono mb-4 uppercase">ID: ${v.id} • ${locationDisplay}</div><div class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-mono"><div class="flex justify-between border-b border-[#333] pb-1"><span class="text-gray-500">Paliwo</span><span class="text-white">${eco.fuel}</span></div><div class="flex justify-between border-b border-[#333] pb-1"><span class="text-gray-500">Emisja</span><span class="text-white">${eco.co2}</span></div><div class="flex justify-between border-b border-[#333] pb-1"><span class="text-gray-500">Zużycie</span><span class="text-white">${isOwned ? Math.round(v.wear) + '%' : '0%'}</span></div><div class="flex justify-between border-b border-[#333] pb-1"><span class="text-gray-500">Przebieg</span><span class="text-white">${isOwned ? fmt(v.odo_km) : '0'} km</span></div></div></div><div class="flex gap-2 mt-4">${isOwned ? `<button class="flex-1 btn-action py-2" id="upgrade-btn">Ulepsz</button><button class="flex-1 btn-cancel py-2 border border-[#333]" data-svc="${key}">Serwis</button><button class="px-3 btn-cancel py-2 border border-[#333] text-red-500 hover:bg-red-900/20" id="sell-quick-btn"><i class="ri-delete-bin-line"></i></button><button class="px-3 btn-cancel py-2 border border-[#333] text-blue-500 hover:bg-blue-900/20" id="sell-market-btn"><i class="ri-auction-line"></i></button>` : `<button class="w-full btn-action py-2" data-buy="${key}|${config.basePrice[type]}">ZAKUP JEDNOSTKĘ</button>`}</div></div></div>`;
    document.getElementById('vehicle-card').classList.remove('translate-y-[150%]');
}

export function renderLootboxTab(container) {
    container.innerHTML = '<div class="p-4 grid grid-cols-2 gap-4"></div>';
    for(const k in lootboxConfig) {
        const b = lootboxConfig[k];
        const div = document.createElement('div');
        div.className = 'bg-[#151515] border border-[#333] p-4 flex flex-col items-center text-center hover:border-[#eab308] transition group';
        div.innerHTML = `<div class="text-5xl mb-2 group-hover:scale-110 transition-transform">${b.icon}</div><h3 class="text-lg font-bold text-white font-header uppercase">${b.name}</h3><div class="text-[#eab308] font-mono font-bold my-2">${fmt(b.cost)} VC</div><button class="w-full btn-action py-2 text-sm mt-auto" data-open-box="${k}">ZAMÓW</button>`;
        container.firstChild.appendChild(div);
    }
}

export function renderRankings(container) {
    renderSectionTitle(container, "LIDERZY RYNKU");
    const list = document.createElement('div');
    list.className = "space-y-1";
    const data = state.rankings.assetValue || [];
    data.slice(0, 20).forEach((p, i) => {
        const isPlayer = p.isPlayer;
        const el = document.createElement('div');
        el.className = `flex items-center justify-between p-2 border border-[#333] bg-[#151515] ${isPlayer ? 'border-[#eab308] bg-yellow-900/10' : ''}`;
        el.innerHTML = `<div class="flex gap-3"><div class="font-mono font-bold text-gray-500 w-6 text-right">#${i + 1}</div><div class="font-bold text-white uppercase text-sm">${p.name}</div></div><div class="font-mono text-[#eab308] text-sm">${fmt(p.assetValue)} VC</div>`;
        list.appendChild(el);
    });
    container.appendChild(list);
}

export function renderMarket(container) {
    if(!state.marketListings || state.marketListings.length === 0) { renderEmptyState(container, "BRAK OFERT RYNKOWYCH"); return; }
    state.marketListings.forEach((l, i) => {
        const el = document.createElement('div');
        el.className = "bg-[#1a1a1a] border border-[#333] p-3 flex items-center gap-3 mb-2";
        el.innerHTML = `<div class="w-12 h-12 bg-black border border-[#333] flex items-center justify-center text-2xl text-gray-500">${getIconHtml(l.vehicle.type)}</div><div class="flex-grow"><div class="font-header font-bold text-white uppercase text-sm">${l.vehicle.customName || l.vehicle.title}</div><div class="text-[10px] font-mono text-gray-500 uppercase">Sprzedawca: ${l.seller}</div></div><div class="text-right"><div class="text-[#eab308] font-mono font-bold text-lg">${fmt(l.price)} VC</div><button class="btn-action text-[10px] px-2 py-1 mt-1" data-buy-market="${i}">KUP TERAZ</button></div>`;
        container.appendChild(el);
    });
}

export function renderCharts(container) {
    container.innerHTML = `<div class="h-full flex flex-col p-2"><div class="bg-[#1a1a1a] border border-[#333] p-2 mb-4 flex-grow"><h4 class="text-[10px] text-gray-500 font-bold uppercase mb-2">Przychody (24h)</h4><div class="h-full w-full relative"><canvas id="earningsChart"></canvas></div></div></div>`;
    setTimeout(() => {
        const ctx = $('earningsChart').getContext('2d');
        new Chart(ctx, { type: 'line', data: { labels: Array(60).fill(''), datasets: [{ label: 'VC', data: state.profile.earnings_history, borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderWidth: 1, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#333' } }, y: { grid: { color: '#333' } } } } }); 
    }, 100);
}

export function renderEnergyPrices(container) {
    container.innerHTML = `<div class="p-4"><table class="w-full text-sm text-left text-gray-400 font-mono"><thead class="text-[10px] text-gray-500 uppercase bg-[#111] border-b border-[#333]"><tr><th class="px-4 py-2">Region</th><th class="px-4 py-2">Paliwo</th><th class="px-4 py-2 text-right">Cena</th></tr></thead><tbody id="energy-prices-body"></tbody></table></div>`;
    const tbody = document.getElementById('energy-prices-body');
    if (tbody) { for (const c in state.economy.energyPrices) { for (const t in state.economy.energyPrices[c]) { const row = tbody.insertRow(); row.className="border-b border-[#222] hover:bg-[#1a1a1a]"; row.innerHTML=`<td class="px-4 py-2 font-bold text-white">${c}</td><td class="px-4 py-2">${t}</td><td class="px-4 py-2 text-right text-[#eab308]">${state.economy.energyPrices[c][t].toFixed(2)}</td>`; } } }
}

export function renderTransactionHistory(container) {
    const history = state.profile.transaction_history || [];
    if (history.length === 0) return renderEmptyState(container, "BRAK TRANSAKCJI");
    history.forEach(t => {
        const el = document.createElement('div');
        el.className = "p-3 border-b border-[#333] flex justify-between items-center hover:bg-[#151515]";
        el.innerHTML = `<div><div class="font-bold text-gray-300 text-xs uppercase">${t.description}</div><div class="text-[10px] text-gray-600 font-mono">${new Date(t.timestamp).toLocaleTimeString()}</div></div><div class="font-mono font-bold ${t.amount >= 0 ? 'text-green-500' : 'text-red-500'}">${t.amount > 0 ? '+' : ''}${fmt(t.amount)} VC</div>`;
        container.appendChild(el);
    });
}

export function renderCompanyTab(container) {
    const logos = ['🏢', '🏭', '🚀', '🌐', '⚡️', '🚂', '✈️', '🚌', '🚢', '⭐'];
    container.innerHTML = `<div class="p-4 space-y-6"><div class="bg-[#1a1a1a] border border-[#333] p-4"><h3 class="text-xs font-bold text-gray-500 uppercase mb-2">Nazwa Korporacji</h3><div class="flex gap-2"><input type="text" id="company-name-input" value="${state.profile.companyName}" class="flex-grow bg-black border border-[#333] text-white p-2 font-mono text-sm focus:border-[#eab308] outline-none"><button id="save-company-btn" class="btn-action px-4 text-sm">ZAPISZ</button></div></div><div class="bg-[#1a1a1a] border border-[#333] p-4"><h3 class="text-xs font-bold text-gray-500 uppercase mb-2">Logotyp</h3><div class="grid grid-cols-5 gap-2">${logos.map(l => `<button class="aspect-square bg-black border border-[#333] hover:border-[#eab308] flex items-center justify-center text-2xl transition" data-logo="${l}">${l}</button>`).join('')}</div></div></div>`;
}

export function renderFriendsTab(container) {
    const { friends, requests, searchResults } = state.social || { friends: [], requests: [], searchResults: [] };
    container.innerHTML = `<div class="p-4 space-y-6"><div><h3 class="text-xs font-bold text-gray-500 uppercase mb-2">Szukaj Partnera</h3><div class="flex gap-2"><input type="text" id="friend-search-input" class="flex-grow bg-black border border-[#333] text-white p-2 text-sm font-mono focus:border-[#eab308] outline-none" placeholder="NAZWA / EMAIL..."><button id="search-friends-btn" class="bg-[#222] hover:bg-[#eab308] hover:text-black text-white px-3 border border-[#333] transition"><i class="ri-search-line"></i></button></div><div id="search-results" class="mt-2 space-y-1">${(searchResults||[]).map(r => `<div class="bg-[#151515] p-2 border border-[#333] flex justify-between items-center"><span class="text-white text-xs font-bold">${r.company_name}</span><button class="text-green-500 hover:text-white text-[10px] border border-green-900 bg-green-900/20 px-2 py-1 uppercase" data-add-friend="${r.id}">Dodaj</button></div>`).join('')}</div></div><div class="border-t border-[#333] pt-4"><h3 class="text-xs font-bold text-gray-500 uppercase mb-2">Kontrahenci (${(friends||[]).length})</h3><div class="space-y-2">${(friends||[]).map(f => `<div class="bg-[#1a1a1a] p-3 border border-[#333] flex justify-between items-center group hover:border-[#eab308] cursor-pointer transition" data-open-chat="${f.id}"><div><div class="font-bold text-white text-sm uppercase">${f.name}</div><div class="text-[10px] text-gray-500 font-mono">LVL ${f.level}</div></div><i class="ri-message-3-line text-gray-600 group-hover:text-[#eab308]"></i></div>`).join('')}</div></div></div>`;
}

export function renderAchievements(container) {
    const list = document.createElement('div');
    list.className = "space-y-2 p-3";
    for(const k in achievementsList) {
        const a = achievementsList[k];
        const u = state.achievements[k];
        const isUnlocked = u?.unlocked;
        const isClaimed = u?.claimed;
        const el = document.createElement('div');
        el.className = `p-3 border border-[#333] bg-[#151515] flex items-center gap-3 ${isUnlocked ? 'border-l-4 border-l-[#eab308]' : 'opacity-50'}`;
        const actionBtn = (isUnlocked && !isClaimed) ? `<button class="btn-action text-[10px] px-2 py-1" data-claim="${k}">ODBIERZ</button>` : (isClaimed ? '<span class="text-green-500 text-xs font-bold"><i class="ri-check-line"></i></span>' : '<i class="ri-lock-line text-gray-600"></i>');
        el.innerHTML = `<div class="text-2xl">${a.icon || '🏆'}</div><div class="flex-grow"><div class="font-bold text-white text-xs uppercase">${a.title}</div><div class="text-[10px] text-gray-500">${a.description}</div></div><div>${actionBtn}</div>`;
        list.appendChild(el);
    }
    container.appendChild(list);
}