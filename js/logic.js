import { state, logTransaction, achievementsList } from './state.js';
import { config } from './config.js';
import { hav, $, showNotification, fmt, getProximityBonus } from './utils.js';
import { updateUI, render, forceUpdateWallet } from './ui-core.js';
import { fetchTrainStationData, fetchTfLArrivals, fetchMbtaBusTerminalData, fetchCableCarStatus } from './api.js';
import { supabase } from './supabase.js';

// ===== GŁÓWNE CYKLE (TICKS) =====

export function tickEconomy() {
    let inMin = 0, outMin = 0;
    let currentTickEarnings = 0;
    const now = Date.now();

    for (const key in state.owned) {
        const ownedData = state.owned[key];
        const liveData = state.vehicles[ownedData.type]?.get(ownedData.id);
        
        if (!liveData || !isFinite(liveData.lat) || !isFinite(liveData.lon)) { ownedData.isMoving = false; continue; }

        const prevLat = ownedData.lat; const prevLon = ownedData.lon;
        ownedData.lat = liveData.lat; ownedData.lon = liveData.lon;

        let km = 0; ownedData.isMoving = false;
        if (prevLat && prevLon) {
            km = hav(prevLat, prevLon, ownedData.lat, ownedData.lon);
            if (km > 0.002 && km < 500) ownedData.isMoving = true; else km = 0;
        }

        if (!ownedData.history) ownedData.history = [];
        if (ownedData.isMoving) ownedData.history.push({ lat: ownedData.lat, lon: ownedData.lon, timestamp: now });
        ownedData.history = ownedData.history.filter(p => now - p.timestamp < 3600 * 1000);
        if(ownedData.isMoving) state.profile.minutes_in_transit++;

        const type = ownedData.type;
        const levelIndex = (ownedData.level || 1) - 1;
        
        const reputationBonus = 1 + Math.floor((state.profile.reputation[type] || 0) / 1000) * 0.05;
        const levelBonus = config.upgrade.bonus[levelIndex] || 1;
        const proximityBonus = getProximityBonus(ownedData.lat, ownedData.lon, state.playerLocation);

        const baseRate = config.baseRate[type] || 1;
        const inc = km * baseRate * reputationBonus * levelBonus * proximityBonus;
        
        // --- NOWA LOGIKA KOSZTÓW PALIWA (GLOBALNE) ---
        let energyCost = 0;
        const efficiencyBonus = config.upgrade.efficiencyBonus[levelIndex] || 1;
        
        // Określenie typu paliwa
        let fuelType = 'Diesel'; // Domyślnie
        let consumption = config.fuelConsumption[type];

        if (config.energyConsumption[type] > 0) {
            fuelType = 'Electricity';
            consumption = config.energyConsumption[type];
        } else if (type === 'plane') {
            fuelType = 'Aviation';
        }

        // Pobranie ceny globalnej
        const pricePerUnit = state.economy.globalFuels[fuelType]?.price || 1.50;
        
        if (consumption > 0) {
            // consumption jest zazwyczaj na 100km
            energyCost = (km / 100) * consumption * efficiencyBonus * pricePerUnit;
        }

        const delta = inc - energyCost;
        currentTickEarnings += delta;
        inMin += inc; outMin += energyCost;
        state.wallet += delta;
        if(delta > 0) state.profile.total_earned += delta;
        
        ownedData.odo_km = (ownedData.odo_km || 0) + km;
        ownedData.earned_vc = (ownedData.earned_vc || 0) + delta;
        ownedData.totalEnergyCost = (ownedData.totalEnergyCost || 0) + energyCost;
        
        let wearIncrease = 0.005; if (ownedData.isMoving) wearIncrease = 0.01;
        ownedData.wear = Math.min(100, (ownedData.wear || 0) + wearIncrease);

        if (ownedData.wear >= 100) {
            showNotification(`Pojazd ${ownedData.customName || ownedData.title} uległ awarii!`, true);
            delete state.owned[key];
            continue;
        }

        if (!ownedData.earningsLog) ownedData.earningsLog = [];
        ownedData.earningsLog.push({ timestamp: Date.now(), profit: delta, km: km });
        if (ownedData.earningsLog.length > 100) ownedData.earningsLog.shift();

        if (km > 0) { state.profile.km_total += km; state.profile.reputation[type] = (state.profile.reputation[type] || 0) + km; }
    }

    if (!state.profile.earnings_history) state.profile.earnings_history = [];
    if (typeof currentTickEarnings === 'number' && isFinite(currentTickEarnings)) {
        state.profile.earnings_history.push(currentTickEarnings);
        if (state.profile.earnings_history.length > 60) state.profile.earnings_history.shift();
    }
    
    updateUI(inMin, outMin);
    if (currentTickEarnings !== 0) forceUpdateWallet();
}

