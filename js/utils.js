// js/utils.js - WERSJA DLA DOLNEGO TICKERA
import { 
    ICONS as ASSET_ICONS, 
    getIconHtml as getIconHtmlFromAssets, 
    getVehicleRarity as getVehicleRarityFromAssets 
} from './assets.js';

export const $ = id => document.getElementById(id);
export const fmt = n => Math.round(n).toLocaleString('pl-PL');

export function hav(a,b,c,d){const R=6371,dLa=(c-a)*Math.PI/180,dLo=(d-b)*Math.PI/180,x=Math.sin(dLa/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x));}

export function jitter(lat,lon,i=0){ const r=(i%5)*0.00015, ang=((i*137)%360)*Math.PI/180; return { lat: lat + Math.sin(ang)*r, lon: lon + Math.cos(ang)*r }; }

export function getWeatherIcon(code) { 
    if ([0, 1].includes(code)) return 'ri-sun-line'; 
    if ([2].includes(code)) return 'ri-cloudy-line'; 
    if ([3].includes(code)) return 'ri-cloud-line'; 
    if ([45, 48].includes(code)) return 'ri-foggy-line'; 
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'ri-drizzle-line'; 
    if ([71, 73, 75, 85, 86].includes(code)) return 'ri-snowy-line'; 
    if ([95, 96, 99].includes(code)) return 'ri-thunderstorms-line'; 
    return 'ri-temp-hot-line'; 
}

export const ICONS = ASSET_ICONS;
export const getIconHtml = getIconHtmlFromAssets;
export const getVehicleRarity = getVehicleRarityFromAssets;

export function createIcon(isOwnedAndMoving) { 
    return L.divIcon({ 
        className: `leaflet-marker-icon ${isOwnedAndMoving ? 'is-moving' : ''} bg-transparent border-none`, 
        iconSize: [40, 40], 
        iconAnchor: [20, 20] 
    }); 
}

// === ZMODYFIKOWANE POWIADOMIENIA DLA TICKERA ===
export function showNotification(message, isError = false) { 
    const ticker = $('live-ticker');
    if(!ticker) return;

    const span = document.createElement('span');
    span.className = "mx-8 flex items-center gap-2";
    
    // Wybór ikony i koloru w zależności od typu
    let iconClass = "ri-information-line";
    let colorClass = "text-blue-400";
    
    if (isError) {
        iconClass = "ri-error-warning-fill";
        colorClass = "text-red-500";
    } else if (message.includes('Zakup') || message.includes('Otrzymano') || message.includes('zysk')) {
        iconClass = "ri-check-double-line";
        colorClass = "text-green-500";
    } else if (message.includes('Osiągnięcie')) {
        iconClass = "ri-trophy-fill";
        colorClass = "text-[#eab308]"; // Gold/Yellow
    }

    span.innerHTML = `<i class="${iconClass} ${colorClass}"></i> <span class="text-white">${message}</span>`;
    
    // Dodajemy na koniec tickera
    ticker.appendChild(span);

    // Ograniczenie długości historii (np. max 15 wpisów, żeby DOM nie puchł)
    if (ticker.children.length > 15) {
        ticker.removeChild(ticker.children[0]);
    }
}

export function showConfirm(message, onConfirm) { 
    const modal = $('confirm-modal'); 
    $('confirm-modal-text').textContent = message; 
    const confirmBtn = $('confirm-ok-btn'); 
    const cancelBtn = $('confirm-cancel-btn'); 
    const newConfirmBtn = confirmBtn.cloneNode(true); 
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn); 
    newConfirmBtn.onclick = () => { onConfirm(); modal.style.display = 'none'; }; 
    cancelBtn.onclick = () => { modal.style.display = 'none'; }; 
    modal.style.display = 'flex'; 
}

export function getProximityBonus(lat, lon, playerLocation) {
    if (!playerLocation || lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return 1.0;
    const distance = hav(playerLocation.lat, playerLocation.lon, lat, lon);
    return distance <= 100 ? 1.5 : 1.0;
}