// W pliku js/renderers.js

export function renderVehicleList(container) {
    const searchTerm = $('search').value.toLowerCase();
    
    // 1. Przygotowanie listy źródłowej
    let listSource = [];
    if (state.activeTab === 'store') { 
        let all = []; 
        Object.values(state.vehicles).forEach(m => all.push(...m.values())); 
        // W sklepie pokazujemy tylko te, których nie mamy (po kluczu type:id)
        listSource = all.filter(v => !state.owned[`${v.type}:${v.id}`]); 
    } else { 
        // We flocie pokazujemy to co mamy
        listSource = Object.values(state.owned).map(od => { 
            const ld = state.vehicles[od.type]?.get(String(od.id)); 
            const d = { ...od, ...(ld || {}) }; 
            d.status = !ld ? 'offline' : (d.isMoving ? 'in-use' : 'online'); 
            return d; 
        }); 
    }
    
    // 2. Filtrowanie
    const filtered = listSource.filter(v => {
        if (!v || !v.type) return false;
        const key = `${v.type}:${v.id}`;
        
        // Sprawdzenie czy pojazd jest zajęty (dla sklepu)
        const isMine = !!state.owned[key];
        if (state.activeTab === 'store' && state.globalTaken.has(key) && !isMine) return false;
        
        // Wyszukiwanie tekstowe
        const safeName = (v.customName || v.title || '').toLowerCase();
        const searchMatch = !searchTerm || safeName.includes(searchTerm);
        
        // --- POPRAWKA FILTROWANIA TYPÓW ---
        // Sprawdzamy czy typ pojazdu jest w tablicy state.filters.types
        // Jeśli tablica jest pusta (błąd inicjalizacji), pokazujemy wszystko
        const typeMatch = state.filters.types.length === 0 || state.filters.types.includes(v.type);

        // Filtrowanie Rzadkości
        const rarity = getVehicleRarity(v);
        const rarityMatch = state.filters.rarities.length === 0 || state.filters.rarities.includes(rarity);
        
        // Filtrowanie Kraju
        const countryMatch = state.filters.countries.length === 0 || !v.country || state.filters.countries.includes(v.country);

        return searchMatch && typeMatch && rarityMatch && countryMatch;
    });

    container.innerHTML = ''; // Czyścimy kontener przed renderowaniem

    if (filtered.length === 0) { 
        renderEmptyState(container, "BRAK POJAZDÓW SPEŁNIAJĄCYCH KRYTERIA"); 
        return; 
    }

    // Renderowanie kart (reszta funkcji bez zmian, tylko wklejam dla kompletności bloku)
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