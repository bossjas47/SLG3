/**
 * theme-loader.js — โหลด theme จาก Firebase และ apply ให้กับทุกหน้า
 * import ไฟล์นี้ในทุกหน้าที่ต้องการ sync theme จาก Admin Panel
 */

import { db } from './firebase-config.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Apply theme data to CSS variables and DOM
 */
export function applyTheme(data) {
    if (!data) return;

    const root = document.documentElement;

    if (data.primary)   root.style.setProperty('--primary', data.primary);
    if (data.secondary) root.style.setProperty('--secondary', data.secondary);
    if (data.bgStart)   root.style.setProperty('--bg-gradient-start', data.bgStart);
    if (data.bgMid)     root.style.setProperty('--bg-gradient-mid', data.bgMid);
    if (data.textColor) root.style.setProperty('--text-primary', data.textColor);
    if (data.fontColor) root.style.setProperty('--font-color', data.fontColor);

    // Update body gradient
    if (data.bgStart || data.bgMid) {
        const bgStart = data.bgStart || '#e0f2fe';
        const bgMid   = data.bgMid   || '#f3e8ff';
        document.body.style.background = `linear-gradient(135deg, ${bgStart} 0%, ${bgMid} 50%, #f8fafc 100%)`;
    }

    // Update site name in navbars
    if (data.siteName) {
        document.querySelectorAll('[data-site-name]').forEach(el => {
            el.textContent = data.siteName;
        });
        document.title = document.title.replace(/^[^|]+/, data.siteName + ' ');
    }

    // Update logo
    document.querySelectorAll('[data-site-logo]').forEach(el => {
        if (data.logoUrl) {
            el.innerHTML = `<img src="${data.logoUrl}" class="h-8" alt="${data.siteName || 'Logo'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline'"><span style="display:none">${data.siteName || 'PanderX'}</span>`;
        } else {
            el.textContent = data.siteName || 'PanderX';
        }
    });

    // Inject custom CSS
    let styleTag = document.getElementById('theme-custom-css');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'theme-custom-css';
        document.head.appendChild(styleTag);
    }
    styleTag.textContent = data.customCSS || '';

    // Apply font color globally
    if (data.fontColor) {
        let fontStyle = document.getElementById('theme-font-color');
        if (!fontStyle) {
            fontStyle = document.createElement('style');
            fontStyle.id = 'theme-font-color';
            document.head.appendChild(fontStyle);
        }
        fontStyle.textContent = `body, body * { color-scheme: normal; } body { color: ${data.fontColor} !important; }
        .gradient-text, .gradient-text * { -webkit-text-fill-color: transparent !important; color: transparent !important; }`;
    }
}

/**
 * Load theme once and apply
 */
export async function loadTheme() {
    try {
        const snap = await getDoc(doc(db, 'system', 'theme'));
        if (snap.exists()) applyTheme(snap.data());
    } catch (e) {
        console.warn('Theme load failed:', e);
    }
}

/**
 * Real-time theme sync (ใช้สำหรับหน้าที่ต้องการ real-time update)
 */
export function subscribeTheme(callback) {
    return onSnapshot(doc(db, 'system', 'theme'), (snap) => {
        if (snap.exists()) {
            applyTheme(snap.data());
            if (callback) callback(snap.data());
        }
    });
}
