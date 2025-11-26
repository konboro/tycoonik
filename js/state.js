import { config } from './config.js'; 
import { ACHIEVEMENTS, AchievementManager, initializeAchievements } from './achievements.js';
import { showNotification } from './notifications.js';
// USUNIĘTO: import lootbox-manager (przerywamy cykl)

export const state = {
  vehicles: { plane: new Map(), train: new Map(), tube: new Map(), bus: new Map(), bike: new Map(), 'river-bus': new Map(), tram: new Map(), scooter: new Map() },
  profile: { companyName: null, logo: '🏢', color: 'blue', level: 1, xp: 0, km_total: 0, total_earned: 0, reputation: {}, minutes_in_transit: 0, earnings_history: [], dailyEarningsHistory: [], services_done: 0, upgrades_done: 0, lootboxes_opened: 0,transaction_history: [], friends: [] },
  wallet: 50000,
  owned: {},
  economy: { 
      globalFuels: {
          'Diesel': { price: 1.45, trend: 'stable' },
          'Benzyna': { price: 1.62, trend: 'up' },
          'Aviation': { price: 2.85, trend: 'down' },
          'Electricity': { price: 0.25, trend: 'stable' }
      }
  },
  marketListings: [],
  rankings: { assetValue: [], weeklyEarnings: [] },
  lastDayCheck: new Date().toISOString().slice(0, 10),
  infrastructure: {
      trainStations: { HKI: { owned: false, totalEarnings: 0, arrivals: 0, departures: 0, hourlyEarnings: 0, earningsLog: [] }, TPE: { owned: false, totalEarnings: 0, arrivals: 0, departures: 0, hourlyEarnings: 0, earningsLog: [] } },
      tubeStations: { VIC: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] } },
      busTerminals: { SOU: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] }, VCS: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] }, TFS: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] } },
      riverPiers: { WSP: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] } },
      cableCar: { LCC: { owned: false, totalEarnings: 0, status: 'Unknown', hourlyEarnings: 0, earningsLog: [] } }
  },
  guild: { playerGuildId: null, guilds: {} },
  trainLog: {}, tubeLog: {}, busLog: {}, riverBusLog: {},
  stationData: { HKI: [], TPE: [], VIC: [], SOU: [], LCC: [], WSP: [] },
  lastPos: new Map(),
  globalTaken: new Set(),
  achievements: {}, 
  pendingLootboxes: [],
  marketDemand: {},
  filters: { types: ['infrastructure', 'plane', 'train', 'tube', 'tram', 'bus', 'bike', 'river-bus', 'scooter'], countries: ['Poland', 'USA', 'Finland', 'UK', 'Europe', 'Greece'], rarities: ['common', 'rare', 'epic', 'legendary'], mapView: 'all' },
  activeTab: null,
  selectedVehicleKey: null, selectedStationId: null,
  markers: new Map(), weatherCache: new Map(), countryWeatherCache: new Map(),
  charts: {}, assetChart: null,
  playerMarker: null,
  playerLocation: null,
  proximityCircle: null,
  markerClusterGroup: null, 
  ui: { statsTimeframe: '24h', clusteringEnabled: true },
  missions: { available: [], active: [], completed: 0 },
  social: { friends: [], requests: [], searchResults: [], activeChatFriendId: null, messages: {} }
};

initializeAchievements(state);
export const achievementManager = new AchievementManager(state);
export const achievementsList = ACHIEVEMENTS;
// USUNIĘTO: export lootboxManager (przerywamy cykl)

export const map = (typeof L !== 'undefined') ? L.map('map', { zoomControl: true, maxZoom: 22 }).setView([52.23, 21.01], 6) : null;

if (map && typeof L.markerClusterGroup !== 'undefined') {
    state.markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: function(cluster) {
            var childCount = cluster.getChildCount();
            var c = ' marker-cluster-';
            if (childCount < 10) { c += 'small'; } 
            else if (childCount < 100) { c += 'medium'; } 
            else { c += 'large'; }
            return new L.DivIcon({ html: '<div><span>' + childCount + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(40, 40) });
        }
    });
    if (state.ui.clusteringEnabled) { map.addLayer(state.markerClusterGroup); }
}

export function logTransaction(amount, description) { 
    if (!state.profile.transaction_history) state.profile.transaction_history = []; 
    state.profile.transaction_history.unshift({ amount, description, timestamp: new Date().toISOString(), balance: state.wallet }); 
    if (state.profile.transaction_history.length > 200) state.profile.transaction_history.pop(); 
}

// Ta funkcja zostaje tutaj, ale ui-core będzie używać własnej kopii, żeby nie importować state.js -> logic.js -> ui-core.js
export function calculateAssetValue() {
    const fleetValue = Object.values(state.owned).reduce((sum, v) => sum + (config.basePrice[v.type] || 0), 0);
    const infraValue = Object.values(state.infrastructure).reduce((sum, category) => {
        return sum + Object.keys(category).reduce((catSum, key) => {
            return catSum + (category[key].owned ? config.infrastructure[key].price : 0);
        }, 0);
    }, 0);
    return state.wallet + fleetValue + infraValue;
}

export function checkAchievements() {
    const newAchievements = achievementManager.checkAchievements();
    newAchievements.forEach(achievement => { showNotification(`🏆 Osiągnięcie odblokowane: ${achievement.title}!`); });
    return newAchievements;
}

export function checkLevelUp() {
    const xpRequired = 100 + (state.profile.level - 1) * 50;
    while (state.profile.xp >= xpRequired) {
        state.profile.xp -= xpRequired;
        state.profile.level++;
        if (typeof showNotification === 'function') { showNotification(`⭐ Awans na poziom ${state.profile.level}!`); }
        checkAchievements();
    }
}

export function initializeGameState() {
    initializeAchievements(state);
    if (!state.profile.transaction_history) state.profile.transaction_history = [];
    if (!state.profile.friends) state.profile.friends = [];
    if (!state.profile.earnings_history) state.profile.earnings_history = [];
    if (!state.economy.globalFuels) {
        state.economy.globalFuels = {
            'Diesel': { price: 1.45, trend: 'stable' },
            'Benzyna': { price: 1.62, trend: 'up' },
            'Aviation': { price: 2.85, trend: 'down' },
            'Electricity': { price: 0.25, trend: 'stable' }
        };
    }
}