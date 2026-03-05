/**
 * PSL Esport — Shared Firebase Config
 * Firebase client config (public identifier — ไม่ใช่ secret)
 * ความปลอดภัยควบคุมผ่าน Firebase Security Rules
 *
 * ⚠️ Secrets ทั้งหมด (API Key, Webhook, ฯลฯ) → เก็บใน Firestore เท่านั้น
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    browserLocalPersistence, 
    setPersistence,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ─── Firebase Public Config ────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyC450kePwL6FdVXUSVli0bEP3DdnQs0qzU",
    authDomain:        "psl-esport.firebaseapp.com",
    projectId:         "psl-esport",
    storageBucket:     "psl-esport.firebasestorage.app",
    messagingSenderId: "225108570173",
    appId:             "1:225108570173:web:b6483c02368908f3783a54"
};

// ─── Singleton: ป้องกัน initializeApp ซ้ำกรณี hot reload ─────────────────────
const app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── Force LOCAL persistence ให้ auth state อยู่ข้ามหน้า ────────────────────────
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ─── Config Cache ─────────────────────────────────────────────────────────────
let _siteConfig = null, _siteTs = 0;
let _appConfig  = null, _appTs  = 0;
let _themeConfig = null, _themeTs = 0;
const TTL = 5 * 60 * 1000;

export { app, db, auth };

// ─── Site Config ──────────────────────────────────────────────────────────────
export async function getSiteConfig() {
    if (_siteConfig && Date.now() - _siteTs < TTL) return _siteConfig;
    try {
        const s = await getDoc(doc(db, "system", "settings"));
        _siteConfig = s.exists() ? s.data() : {};
        _siteTs = Date.now();
    } catch { _siteConfig = _siteConfig || {}; }
    return _siteConfig;
}

export async function getAppConfig() {
    if (_appConfig && Date.now() - _appTs < TTL) return _appConfig;
    try {
        const s = await getDoc(doc(db, "system", "config"));
        _appConfig = s.exists() ? s.data() : {};
        _appTs = Date.now();
    } catch { _appConfig = _appConfig || {}; }
    return _appConfig;
}

export async function getEasySlipKey() {
    return (await getAppConfig()).easyslipApiKey || null;
}

export async function initDiscordLink(id = "discordLink") {
    try {
        const cfg = await getSiteConfig();
        const el  = document.getElementById(id);
        if (el && cfg.discordLink) el.href = cfg.discordLink;
    } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN & THEME MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Theme Management ──────────────────────────────────────────────────────────
/**
 * ดึงการตั้งค่าธีมปัจจุบันจาก Firestore
 * @returns {Object} ข้อมูลธีม (primary, secondary, bgStart, bgMid, logoUrl, siteName)
 */
export async function getTheme() {
    try {
        const snap = await getDoc(doc(db, "system", "theme"));
        if (snap.exists()) {
            _themeConfig = snap.data();
            _themeTs = Date.now();
            return _themeConfig;
        }
    } catch (error) {
        console.error("Error fetching theme:", error);
    }
    // ค่าเริ่มต้นถ้าดึงไม่ได้
    return {
        primary: "#38bdf8",
        secondary: "#818cf8", 
        bgStart: "#e0f2fe",
        bgMid: "#f3e8ff",
        bgEnd: "#f8fafc",
        logoUrl: "",
        siteName: "PanderX",
        customCSS: ""
    };
}

/**
 * บันทึกธีมใหม่ลง Firestore (ใช้ใน Admin Panel)
 * @param {Object} themeData ข้อมูลธีมที่ต้องการบันทึก
 * @returns {Promise<boolean>} สำเร็จหรือไม่
 */
export async function saveTheme(themeData) {
    try {
        await setDoc(doc(db, "system", "theme"), {
            ...themeData,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.uid || null
        }, { merge: true });
        
        // อัพเดต cache ทันที
        _themeConfig = { ..._themeConfig, ...themeData };
        return true;
    } catch (error) {
        console.error("Error saving theme:", error);
        throw error;
    }
}

