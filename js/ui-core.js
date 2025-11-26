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
    renderRealEstateMarket, renderProfileTab // <--- NOWY IMPORT
} from './renderers.js';

// ... (Funkcje pomocnicze bez zmian) ...
// ... (initMapFilters, updateMapFilterButtons, redrawMap, updateUI, forceUpdateWallet bez zmian) ...

// ===== 4. GŁÓWNY RENDERER =====

const panelTitles = { 
    stations: "Infrastruktura", 
    real_estate: "Rynek Nieruchomości", 
    store: "Sklep", 
    fleet: "Moja Flota", 
    market: "Giełda", 
    lootbox: "Skrzynki", 
    achievements: "Osiągnięcia", 
    stats: "Statystyki", 
    friends: "Znajomi", 
    rankings: "Ranking", 
    energy: "Ceny Energii", 
    guild: "Gildia", 
    transactions: "Historia Transakcji", 
    company: "Personalizacja Firmy",
    profile: "Profil Operatora" // <--- NOWY TYTUŁ
};

export function render() {
    const listContainer = $('mainList');
    if(!listContainer) return;
    
    listContainer.innerHTML = '';
    const titleEl = $('panel-title'); if(titleEl) titleEl.textContent = panelTitles[state.activeTab] || state.activeTab;
    
    const controls = $('panel-controls');
    const filtersContainer = $('filters-container');
    const showControls = ['store', 'fleet', 'stations', 'market', 'real_estate'].includes(state.activeTab);
    if(controls) controls.style.display = showControls ? 'block' : 'none';

    // ... (Logika filtrów bez zmian) ...
    // ... (Sekcja filtrów kafelkowych wklejona z poprzednich wersji) ...
    if (showControls && filtersContainer) {
        filtersContainer.innerHTML = '';
        let filterHtml = '<div class="space-y-4">';

        if (state.activeTab !== 'stations' && state.activeTab !== 'real_estate') { 
            // ... (Filtry pojazdów) ...
             filterHtml += '<div><h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Typ Pojazdu</h4><div class="grid grid-cols-4 gap-2">';
            const types = ['plane', 'train', 'bus', 'tube', 'tram', 'river-bus', 'scooter', 'bike'];
            types.forEach(t => {
                const active = state.filters.types.includes(t);
                const activeClass = active ? 'filter-btn-active' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white';
                filterHtml += `<button class="panel-filter-btn h-10 w-full ${activeClass}" data-filter-category="types" data-filter-value="${t}" title="${t}">${getIconHtml(t, "w-6 h-6")}</button>`;
            });
            filterHtml += '</div></div>';

            // 2. RZADKOŚĆ
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
                const activeClass = active ? 'filter-btn-active border-transparent' : `bg-transparent ${r.color} hover:bg-gray-800`;
                filterHtml += `<button class="${baseClass} ${activeClass}" data-filter-category="rarities" data-filter-value="${r.id}">${r.label}</button>`;
            });
            filterHtml += '</div></div>';

            // 3. KRAJ
            filterHtml += '<div><h4 class="text-xs font-bold text-gray-400 uppercase mb-2">Region</h4><div class="flex flex-wrap gap-2">';
            const countries = ['Poland', 'USA', 'Finland', 'UK', 'Greece', 'Europe'];
            countries.forEach(c => {
                const active = state.filters.countries.includes(c);
                const activeClass = active ? 'filter-btn-active' : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white';
                filterHtml += `<button class="px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeClass}" data-filter-category="countries" data-filter-value="${c}">${c}</button>`;
            });
            filterHtml += '</div></div>';
        } else {
             filterHtml += '<div class="text-sm text-gray-400 text-center italic">Filtrowanie stacji wkrótce...</div>';
        }

        filterHtml += '</div>';
        filtersContainer.innerHTML = filterHtml;
    }
    
    switch (state.activeTab) { 
        case 'profile': renderProfileTab(listContainer); break; // <--- DODANO OBSŁUGĘ PROFILU
        case 'stats': renderStats(listContainer); break; 
        case 'achievements': renderAchievements(listContainer); break; 
        case 'lootbox': renderLootboxTab(listContainer); break; 
        case 'stations': renderInfrastructure(listContainer); break; 
        case 'real_estate': renderRealEstateMarket(listContainer); break;
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
        else { vehicleCard.classList.add('translate-y-[150%]'); }
    }
    
    // Aktualizacja filtrów HUD
    updateMapFilterButtons();
    redrawMap();
}