// ... (Reszta funkcji logic.js: tickGuilds, tickAllInfrastructure, calculateAssetValue itd. BEZ ZMIAN) ...
export function tickGuilds() {
    for (const guildId in state.guild.guilds) {
        const guild = state.guild.guilds[guildId];
        let tickIncome = 0;
        for(const assetKey in guild.ownedAssets) {
            const asset = config.guildAssets[assetKey];
            if(asset) tickIncome += asset.incomePerTick;
        }
        if (tickIncome > 0) {
            guild.bank += tickIncome;
            if (state.guild.playerGuildId === guildId) {
                const perMemberShare = Math.floor(tickIncome * 0.05); 
                if (perMemberShare > 0) {
                    state.wallet += perMemberShare;
                    logTransaction(perMemberShare, `Dywidenda: ${guild.name}`);
                    forceUpdateWallet();
                }
            }
        }
    }
    if (state.activeTab === 'guild') render();
}

export const tickAllInfrastructure = () => {
    tickTrainStations();
    tickTfLStation('tubeStations', 50, state.tubeLog, '🚇');
    tickTfLStation('busTerminals', 25, state.busLog, '🚏');
    tickTfLStation('riverPiers', 40, state.riverBusLog, '⚓');
    tickMbtaBusTerminals();
    tickCableCar();
};

async function tickTrainStations() { 
    for (const stationCode in state.infrastructure.trainStations) { 
        try { 
            const station = state.infrastructure.trainStations[stationCode]; 
            if (!station.owned) continue; 
            const stationConfig = config.infrastructure[stationCode]; 
            const proximityBonus = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation); 
            
            const trains = await fetchTrainStationData(stationConfig.apiId); 
            if (!Array.isArray(trains)) { state.stationData[stationCode] = []; continue; } 
            state.stationData[stationCode] = trains; 
            
            let earningsThisTick = 0; 
            let departures = 0; 
            let arrivals = 0; 
            
            for (const train of trains) { 
                const trainId = `${train.trainNumber}-${train.departureDate}`; 
                const stationRow = train.timeTableRows.find(row => row.stationShortCode === stationConfig.apiId); 
                if (!stationRow) continue; 
                
                if (!state.trainLog[trainId]) { state.trainLog[trainId] = { departedPaid: false, arrivedPaid: false }; } 
                
                let penaltyFactor = 1.0;
                let delayMinutes = 0;
                
                if (stationRow.actualTime && stationRow.scheduledTime) {
                    const actual = new Date(stationRow.actualTime);
                    const scheduled = new Date(stationRow.scheduledTime);
                    delayMinutes = Math.round((actual - scheduled) / 60000);
                    if (delayMinutes > 3) penaltyFactor = 0.5;
                }

                const baseEarning = 150 * proximityBonus * penaltyFactor; 

                if (stationRow.type === 'DEPARTURE' && stationRow.actualTime && !state.trainLog[trainId].departedPaid) { 
                    const timeDiff = (Date.now() - new Date(stationRow.actualTime).getTime()) / 60000;
                    if (timeDiff >= 0 && timeDiff < 15) {
                        state.wallet += baseEarning; 
                        earningsThisTick += baseEarning; 
                        departures++; 
                        station.departures++; 
                        state.trainLog[trainId].departedPaid = true;
                        if (delayMinutes > 3) {
                            showNotification(`Pociąg ${train.trainType}${train.trainNumber} opóźniony (+${delayMinutes} min): +${fmt(baseEarning)} VC`, true);
                        } else {
                            showNotification(`Pociąg ${train.trainType}${train.trainNumber} odjechał punktualnie: +${fmt(baseEarning)} VC`);
                        }
                    }
                } 
                
                if (stationRow.type === 'ARRIVAL' && stationRow.actualTime && !state.trainLog[trainId].arrivedPaid) { 
                    const timeDiff = (Date.now() - new Date(stationRow.actualTime).getTime()) / 60000;
                    if (timeDiff >= 0 && timeDiff < 15) {
                        state.wallet += baseEarning; 
                        earningsThisTick += baseEarning; 
                        arrivals++; 
                        station.arrivals++; 
                        state.trainLog[trainId].arrivedPaid = true;
                        if (delayMinutes > 3) {
                            showNotification(`Pociąg ${train.trainType}${train.trainNumber} przybył z opóźnieniem (+${delayMinutes} min): +${fmt(baseEarning)} VC`, true);
                        } else {
                            showNotification(`Pociąg ${train.trainType}${train.trainNumber} przybył o czasie: +${fmt(baseEarning)} VC`);
                        }
                    }
                } 
            } 
            
            station.hourlyEarnings = (station.hourlyEarnings * 0.9) + (earningsThisTick * 10 * 0.1); 
            
            if (earningsThisTick > 0) { 
                station.totalEarnings += earningsThisTick; 
                state.profile.total_earned += earningsThisTick; 
                if (!station.earningsLog) station.earningsLog = []; 
                station.earningsLog.push({ timestamp: Date.now(), profit: earningsThisTick, arrivals, departures }); 
                forceUpdateWallet(); 
                if (state.activeTab === 'stations') render();
            } 
        } catch (error) { console.error("Błąd stacji:", error); } 
    } 
}

