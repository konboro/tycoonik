// js/lootbox-manager.js
import { lootboxConfig } from './config.js';
import { showNotification, fmt, getVehicleRarity } from './utils.js';
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

        let result = {
            success: true,
            type: 'vehicle',
            rarity: prizeRarity,
            lootboxType: boxType,
            fromAchievement: isFromAchievement,
            fallbackReward: null
        };

        if (prizePool.length > 0) {
            // Przyznaj pojazd
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

            // Zapisz do bazy (Supabase)
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
                    // Jeśli kupione za kasę, zaktualizuj portfel w bazie
                    if (!isFromAchievement) {
                        await supabase.from('profiles').update({ wallet: this.state.wallet }).eq('id', user.id);
                    }
                }
            })();

            result.prize = prize;
            result.message = `Otrzymano: ${prize.title}!`;
            
            showNotification(`🎁 ${box.name}: ${prize.title}!`);
        } else {
            // Fallback: zwrot gotówki (lub nagroda pocieszenia)
            const fallbackVC = Math.round(box.cost * 0.75);
            this.state.wallet += fallbackVC;
            
            result.type = 'currency';
            result.fallbackReward = fallbackVC;
            result.message = `Brak dostępnych pojazdów. Otrzymano ${fmt(fallbackVC)} VC.`;
            
            showNotification(`📦 ${box.name}: +${fmt(fallbackVC)} VC (zwrot)`);
        }

        updateUI();
        forceUpdateWallet();

        return result;
    }

    // Otwieranie skrzynki z osiągnięcia
    openAchievementLootbox(achievementId, lootboxType) {
        const result = this.openLootbox(lootboxType, true);
        return result;
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