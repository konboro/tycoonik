// js/ui-core.js
import { state } from './state.js';
import { config } from './config.js';
import { map } from './state.js';
import { $, fmt, getProximityBonus, createIcon, getIconHtml, ICONS, getWeatherIcon } from './utils.js';
import { calculateAssetValue } from './logic.js'; 
import { 
    renderVehicleList, renderInfrastructure, renderLootboxTab, renderMarket, 
    renderRankings, renderCharts, renderAchievements, renderEnergyPrices, 
    renderTransactionHistory, renderGuildTab, renderCompanyTab, renderFriendsTab, 
    renderStationDetails, renderVehicleCard, renderEmptyState, renderSectionTitle
} from './renderers.js';

// ... (Funkcje pomocnicze bez zmian logicznych, tylko klasy CSS w razie potrzeby) ...

// UPDATE HUD FILTERS
export function initMapFilters() {
    const typesContainer = $('map-filters-types');
    const ownershipContainer = $('map-filters-ownership');
    
    if (!typesContainer || !ownershipContainer) return;

    const types = ['plane', 'train', 'bus', 'tube', 'tram', 'river-bus', 'scooter', 'bike'];
    
    typesContainer.innerHTML = '';
    types.forEach(type => {
        const btn = document.createElement('button');
        // New Industrial Button Style
        btn.className = `w-10 h-10 bg-[#121212] border border-[#333] flex items-center justify-center text-xl shadow-lg transition-all hover:bg-[#222] map-type-filter`;
        btn.dataset.type = type;
        btn.title = `Pokaż/Ukryj: ${type}`;
        btn.innerHTML = getIconHtml(type, "w-6 h-6");
        
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

function updateMapFilterButtons() {
    document.querySelectorAll('.map-type-filter').forEach(btn => {
        const type = btn.dataset.type;
        if (state.filters.types.includes(type)) {
            btn.classList.add('filter-btn-active'); // Definiowane w CSS (yellow border/text)
            btn.classList.remove('opacity-50');
        } else {
            btn.classList.remove('filter-btn-active');
            btn.classList.add('opacity-50');
        }
    });
    document.querySelectorAll('[data-map-view]').forEach(btn => {
        if (btn.dataset.mapView === state.filters.mapView) {
            btn.classList.add('text-white', 'border-b-2', 'border-[#eab308]');
            btn.classList.remove('text-gray-400', 'border-transparent');
        } else {
            btn.classList.remove('text-white', 'border-b-2', 'border-[#eab308]');
            btn.classList.add('text-gray-400', 'border-transparent');
        }
    });
}

// ... (Reszta funkcji redrawMap i updateUI bez większych zmian logicznych, ale upewnij się że selektory ID pasują do nowego HTML) ...

export function updateUI(inM, outM) {
    // ... (Logika licznika Odometer musi pasować do nowego HTML structure) ...
    // Licznik w nowym HTML ma ID "hourly-earnings-odometer" i klasę "odometer-box"
    
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('wallet', fmt(state.wallet));
    set('company-name', state.profile.companyName || 'ŁADOWANIE...');
    // ... reszta statystyk ...
}

// Zapewnij poprawne działanie sidebara (slide-in)
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

export function render() {
    // Router renderowania...
    // Ważne: upewnij się, że renderowane przyciski filtrów w panelu bocznym 
    // używają nowych klas CSS (np. bg-[#1a1a1a] zamiast bg-gray-800)
    
    const listContainer = $('mainList');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    const titleEl = $('panel-title'); 
    if(titleEl) titleEl.textContent = (panelTitles[state.activeTab] || state.activeTab).toUpperCase();
    
    const controls = $('panel-controls');
    const showControls = ['store', 'fleet', 'stations', 'market'].includes(state.activeTab);
    if(controls) controls.style.display = showControls ? 'block' : 'none';
    
    // ... (Renderowanie filtrów w panelu) ...
    
    switch (state.activeTab) { 
        // ... switche ...
        case 'fleet': renderVehicleList(listContainer); break;
        // ...
    }
}