async function tickTfLStation(cat, base, log, icon) { 
    for (const code in state.infrastructure[cat]) { 
        try { 
            const s = state.infrastructure[cat][code]; 
            if (!s.owned) continue; 
            const conf = config.infrastructure[code]; 
            if (conf.apiId.startsWith('place-')) continue; 
            const bonus = getProximityBonus(conf.lat, conf.lon, state.playerLocation); 
            const data = await fetchTfLArrivals(conf.apiId); 
            state.stationData[code] = { data: Array.isArray(data) ? data : [] }; 
            let earn = 0; 
            const arrivals = (state.stationData[code].data).sort((a,b) => a.timeToStation - b.timeToStation);
            for (const a of arrivals) { 
                const id = a.id; 
                if (a.timeToStation < 60 && !log[id]) { 
                    const e = base * bonus; 
                    state.wallet += e; 
                    earn += e; 
                    s.arrivals++; 
                    log[id] = { paid: true, ts: Date.now() }; 
                    showNotification(`${icon} ${a.lineName} przybył na ${conf.name}: +${fmt(e)} VC`);
                } 
            } 
            if (earn > 0) { 
                s.totalEarnings += earn; 
                state.profile.total_earned += earn; 
                forceUpdateWallet(); 
                if (state.activeTab === 'stations') render();
            } 
        } catch (e) {} 
    } 
    const now=Date.now(); 
    for(const k in log) if(now-log[k].ts > 1800000) delete log[k]; 
}

async function tickMbtaBusTerminals() { 
    for (const code in state.infrastructure.busTerminals) { 
        const conf = config.infrastructure[code]; 
        if (!conf.apiId.startsWith('place-')) continue; 
        try { 
            const s = state.infrastructure.busTerminals[code]; 
            if (!s.owned) continue; 
            const bonus = getProximityBonus(conf.lat, conf.lon, state.playerLocation); 
            const data = await fetchMbtaBusTerminalData(conf.apiId); 
            state.stationData[code] = data; 
            let earn = 0; 
            if (data?.data) { 
                for (const p of data.data) { 
                    const id = p.id; 
                    const arrivalTime = p.attributes?.arrival_time;
                    if (arrivalTime && !state.busLog[id]) {
                        const diff = (new Date(arrivalTime) - new Date()) / 1000;
                        if (diff < 60 && diff > -60) { 
                            const e = 25 * bonus; 
                            state.wallet += e; 
                            earn += e; 
                            s.arrivals++; 
                            state.busLog[id] = { paid: true, ts: Date.now() };
                            showNotification(`🚏 Autobus przybył na ${conf.name}: +${fmt(e)} VC`);
                        }
                    }
                } 
            } 
            if (earn > 0) { 
                s.totalEarnings += earn; 
                state.profile.total_earned += earn; 
                forceUpdateWallet(); 
                if (state.activeTab === 'stations') render();
            } 
        } catch (e) {} 
    } 
}