/**
 * ใช้ธีมกับหน้าเว็บปัจจุบัน (Inject CSS Variables)
 * @param {Object} theme ข้อมูลธีม (ถ้าไม่ใส่จะดึงจาก Firestore อัตโนมัติ)
 */
export async function applyTheme(theme = null) {
    const t = theme || await getTheme();
    
    // อัพเดต CSS Variables
    const root = document.documentElement;
    root.style.setProperty('--primary', t.primary || '#38bdf8');
    root.style.setProperty('--primary-dark', t.primary ? adjustBrightness(t.primary, -20) : '#0ea5e9');
    root.style.setProperty('--secondary', t.secondary || '#818cf8');
    root.style.setProperty('--bg-gradient-start', t.bgStart || '#e0f2fe');
    root.style.setProperty('--bg-gradient-mid', t.bgMid || '#f3e8ff');
    root.style.setProperty('--bg-gradient-end', t.bgEnd || '#f8fafc');
    root.style.setProperty('--text-primary', t.textColor || '#1e293b');
    root.style.setProperty('--glass-bg', t.glassBg || 'rgba(255, 255, 255, 0.8)');
    
    // อัพเดตชื่อเว็บ
    if (t.siteName) {
        document.title = document.title.replace('PanderX', t.siteName);
        const logoTexts = document.querySelectorAll('.site-name, .logo-text');
        logoTexts.forEach(el => el.textContent = t.siteName);
    }
    
    // อัพเดตโลโก้
    if (t.logoUrl) {
        const logos = document.querySelectorAll('.site-logo');
        logos.forEach(el => {
            if (el.tagName === 'IMG') el.src = t.logoUrl;
            else {
                const img = document.createElement('img');
                img.src = t.logoUrl;
                img.className = el.className;
                img.alt = t.siteName || 'Logo';
                img.onerror = () => {
                    // ถ้าโหลดรูปไม่ได้ ให้ใช้ตัวอักษรแทน
                    img.replaceWith(document.createTextNode(t.siteName?.[0] || 'P'));
                };
                el.replaceWith(img);
            }
        });
    }
    
    // Inject Custom CSS ถ้ามี
    if (t.customCSS) {
        let styleEl = document.getElementById('custom-theme-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-theme-css';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = t.customCSS;
    }
    
    return t;
}

/**
 * Subscribe การเปลี่ยนแปลงธีมแบบ Real-time
 * @param {Function} callback ฟังก์ชันที่จะถูกเรียกเมื่อธีมเปลี่ยน
 * @returns {Function} unsubscribe function
 */
export function subscribeTheme(callback) {
    return onSnapshot(doc(db, "system", "theme"), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            _themeConfig = data;
            _themeTs = Date.now();
            if (callback) callback(data);
            // Auto apply ถ้าไม่อยู่ใน admin panel
            if (!window.location.pathname.includes('admin')) {
                applyTheme(data);
            }
        }
    });
}

// ─── Admin Authorization ───────────────────────────────────────────────────────
/**
 * ตรวจสอบว่าผู้ใช้ปัจจุบันเป็น Admin หรือไม่
 * @returns {Promise<boolean>}
 */
export async function isAdmin(user = null) {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return false;
    
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        return snap.exists() && snap.data().isAdmin === true;
    } catch {
        return false;
    }
}

/**
 * ตรวจสอบสิทธิ์ Admin พร้อม Redirect ถ้าไม่ใช่
 * @param {string} redirectUrl หน้าที่จะ redirect ไปถ้าไม่ใช่ admin
 */
