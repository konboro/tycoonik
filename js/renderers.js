import { state, achievementsList } from './state.js';
import { config, lootboxConfig } from './config.js';
import { $, fmt, getIconHtml, getVehicleRarity, ICONS } from './utils.js';
import { map } from './state.js';

// ===== RENDERERS DLA INDUSTRIAL THEME =====

export function renderEmptyState(container, message) { 
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-600 p-8 text-center"><i class="ri-ghost-line text-4xl mb-2"></i><span class="font-mono text-xs uppercase tracking-widest">${message}</span></div>`; 
}

export function renderSectionTitle(container, title) { 
    const el = document.createElement('div'); 
    el.className = 'px-2 py-1 mb-2 text-[10px] font-bold text-[#eab308] uppercase tracking-widest border-b border-[#333]'; 
    el.textContent = title; 
    container.appendChild(el); 
}

// Helper do Paliwa i CO2
function getVehicleEcoSpecs(type) {
    let fuel = 'PRĄD';
    let co2 = '0 g/km';
    
    if (['plane'].includes(type)) {
        fuel = 'JET-A1';
        co2 = '285 g/km';
    } else if (['bus', 'river-bus'].includes(type)) {
        fuel = 'DIESEL';
        co2 = type === 'bus' ? '85 g/km' : '110 g/km';
    } else if (['bike'].includes(type)) {
        fuel = 'MIĘŚNIE';
        co2 = '0 g/km';
    }
    
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
        const rarity = getVehicleRarity(v);
        const rarityMatch = state.filters.rarities.length === 0 || state.filters.rarities.includes(rarity);
        return searchMatch && rarityMatch;
    });

    if (filtered.length === 0) { renderEmptyState(container, "BRAK DANYCH"); return; }

    filtered.forEach(v => {
        const key = `${v.type}:${v.id}`;
        const isOwned = !!state.owned[key];
        const ownedData = state.owned[key];
        const price = config.basePrice[v.type] || 1000;
        const rarity = getVehicleRarity(v);
        const eco = getVehicleEcoSpecs(v.type);
        
        // Obliczenia ekonomiczne
        const earningsPerKm = config.baseRate[v.type] || 0;
        const isElectric = config.energyConsumption[v.type] > 0;
        const consumption = isElectric ? config.energyConsumption[v.type] : config.fuelConsumption[v.type];
        const pricePerUnit = state.economy.energyPrices[v.country || 'Europe']?.[isElectric ? 'Electricity' : 'Diesel'] || (isElectric ? 0.22 : 1.85);
        const costPerKm = (consumption / 100) * pricePerUnit;
        const netEarnings = earningsPerKm - costPerKm;

        const el = document.createElement('div');
        el.className = `group bg-[#1a1a1a] border border-[#333] p-3 hover:border-[#eab308] transition-colors cursor-pointer relative overflow-hidden mb-3`;
        el.dataset.key = key;
        
        // KROPKI STATUSU
        let statusDotClass = 'bg-gray-600 shadow-[0_0_5px_rgba(75,85,99,0.5)]'; // Offline (Szara)
        if (v.status === 'in-use') statusDotClass = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse'; // W ruchu (Zielona)
        else if (v.status === 'online') statusDotClass = 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]'; // Gotowy (Niebieska)

        const vTitle = isOwned ? (ownedData.customName || v.title) : v.title;
        
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
                        <div class="text-xs text-gray-500 font-mono uppercase">${v.type} • ${v.country || 'GLOBAL'} • <span class="text-${rarity === 'legendary' ? 'yellow' : rarity === 'epic' ? 'purple' : 'blue'}-500">${rarity}</span></div>
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
                <div class="bg-[#1a1a1a] p-2">
                    <div class="text-[10px] text-gray-500 uppercase mb-1">Paliwo</div>
                    <div class="text-sm text-gray-200 font-mono font-bold">${eco.fuel}</div>
                </div>
                <div class="bg-[#1a1a1a] p-2">
                    <div class="text-[10px] text-gray-500 uppercase mb-1">Emisja</div>
                    <div class="text-sm text-gray-200 font-mono font-bold">${eco.co2}</div>
                </div>
                
                <div class="bg-[#1a1a1a] p-2">
                    <div class="text-[10px] text-gray-500 uppercase mb-1">Przebieg</div>
                    <div class="text-sm text-white font-mono font-bold">${isOwned ? fmt(ownedData.odo_km) : '0'} km</div>
                </div>

                <div class="bg-[#1a1a1a] p-2">
                    <div class="text-[10px] text-gray-500 uppercase mb-1">Zysk/km</div>
                    <div class="text-sm text-green-500 font-mono font-bold">${earningsPerKm.toFixed(1)}</div>
                </div>
                <div class="bg-[#1a1a1a] p-2">
                    <div class="text-[10px] text-gray-500 uppercase mb-1">Koszt/km</div>
                    <div class="text-sm text-red-400 font-mono font-bold">${costPerKm.toFixed(1)}</div>
                </div>
                <div class="bg-[#1a1a1a] p-2">
                    <div class="text-[10px] text-gray-500 uppercase mb-1">Netto</div>
                    <div class="text-sm text-blue-400 font-mono font-bold">${netEarnings.toFixed(1)}</div>
                </div>
            </div>

            ${!isOwned ? `
                <button class="w-full bg-[#222] hover:bg-[#eab308] hover:text-black text-white text-sm font-bold py-2 uppercase transition border border-[#333]" data-buy="${key}|${price}">Zakup Jednostkę</button>
            ` : `
                <div class="flex justify-between items-center mt-2 px-1">
                    <div class="text-xs font-mono text-gray-400 flex items-center gap-2">
                        <i class="ri-tools-line"></i> Stan techniczny: <span class="${(ownedData.wear||0) > 80 ? 'text-red-500 font-bold' : 'text-white'}">${100 - Math.round(ownedData.wear || 0)}%</span>
                    </div>
                    <div class="h-1 w-24 bg-[#333] rounded-full overflow-hidden">
                         <div class="h-full bg-${(ownedData.wear||0) > 80 ? 'red' : 'green'}-500" style="width: ${100 - (ownedData.wear||0)}%"></div>
                    </div>
                </div>
            `}
        `;
        container.appendChild(el);
    });
}

// ... (renderInfrastructure, renderStationDetails, renderGuildTab BEZ ZMIAN) ...
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
        
        el.innerHTML = `
            <div class="w-10 h-10 bg-black flex items-center justify-center text-xl text-gray-400">
                ${getIconHtml('station_'+conf.type)}
            </div>
            <div class="flex-grow">
                <h4 class="font-bold text-white font-header uppercase text-sm">${conf.name}</h4>
                <div class="text-[10px] text-gray-500 font-mono uppercase">ZYSK TOTAL: <span class="text-green-500">${fmt(data.totalEarnings)} VC</span></div>
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
    
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4 text-center">
            <div>
                <div class="text-[9px] text-gray-500 uppercase">Status</div>
                <div class="text-green-500 font-bold">AKTYWNA</div>
            </div>
            <div>
                <div class="text-[9px] text-gray-500 uppercase">Est. Przychód</div>
                <div class="text-[#eab308] font-bold font-mono">+${fmt(earnings)} VC/h</div>
            </div>
        </div>
    `;
}

export function renderGuildTab(container) {
    const { playerGuildId, guilds } = state.guild;
    
    if (!playerGuildId) {
        container.innerHTML = `
            <div class="p-4 space-y-6">
                <div class="bg-[#1a1a1a] border border-[#333] p-4">
                    <h3 class="text-lg font-bold text-[#eab308] font-header uppercase mb-2">Rejestracja Gildii</h3>
                    <p class="text-xs text-gray-500 mb-4">Utwórz nową organizację handlową.</p>
                    <input type="text" id="guild-name-input" placeholder="NAZWA KORPORACJI..." class="w-full bg-black border border-[#333] text-white p-2 text-sm font-mono mb-2 focus:border-[#eab308] outline-none">
                    <button id="create-guild-btn" class="w-full btn-action py-2 text-sm">Utwórz (${fmt(config.guilds.creationCost)} VC)</button>
                </div>
                
                <div>
                    <h3 class="text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">Dostępne Gildie</h3>
                    <div id="guild-list" class="space-y-2"></div>
                </div>
            </div>`;
            
        const list = document.getElementById('guild-list');
        for (const gid in guilds) { 
            const g = guilds[gid]; 
            list.innerHTML += `
                <div class="flex justify-between items-center bg-[#151515] p-3 border border-[#333]">
                    <span class="text-white font-header text-sm">${g.name} <span class="text-gray-600 text-xs">(${g.members.length} os.)</span></span>
                    <button class="text-[#eab308] hover:text-white text-xs font-bold uppercase border border-[#eab308] px-2 py-1 hover:bg-[#eab308] hover:text-black transition" data-join-guild="${gid}">Dołącz</button>
                </div>`; 
        }
    } else {
        const myGuild = guilds[playerGuildId]; 
        if(!myGuild) return;
        container.innerHTML = `
            <div class="p-4 flex flex-col h-full">
                <div class="bg-[#1a1a1a] p-4 border border-[#333] border-l-4 border-l-[#eab308] mb-4">
                    <h2 class="text-2xl font-bold text-white font-header">${myGuild.name}</h2>
                    <div class="flex justify-between items-end mt-2">
                        <div class="text-xs text-gray-500 font-mono">CEO: ${myGuild.leader}</div>
                        <div class="text-right">
                            <div class="text-[10px] text-gray-500 uppercase">Skarbiec</div>
                            <div class="text-xl font-mono font-bold text-[#eab308]">${fmt(myGuild.bank)} VC</div>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-4 pt-4 border-t border-[#333]">
                        <input type="number" id="treasury-amount" placeholder="KWOTA" class="w-24 bg-black text-white text-xs p-1 border border-[#333] font-mono">
                        <button id="deposit-treasury-btn" class="bg-green-900/30 text-green-500 border border-green-900 text-xs px-3 py-1 uppercase hover:bg-green-900/50">Wpłać</button>
                        <button id="withdraw-treasury-btn" class="bg-red-900/30 text-red-500 border border-red-900 text-xs px-3 py-1 uppercase hover:bg-red-900/50">Wypłać</button>
                    </div>
                </div>
                
                <div class="flex-grow overflow-y-auto space-y-4 mb-4 custom-scrollbar">
                    <div>
                        <h3 class="font-bold text-gray-500 text-xs uppercase mb-2">Aktywa Przemysłowe</h3>
                        <div id="guild-owned-list" class="space-y-2"></div>
                    </div>
                </div>
                
                <div class="h-40 bg-black border border-[#333] flex flex-col">
                    <div id="guild-chat-messages" class="flex-grow overflow-y-auto p-2 text-xs font-mono space-y-1 custom-scrollbar"></div>
                    <div class="flex p-1 border-t border-[#333]">
                        <input id="chat-message-input" class="flex-grow bg-transparent text-white px-2 text-xs font-mono outline-none" placeholder="TRANSMISJA...">
                        <button id="send-chat-msg-btn" class="text-[#eab308] px-2"><i class="ri-send-plane-fill"></i></button>
                    </div>
                </div>
            </div>`;
            
        const ownedDiv = document.getElementById('guild-owned-list');
        for(const k in myGuild.ownedAssets) { 
            const a = config.guildAssets[k]; 
            ownedDiv.innerHTML += `
                <div class="bg-[#151515] border border-[#333] p-2 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <i class="ri-government-line text-gray-500"></i>
                        <div>
                            <div class="font-bold text-white text-xs uppercase">${a.name}</div>
                            <div class="text-[10px] text-green-500 font-mono">+${fmt(a.incomePerTick)}/min</div>
                        </div>
                    </div>
                </div>`; 
        }
    }
}

export function renderVehicleCard(key) {
    const [type, ...idParts] = key.split(':'); const id = idParts.join(':');
    const isOwned = !!state.owned[key];
    const baseData = isOwned ? state.owned[key] : state.vehicles[type]?.get(id);
    if (!baseData) { $('vehicle-card').classList.add('translate-y-[150%]'); return; }
    
    const v = { ...baseData, ...(state.vehicles[type]?.get(id) || {}) };
    const eco = getVehicleEcoSpecs(type);
    
    const container = document.getElementById('vehicle-card-content');
    
    container.innerHTML = `
        <div class="grid grid-cols-3 gap-6">
            <div class="col-span-1 flex flex-col gap-2">
                <div class="aspect-square bg-black border border-[#333] flex items-center justify-center relative group">
                    <div class="text-6xl scale-125 transition-transform group-hover:scale-110">${getIconHtml(type)}</div>
                    <div class="absolute top-2 right-2 text-[10px] font-bold text-gray-500 border border-gray-800 bg-black px-1 uppercase">${type}</div>
                </div>
                <div class="text-center">
                    <div class="text-[10px] text-gray-500 font-bold uppercase">Wartość</div>
                    <div class="text-lg font-mono font-bold text-[#eab308]">${fmt(config.basePrice[type])} VC</div>
                </div>
            </div>

            <div class="col-span-2 flex flex-col justify-between">
                <div>
                    <h2 class="font-header text-2xl text-white leading-none mb-1 uppercase">${isOwned ? v.customName : v.title}</h2>
                    <div class="text-xs text-gray-500 font-mono mb-4 uppercase">ID: ${v.id} • ${v.country || 'N/A'}</div>
                    
                    <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-mono">
                        <div class="flex justify-between border-b border-[#333] pb-1">
                            <span class="text-gray-500">Paliwo</span>
                            <span class="text-white">${eco.fuel}</span>
                        </div>
                        <div class="flex justify-between border-b border-[#333] pb-1">
                            <span class="text-gray-500">Emisja</span>
                            <span class="text-white">${eco.co2}</span>
                        </div>
                        <div class="flex justify-between border-b border-[#333] pb-1">
                            <span class="text-gray-500">Zużycie</span>
                            <span class="text-white">${isOwned ? Math.round(v.wear) + '%' : '0%'}</span>
                        </div>
                        <div class="flex justify-between border-b border-[#333] pb-1">
                            <span class="text-gray-500">Przebieg</span>
                            <span class="text-white">${isOwned ? fmt(v.odo_km) : '0'} km</span>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2 mt-4">
                    ${isOwned ? `
                        <button class="flex-1 btn-action py-2" id="upgrade-btn">Ulepsz</button>
                        <button class="flex-1 btn-cancel py-2 border border-[#333]" data-svc="${key}">Serwis</button>
                        <button class="px-3 btn-cancel py-2 border border-[#333] text-red-500 hover:bg-red-900/20" id="sell-quick-btn"><i class="ri-delete-bin-line"></i></button>
                        <button class="px-3 btn-cancel py-2 border border-[#333] text-blue-500 hover:bg-blue-900/20" id="sell-market-btn"><i class="ri-auction-line"></i></button>
                    ` : `
                        <button class="w-full btn-action py-2" data-buy="${key}|${config.basePrice[type]}">ZAKUP JEDNOSTKĘ</button>
                    `}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('vehicle-card').classList.remove('translate-y-[150%]');
}

export function renderLootboxTab(container) {
    container.innerHTML = '<div class="p-4 grid grid-cols-2 gap-4"></div>';
    for(const k in lootboxConfig) {
        const b = lootboxConfig[k];
        const div = document.createElement('div');
        div.className = 'bg-[#151515] border border-[#333] p-4 flex flex-col items-center text-center hover:border-[#eab308] transition group';
        div.innerHTML = `
            <div class="text-5xl mb-2 group-hover:scale-110 transition-transform">${b.icon}</div>
            <h3 class="text-lg font-bold text-white font-header uppercase">${b.name}</h3>
            <div class="text-[#eab308] font-mono font-bold my-2">${fmt(b.cost)} VC</div>
            <button class="w-full btn-action py-2 text-sm mt-auto" data-open-box="${k}">ZAMÓW</button>
        `;
        container.firstChild.appendChild(div);
    }
}

export function renderCompanyTab(container) { /* Placeholder */ }
export function renderFriendsTab(container) { /* Placeholder */ }
export function renderTransactionHistory(container) { /* Placeholder */ }
export function renderMarket(container) { /* Placeholder */ }
export function renderRankings(container) { /* Placeholder */ }
export function renderCharts(container) { /* Placeholder */ }
export function renderEnergyPrices(container) { /* Placeholder */ }
export function renderAchievements(container) { /* Placeholder */ }