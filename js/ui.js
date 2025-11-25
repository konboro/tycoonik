import { state, achievementsList, logTransaction } from './state.js';
import { config, lootboxConfig } from './config.js';
import { supabase } from './supabase.js';
import { $, fmt, showNotification, showConfirm, getVehicleRarity, getIconHtml } from './utils.js';
import { map } from './state.js';
import { render, updateUI, toggleContentPanel, redrawMap } from './ui-core.js'; 
import { createLootboxManager } from './lootbox-manager.js';

const lootboxManager = createLootboxManager(state);

export function setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.navTab;
            if(tab === 'profile') return;
            state.activeTab = tab;
            render();
            toggleContentPanel(true);
        });
    });

    $('close-content-panel').addEventListener('click', () => toggleContentPanel(false));
    $('edit-company-name-btn').addEventListener('click', () => { 
        state.activeTab = 'company'; render(); toggleContentPanel(true); 
    });
    $('resetAll').addEventListener('click', () => { 
        showConfirm('Na pewno zresetować grę?', () => { 
            localStorage.removeItem('gameState_v9.1'); location.reload(); 
        }); 
    });

    const controls = $('panel-controls');
    if(controls) {
        controls.addEventListener('click', e => { 
            if (e.target.id === 'refreshAll') { 
                // Trigger manual refresh
                import('./api-server.js').then(m => {
                    m.forceRefreshVehicles().then(() => {
                        m.fetchAllVehicles().then(() => render());
                    });
                });
            } 
        });
        controls.addEventListener('input', e => { if (e.target.id === 'search') render(); });
    }
    
    // Main List Click Handler (Delegation)
    $('mainList').addEventListener('click', e => {
        // 1. Kupno Pojazdu
        const buyTarget = e.target.closest('[data-buy]');
        if (buyTarget) { 
            e.stopPropagation(); 
            (async () => {
                const [key, priceStr] = buyTarget.dataset.buy.split('|'); 
                const [type, ...idParts] = key.split(':'); 
                const id = idParts.join(':'); 
                const price = parseInt(priceStr); 
                const vehicleData = state.vehicles[type]?.get(id); 
                if (!vehicleData) { showNotification('Błąd danych pojazdu.', true); return; }
                const { data, error } = await supabase.rpc('buy_vehicle_secure', { p_vehicle_api_id: id, p_vehicle_type: type, p_price: price, p_custom_name: vehicleData.title });
                if (error) { showNotification(error.message, true); return; }
                if (data.success) {
                    state.wallet = data.new_wallet; logTransaction(-price, `Zakup: ${vehicleData.title}`); 
                    state.owned[key] = { ...vehicleData, odo_km: 0, earned_vc: 0, wear: 0, purchaseDate: new Date().toISOString(), customName: null, level: 1, totalEnergyCost: 0, earningsLog: [], serviceHistory: [] }; 
                    state.globalTaken.add(key); updateUI(); render(); showNotification(`Zakupiono ${vehicleData.title}!`);
                } else { showNotification(data.message, true); if(data.message.includes('zajęty')) { state.globalTaken.add(key); render(); } }
            })(); 
            return; 
        }

        // 2. Kupno Stacji (NIERUCHOMOŚCI)
        const buyStationTarget = e.target.closest('[data-buy-station]');
        if (buyStationTarget) { 
            e.stopPropagation(); 
            (async () => {
                const [id, priceStr] = buyStationTarget.dataset.buyStation.split('|'); 
                const price = parseInt(priceStr); 
                if (state.wallet >= price) { 
                    const { data, error } = await supabase.rpc('buy_station_secure', { p_station_id: id, p_price: price });
                    if (error) { showNotification(error.message, true); return; }
                    if (data.success) {
                        state.wallet = data.new_wallet;
                        // Update local state
                        let found = false;
                        for (const cat in state.infrastructure) { 
                            if(state.infrastructure[cat][id]) {
                                state.infrastructure[cat][id].owned = true; 
                                found = true;
                            }
                        }
                        updateUI(); render(); 
                        showNotification("Zakupiono nieruchomość!");
                    } else { showNotification(data.message, true); }
                } else { showNotification('Za mało środków!', true); } 
            })();
            return; 
        }

        // 3. Otwieranie Skrzynek
        const openBoxTarget = e.target.closest('[data-open-box]'); 
        if (openBoxTarget) { 
            e.stopPropagation(); 
            lootboxManager.openLootbox(openBoxTarget.dataset.openBox); 
            return; 
        }

        // 4. Obsługa Gildii
        if (e.target.id === 'create-guild-btn') {
            const name = $('guild-name-input').value;
            if(name && state.wallet >= config.guilds.creationCost) {
                state.wallet -= config.guilds.creationCost;
                const gid = 'g' + Date.now();
                state.guild.guilds[gid] = { name, leader: state.profile.companyName, bank: 0, members: [state.profile.companyName], ownedAssets: {}, chat: [], description: "Nowa gildia" };
                state.guild.playerGuildId = gid;
                render(); showNotification("Gildia założona!");
            }
        }
        
        // ... (Reszta obsługi: join guild, treasury, chat - standardowe) ...
        
        // 5. Obsługa Kart Pojazdów (Klik w liście)
        const vehicleItem = e.target.closest('[data-key]'); 
        if (vehicleItem && !e.target.closest('button')) { 
            state.selectedVehicleKey = vehicleItem.dataset.key; 
            render(); 
        }
        
        // 6. Obsługa Stacji (Klik w liście)
        const stationItem = e.target.closest('[data-station-id]');
        if (stationItem && !e.target.closest('button')) {
            // Kliknięcie w stację w liście (jeśli nie w przycisk)
            // Logika jest teraz inline w rendererze (onclick), ale to jest fallback
        }
    });

    // Vehicle Card Actions
    const card = $('vehicle-card');
    if (card) {
        card.addEventListener('click', e => {
            const target = e.target.closest('button');
            if (!target) return;
            const key = state.selectedVehicleKey;
            
            if (target.id === 'close-card-btn') { state.selectedVehicleKey = null; render(); }
            // ... (upgrade, sell logic from previous versions) ...
        });
    }
    
    // Modals
    $('close-prize-modal').addEventListener('click', () => $('lootbox-prize-modal').style.display = 'none');
    $('cancel-sell-btn').addEventListener('click', () => $('sell-modal').style.display = 'none');
    $('close-asset-details-modal').addEventListener('click', () => $('asset-details-modal').style.display = 'none');
}