export async function requireAdmin(redirectUrl = './index.html') {
    const user = auth.currentUser;
    if (!user || !(await isAdmin(user))) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// ─── System Management ─────────────────────────────────────────────────────────
/**
 * ดึงการตั้งค่าระบบทั้งหมด (Discord, Maintenance, etc.)
 */
export async function getSystemConfig() {
    try {
        const [config, theme] = await Promise.all([
            getDoc(doc(db, "system", "config")),
            getDoc(doc(db, "system", "theme"))
        ]);
        
        return {
            ...(config.exists() ? config.data() : {}),
            theme: theme.exists() ? theme.data() : {}
        };
    } catch (error) {
        console.error("Error fetching system config:", error);
        return {};
    }
}

/**
 * ตรวจสอบโหมด Maintenance
 * @returns {Promise<boolean>} true = ปิดปรับปรุง, false = เปิดใช้งานปกติ
 */
export async function checkMaintenanceMode() {
    try {
        const snap = await getDoc(doc(db, "system", "config"));
        if (snap.exists() && snap.data().maintenanceMode) {
            // ถ้าเป็นแอดมิน ให้ผ่านได้เสมอ
            if (await isAdmin()) return false;
            return true;
        }
    } catch {}
    return false;
}

/**
 * บันทึกการตั้งค่าระบบ (สำหรับ Admin)
 */
export async function saveSystemConfig(data) {
    try {
        await setDoc(doc(db, "system", "config"), {
            ...data,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.uid
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving system config:", error);
        throw error;
    }
}

// ─── Database Management Helpers ───────────────────────────────────────────────
/**
 * ดึงรายชื่อผู้ใช้ทั้งหมด (Admin only)
 */
export async function getAllUsers(limitCount = 50) {
    const q = query(
        collection(db, "users"), 
        orderBy("createdAt", "desc"), 
        limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * อัพเดตสถานะผู้ใช้ (แบน/ปลดแบน)
 */
export async function updateUserStatus(userId, { isBanned, balance, displayName }) {
    const updateData = { updatedAt: serverTimestamp() };
    if (typeof isBanned !== 'undefined') updateData.isBanned = isBanned;
    if (typeof balance !== 'undefined') updateData.balance = balance;
    if (displayName) updateData.displayName = displayName;
    
    await updateDoc(doc(db, "users", userId), updateData);
    return true;
}

/**
 * Subscribe คำสั่งซื้อแบบ Real-time
 */
export function subscribeOrders(callback, limitCount = 20) {
    const q = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
        limit(limitCount)
    );
    return onSnapshot(q, (snap) => {
        const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(orders);
    });
}

// ─── Utility Functions ─────────────────────────────────────────────────────────
/**
 * ปรับความสว่างของสี (สำหรับสร้างสีอ่อน/เข้มจากสีหลัก)
 */
function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

/**
 * ดึงข้อมูลสถิติสำหรับ Dashboard (Admin)
 */
export async function getDashboardStats() {
    try {
        const [usersSnap, ordersSnap, sitesSnap] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "orders")),
            getDocs(collection(db, "websites"))
        ]);
        
        let totalRevenue = 0;
        ordersSnap.forEach(doc => {
            const data = doc.data();
            if (data.amount) totalRevenue += data.amount;
        });
        
        return {
            totalUsers: usersSnap.size,
            totalRevenue,
            totalOrders: ordersSnap.size,
            activeSites: sitesSnap.size,
            timestamp: new Date()
        };
    } catch (error) {
        console.error("Error getting stats:", error);
        return null;
    }
}

// ─── Auto-initialize ───────────────────────────────────────────────────────────
// ตรวจสอบ maintenance mode เมื่อโหลดหน้า (ยกเว้นหน้า admin และ login)
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        const path = window.location.pathname;
        if (!path.includes('admin') && !path.includes('login')) {
            const isMaintenance = await checkMaintenanceMode();
            if (isMaintenance && !path.includes('maintenance')) {
                window.location.href = '/maintenance.html';
            }
            
            // Auto apply theme
            try {
                await applyTheme();
                // Subscribe การเปลี่ยนแปลงธีมแบบ Real-time
                subscribeTheme((theme) => {
                    console.log("Theme updated:", theme);
                });
            } catch (e) {
                console.error("Auto-apply theme failed:", e);
            }
        }
    });
}