async function tickCableCar() { 
    try { 
        const s = state.infrastructure.cableCar.LCC; 
        if (!s.owned) return; 
        const conf = config.infrastructure.LCC; 
        const bonus = getProximityBonus(conf.lat, conf.lon, state.playerLocation); 
        const data = await fetchCableCarStatus(conf.apiId); 
        const active = data?.lineStatuses?.[0]?.statusSeverityDescription === 'Good Service'; 
        if (active) { 
            const e = 5000 * 1.5 * bonus; 
            state.wallet += e; 
            s.totalEarnings += e; 
            state.profile.total_earned += e; 
            forceUpdateWallet(); 
        } 
    } catch (e) {} 
}

export function calculateAssetValue() {
    const fleetValue = Object.values(state.owned).reduce((sum, v) => sum + (config.basePrice[v.type] || 0), 0);
    const infraValue = Object.values(state.infrastructure).reduce((sum, category) => { return sum + Object.keys(category).reduce((catSum, key) => { return catSum + (category[key].owned ? config.infrastructure[key].price : 0); }, 0); }, 0);
    return state.wallet + fleetValue + infraValue;
}

export function generateAIPlayers() { 
    if (state.rankings.assetValue.length > 0) return; 
    const names = ["Global Trans", "Szybki Max", "Cargo Corp", "JetSetters", "Rail Baron", "Metro Movers", "Bus Empire", "Oceanic Trade", "Urban Wheeler"]; 
    for (let i = 0; i < 25; i++) { 
        const name = names[i % names.length] + ` ${i+1}`; 
        const assetValue = Math.floor(Math.random() * 200000000) + 50000; 
        const weeklyEarnings = Math.floor(Math.random() * 5000000) + 10000; 
        const aiPlayer = { name, assetValue, weeklyEarnings, isAI: true }; 
        state.rankings.assetValue.push(aiPlayer); 
        state.rankings.weeklyEarnings.push(aiPlayer); 
    } 
}

export function logDailyEarnings() { 
    const today = new Date().toISOString().slice(0, 10); 
    if (today === state.lastDayCheck) return; 
    const yesterday = state.lastDayCheck; 
    const totalEarnedYesterday = state.profile.total_earned; 
    const lastEntry = state.profile.dailyEarningsHistory[state.profile.dailyEarningsHistory.length - 1]; 
    const earningsForDay = lastEntry ? totalEarnedYesterday - lastEntry.totalAtEnd : totalEarnedYesterday; 
    state.profile.dailyEarningsHistory.push({ date: yesterday, earnings: earningsForDay, totalAtEnd: totalEarnedYesterday }); 
    if (state.profile.dailyEarningsHistory.length > 7) { state.profile.dailyEarningsHistory.shift(); } 
    state.lastDayCheck = today; 
}

export function updateRankings() { 
    state.rankings.assetValue.forEach(p => { if (p.isAI) p.assetValue *= (1 + (Math.random() - 0.45) * 0.05); }); 
    state.rankings.weeklyEarnings.forEach(p => { if (p.isAI) p.weeklyEarnings *= (1 + (Math.random() - 0.45) * 0.1); }); 
    const playerEntry = { name: state.profile.companyName || "Moja Firma", assetValue: calculateAssetValue(), weeklyEarnings: state.profile.dailyEarningsHistory.reduce((sum, day) => sum + day.earnings, 0), isPlayer: true }; 
    const updateList = (list, key) => { 
        let playerFound = false; 
        const newList = list.map(p => { if (p.isPlayer) { playerFound = true; return playerEntry; } return p; }); 
        if (!playerFound) newList.push(playerEntry); 
        return newList.sort((a, b) => b[key] - a[key]); 
    }; 
    state.rankings.assetValue = updateList(state.rankings.assetValue, 'assetValue'); 
    state.rankings.weeklyEarnings = updateList(state.rankings.weeklyEarnings, 'weeklyEarnings'); 
}