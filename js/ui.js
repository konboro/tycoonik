import { state, achievementsList, logTransaction } from './state.js';
import { config, lootboxConfig } from './config.js';
import { supabase } from './supabase.js';
import { $, fmt, showNotification, showConfirm, getVehicleRarity, getIconHtml } from './utils.js';
import { map } from './state.js';
import { render, updateUI, toggleContentPanel, redrawMap, updateMapFilterButtons } from './ui-core.js'; // Dodano updateMapFilterButtons
import { createLootboxManager } from './lootbox-manager.js';

const lootboxManager = createLootboxManager(state);

export function setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.navTab;
            // USUŃ LINIĘ: if(tab === 'profile') return; 
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

    // --- NAPRAWIONA OBSŁUGA FILTRÓW W PANELU ---
    const controls = $('panel-controls');
    if(controls) {
        controls.addEventListener('click', e => { 
            // 1. Odświeżanie
            if (e.target.id === 'refreshAll') { 
                import('./api-server.js').then(m => {
                    m.forceRefreshVehicles().then(() => {
                        m.fetchAllVehicles().then(() => render());
                    });
                });
                return;
            }
            
            // 2. Kafelki Filtrów (Typy, Rzadkość, Kraj)
            const filterBtn = e.target.closest('[data-filter-category]');
            if (filterBtn) {
                const category = filterBtn.dataset.filterCategory; // np. 'types'
                const value = filterBtn.dataset.filterValue;       // np. 'plane'

                if (state.filters[category].includes(value)) {
                    // Usuń filtr (odznacz)
                    state.filters[category] = state.filters[category].filter(item => item !== value);
                } else {
                    // Dodaj filtr (zaznacz)
                    state.filters[category].push(value);
                }

                // Odśwież wszystko: Panel, Mapę i Przyciski HUD
                render(); 
                redrawMap();
                updateMapFilterButtons(); 
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
                        let found = false;
                        for (const cat in state.infrastructure) { 
                            if(state.infrastructure[cat][id]) {
                                state.infrastructure[cat][id].owned = true; 
                                found = true;
                            }
                        }
                        updateUI(); 
                        render(); // Ważne: Przeładowanie
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
        
        const vehicleItem = e.target.closest('[data-key]'); 
        if (vehicleItem && !e.target.closest('button')) { 
            state.selectedVehicleKey = vehicleItem.dataset.key; 
            render(); 
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
            if (target.id === 'edit-vehicle-name-btn') { 
                const ownedData = state.owned[key];
                if (!ownedData) return;
                const newName = prompt(`Nowa nazwa:`, ownedData.customName);
                if (newName && newName.trim() !== "") { ownedData.customName = newName.trim(); render(); }
            }
            if (target.id === 'upgrade-btn') { 
                const ownedData = state.owned[key];
                if (!ownedData || (ownedData.level || 1) >= 5) return;
                const nextLevelIndex = ownedData.level || 1;
                const cost = config.upgrade.costs[nextLevelIndex];
                if (state.wallet >= cost) {
                    state.wallet -= cost;
                    logTransaction(-cost, `Ulepszenie: ${ownedData.customName}`);
                    ownedData.level = (ownedData.level || 1) + 1;
                    state.profile.upgrades_done++;
                    updateUI(); render();
                } else { showNotification("Brak środków!", true); }
            }
            if (target.id === 'sell-quick-btn') { 
                const vehicle = state.owned[key];
                if (!vehicle) return;
                const basePrice = config.basePrice[vehicle.type] || 0;
                const sellPrice = Math.round(basePrice * 0.40);
                showConfirm(`Sprzedać ${vehicle.customName || vehicle.title} za ${fmt(sellPrice)} VC?`, () => {
                    state.wallet += sellPrice;
                    logTransaction(sellPrice, `Szybka sprzedaż: ${vehicle.customName || vehicle.title}`);
                    delete state.owned[key];
                    state.selectedVehicleKey = null;
                    updateUI(); render();
                    (async () => {
                        const user = (await supabase.auth.getUser()).data.user;
                        if(user) {
                           await supabase.from('vehicles').delete().eq('vehicle_api_id', vehicle.id).eq('owner_id', user.id);
                           await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', user.id);
                        }
                    })();
                    showNotification(`Sprzedano za ${fmt(sellPrice)} VC.`);
                });
            }
            if (target.id === 'sell-market-btn') { 
                const vehicle = state.owned[key];
                if (!vehicle) return;
                const modal = $('sell-modal');
                const basePrice = config.basePrice[vehicle.type] || 0;
                $('sell-modal-text').textContent = `Wystawiasz: ${vehicle.customName || vehicle.title}`;
                const priceInput = $('sell-price');
                priceInput.value = basePrice;
                const infoEl = $('sell-modal-info');
                const updateConf = () => {
                    const price = parseInt(priceInput.value) || 0;
                    const commission = Math.round(price * 0.05);
                    infoEl.innerHTML = `Prowizja (5%): ${fmt(commission)} VC<br>Otrzymasz: ${fmt(price - commission)} VC`;
                };
                priceInput.addEventListener('input', updateConf);
                updateConf();
                modal.style.display = 'flex';
                const confirmBtn = $('confirm-sell-btn');
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                newConfirmBtn.onclick = () => {
                    const price = parseInt(priceInput.value);
                    if (isNaN(price) || price <= 0) { showNotification("Błędna cena.", true); return; }
                    const commission = Math.round(price * 0.05);
                    state.wallet -= commission;
                    logTransaction(-commission, `Prowizja: ${vehicle.customName}`);
                    const durationHours = parseInt($('sell-duration').value);
                    state.marketListings.push({ vehicle: { ...vehicle }, price: price, expiresAt: new Date(Date.now() + durationHours * 3600000).toISOString(), seller: state.profile.companyName });
                    delete state.owned[key];
                    state.selectedVehicleKey = null;
                    showNotification(`Wystawiono na giełdę.`);
                    render();
                    modal.style.display = 'none';
                };
            }
            if (target.dataset.svc) { 
                const owned = state.owned[target.dataset.svc]; 
                if(owned) { 
                    const cost = Math.round((owned.wear || 0) * (config.basePrice[owned.type] / 200));
                    showConfirm(`Serwis ${fmt(cost)} VC?`, () => {
                        if (state.wallet < cost) { showNotification("Brak środków!", true); return; }
                        state.wallet -= cost; owned.wear = 0; state.profile.services_done++; render(); 
                    });
                } 
            }
        });
    }
    
    $('close-prize-modal').addEventListener('click', () => $('lootbox-prize-modal').style.display = 'none');
    $('cancel-sell-btn').addEventListener('click', () => $('sell-modal').style.display = 'none');
    $('close-asset-details-modal').addEventListener('click', () => $('asset-details-modal').style.display = 'none');
}