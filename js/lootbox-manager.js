// js/lootbox-manager.js
import { lootboxConfig } from './config.js';
import { showNotification, fmt, getVehicleRarity, getIconHtml, $ } from './utils.js';
import { updateUI, forceUpdateWallet } from './ui-core.js';
import { supabase } from './supabase.js';

export class LootboxManager {
    constructor(gameState) {
        this.state = gameState;
        this.pendingLootboxes = [];
    }

    // Otwieranie skrzynki (z osiągnięć lub kupionej)
    openLootbox(boxType, isFromAchievement = false) {
        const box = lootboxConfig[boxType];
        if (!box) {
            console.error(`Nieznany typ skrzynki: ${boxType}`);
            return null;
        }

        // Jeśli to nie nagroda, pobierz opłatę
        if (!isFromAchievement) {
            if (this.state.wallet < box.cost) {
                showNotification("Brak wystarczających środków!", true);
                return null;
            }
            this.state.wallet -= box.cost;
        }

        // Statystyki
        if (!this.state.profile.lootboxes_opened) this.state.profile.lootboxes_opened = 0;
        this.state.profile.lootboxes_opened++;

        // Losowanie rzadkości
        const rand = Math.random();
        let cumulativeProb = 0;
        let prizeRarity = 'common';
        
        for (const rarity in box.drops) {
            cumulativeProb += box.drops[rarity];
            if (rand < cumulativeProb) {
                prizeRarity = rarity;
                break;
            }
        }

        // Znajdź dostępne pojazdy tej rzadkości
        let unownedVehicles = [];
        Object.values(this.state.vehicles).forEach(vehicleMap => {
            for (const v of vehicleMap.values()) {
                if (!this.state.owned[`${v.type}:${v.id}`]) {
                    unownedVehicles.push(v);
                }
            }
        });

        // Filtruj po typie skrzynki (np. tylko pociągi)
        if (box.type) {
            unownedVehicles = unownedVehicles.filter(v => v.type === box.type);
        }

        // Filtruj po wylosowanej rzadkości
        let prizePool = unownedVehicles.filter(v => getVehicleRarity(v) === prizeRarity);

        // Fallback (jeśli brak pojazdów danej rzadkości, szukaj niższych)
        if (prizePool.length === 0) {
            const rarities = ['legendary', 'epic', 'rare', 'common'];
            for (let i = rarities.indexOf(prizeRarity) + 1; i < rarities.length; i++) {
                prizePool = unownedVehicles.filter(v => getVehicleRarity(v) === rarities[i]);
                if (prizePool.length > 0) {
                    prizeRarity = rarities[i];
                    break;
                }
            }
        }

        // === OTWIERANIE MODALA I ANIMACJA ===
        const modal = $('lootbox-prize-modal');
        const prizeCard = $('prize-card');
        const backFace = $('prize-card-back');
        const detailsEl = $('prize-details');
        const messageEl = $('prize-message');
        const titleEl = $('prize-title');

        if (modal && prizeCard) {
            // Reset stanu karty
            prizeCard.classList.remove('is-flipped');
            // Pokazanie modala
            modal.style.display = 'flex';

            // Opóźnienie dla animacji obrotu
            setTimeout(() => {
                prizeCard.classList.add('is-flipped');
                
                if (prizePool.length > 0) {
                    const prize = prizePool[Math.floor(Math.random() * prizePool.length)];
                    const key = `${prize.type}:${prize.id}`;

                    this.state.owned[key] = {
                        ...prize,
                        odo_km: 0,
                        earned_vc: 0,
                        wear: 0,
                        purchaseDate: new Date().toISOString(),
                        customName: null,
                        level: 1,
                        totalEnergyCost: 0,
                        earningsLog: [],
                        serviceHistory: []
                    };
                    
                    // Logika zapisu do bazy
                    (async () => {
                        const user = (await supabase.auth.getUser()).data.user;
                        if(user) {
                            await supabase.from('vehicles').insert([{ 
                                owner_id: user.id, 
                                vehicle_api_id: prize.id, 
                                type: prize.type, 
                                custom_name: prize.title, 
                                wear: 0, 
                                is_moving: false 
                            }]);
                            if (!isFromAchievement) {
                                await supabase.from('profiles').update({ wallet: this.state.wallet }).eq('id', user.id);
                            }
                        }
                    })();

                    // Wypełnij tył karty danymi wygranego pojazdu
                    titleEl.textContent = "GRATULACJE!";
                    messageEl.textContent = "Pojazd został dodany do Twojej floty!";
                    
                    // Stylizacja w zależności od rzadkości (kolor ramki)
                    const borderColors = { common: 'border-gray-500', rare: 'border-blue-500', epic: 'border-purple-500', legendary: 'border-yellow-500' };
                    backFace.className = `prize-card-face prize-card-back absolute inset-0 flex items-center justify-center bg-[#1a1a1a] border-2 ${borderColors[prizeRarity]} rotate-y-180 backface-hidden`;
                    
                    detailsEl.innerHTML = `
                        <div class="flex flex-col items-center">
                            <div class="text-6xl mb-2">${getIconHtml(prize.type)}</div>
                            <h4 class="text-lg font-bold text-white font-header uppercase">${prize.title}</h4>
                            <div class="text-xs text-gray-400 font-mono uppercase mt-1">${prizeRarity}</div>
                        </div>
                    `;
                    
                } else {
                    // Fallback (zwrot kasy)
                    const fallbackVC = Math.round(box.cost * 0.75);
                    this.state.wallet += fallbackVC;
                    
                    titleEl.textContent = "ZWROT ŚRODKÓW";
                    messageEl.textContent = `Brak dostępnych pojazdów. Zwrócono ${fmt(fallbackVC)} VC.`;
                    backFace.className = `prize-card-face prize-card-back absolute inset-0 flex items-center justify-center bg-[#1a1a1a] border-2 border-gray-500 rotate-y-180 backface-hidden`;
                    detailsEl.innerHTML = `
                        <div class="flex flex-col items-center">
                            <div class="text-6xl mb-2">💰</div>
                            <h4 class="text-lg font-bold text-white font-header uppercase">${fmt(fallbackVC)} VC</h4>
                        </div>
                    `;
                }
            }, 600); // Czas trwania animacji "rzucania" przed obrotem
        } else {
            console.error("Nie znaleziono elementów modala lootboxa!");
        }

        updateUI();
        forceUpdateWallet();

        return { success: true };
    }

    static initializeLootboxSystem(gameState) {
        if (!gameState.pendingLootboxes) gameState.pendingLootboxes = [];
        if (!gameState.profile.lootboxes_opened) gameState.profile.lootboxes_opened = 0;
        return new LootboxManager(gameState);
    }
}

export function createLootboxManager(gameState) {
    return LootboxManager.initializeLootboxSystem(gameState);
}