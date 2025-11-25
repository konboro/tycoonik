import { state, achievementsList } from './state.js';
import { config, lootboxConfig } from './config.js';
import { $, fmt, getIconHtml, getVehicleRarity, ICONS } from './utils.js';
import { map } from './state.js';

// ... (Pozostałe funkcje renderers.js: renderEmptyState, renderSectionTitle, renderVehicleList, renderInfrastructure, renderStationDetails, renderGuildTab, renderVehicleCard, renderLootboxTab, renderRankings, renderMarket, renderCharts - SKOPIUJ JE Z POPRZEDNIEJ WERSJI LUB ZOSTAWM BEZ ZMIAN) ...

// TYLKO ZMIENIONA FUNKCJA PONIŻEJ:

export function renderEnergyPrices(container) {
    container.innerHTML = `
        <div class="p-4 space-y-4">
            <div class="bg-[#1a1a1a] border border-[#333] p-4 mb-4">
                <h3 class="text-lg font-header text-white uppercase mb-1">Globalny Rynek Energii</h3>
                <p class="text-xs text-gray-500 font-mono">Ceny aktualizowane co godzinę na podstawie indeksów światowych.</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
    `;
    
    const fuels = state.economy.globalFuels;
    const icons = {
        'Diesel': 'ri-drop-fill',
        'Benzyna': 'ri-gas-station-fill',
        'Aviation': 'ri-plane-fill',
        'Electricity': 'ri-flashlight-fill'
    };
    const colors = {
        'Diesel': 'text-orange-500',
        'Benzyna': 'text-green-500',
        'Aviation': 'text-purple-500',
        'Electricity': 'text-blue-500'
    };

    for (const type in fuels) {
        const data = fuels[type];
        const trendIcon = data.trend === 'up' ? 'ri-arrow-up-line text-red-500' : (data.trend === 'down' ? 'ri-arrow-down-line text-green-500' : 'ri-subtract-line text-gray-500');
        const unit = type === 'Electricity' ? 'VC / kWh' : 'VC / L';
        
        container.innerHTML += `
            <div class="bg-[#151515] border border-[#333] p-4 flex flex-col justify-between hover:border-[#eab308] transition group">
                <div class="flex justify-between items-start mb-2">
                    <div class="w-10 h-10 bg-black border border-[#333] flex items-center justify-center rounded text-xl ${colors[type]}">
                        <i class="${icons[type] || 'ri-drop-line'}"></i>
                    </div>
                    <div class="text-2xl ${trendIcon}"></div>
                </div>
                <div>
                    <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">${type}</div>
                    <div class="text-2xl font-mono font-bold text-white mt-1">${data.price.toFixed(2)} <span class="text-xs text-gray-600">${unit}</span></div>
                </div>
                <div class="mt-3 pt-2 border-t border-[#222] text-[10px] text-gray-500 font-mono flex justify-between">
                    <span>TREND</span>
                    <span class="uppercase">${data.trend}</span>
                </div>
            </div>
        `;
    }
    
    container.innerHTML += `</div></div>`;
}

// ... (Reszta renderers.js - renderTransactionHistory, renderCompanyTab, renderFriendsTab, renderAchievements) ...
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

// Mapowanie aliasów dla kompatybilności ze starym kodem
export function renderCharts(c) { 
    // Kod z poprzedniego kroku
    c.innerHTML = `<div class="h-full flex flex-col p-2"><div class="bg-[#1a1a1a] border border-[#333] p-2 mb-4 flex-grow"><h4 class="text-[10px] text-gray-500 font-bold uppercase mb-2">Przychody (24h)</h4><div class="h-full w-full relative"><canvas id="earningsChart"></canvas></div></div></div>`;
    setTimeout(() => {
        const ctx = $('earningsChart').getContext('2d');
        new Chart(ctx, { type: 'line', data: { labels: Array(60).fill(''), datasets: [{ label: 'VC', data: state.profile.earnings_history, borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderWidth: 1, tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#333' } }, y: { grid: { color: '#333' } } } } }); 
    }, 100);
}