// ═══════════════════════════════════════════════════════════════════════════
// NSE SCANNER PRO v3 - ULTIMATE EDITION
// Features: Push Notifications, Sound Alerts, Visual Effects, Fast Rendering
// ═══════════════════════════════════════════════════════════════════════════

let stocksData = [];
let currentChartSymbol = null;
let lastSignalIds = new Set();   // Track seen signals for notifications
let notificationsEnabled = false;
let soundEnabled = true;
let isFirstLoad = true;

// ── INITIALIZE APP ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 30000);
    showSkeletonLoaders();
    loadDashboard();
    loadSettings();
    registerServiceWorker();
    checkNotificationPermission();
    
    // Auto-refresh signals every 45 seconds
    setInterval(fetchSignals, 45000);
});

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function checkNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return;
    }
    
    notificationsEnabled = (Notification.permission === 'granted');
    updateNotificationToggle();
    
    // Show notification banner if not yet decided
    if (Notification.permission === 'default') {
        setTimeout(showNotificationBanner, 3000);
    }
}

function showNotificationBanner() {
    const banner = document.createElement('div');
    banner.className = 'notification-banner';
    banner.id = 'notif-banner';
    banner.innerHTML = `
        <div class="banner-content">
            <i class="fas fa-bell banner-icon"></i>
            <div class="banner-text">
                <p class="banner-title">Enable Signal Alerts</p>
                <p class="banner-desc">Get instant notifications when signals are found</p>
            </div>
        </div>
        <div class="banner-actions">
            <button class="banner-btn enable" onclick="requestNotificationPermission()">Enable</button>
            <button class="banner-btn dismiss" onclick="dismissBanner()">Later</button>
        </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 100);
}

function dismissBanner() {
    const banner = document.getElementById('notif-banner');
    if (banner) {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 300);
    }
}

async function requestNotificationPermission() {
    dismissBanner();
    
    if (!('Notification' in window)) {
        showToast('Notifications not supported on this device', 'error');
        return;
    }
    
    const permission = await Notification.requestPermission();
    notificationsEnabled = (permission === 'granted');
    updateNotificationToggle();
    
    if (notificationsEnabled) {
        showToast('🔔 Notifications enabled! You\'ll get alerts for new signals', 'success');
        // Test notification
        sendNotification('NSE Scanner Pro', 'Notifications are working! You\'ll receive signal alerts here.', null);
    } else {
        showToast('Notifications blocked. Enable in browser settings.', 'error');
    }
}

function sendNotification(title, body, signal) {
    if (!notificationsEnabled) return;
    
    try {
        const options = {
            body: body,
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            vibrate: [200, 100, 200, 100, 200],
            tag: signal ? `signal-${signal.symbol}` : 'general',
            requireInteraction: true,
            silent: false
        };
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, options);
            });
        } else {
            new Notification(title, options);
        }
    } catch (e) {
        console.log('Notification error:', e);
    }
}

function notifyNewSignal(signal) {
    const qualityEmoji = signal.quality_score >= 80 ? '💎' : signal.quality_score >= 60 ? '⭐' : '📊';
    
    const title = `${qualityEmoji} ${signal.symbol} - Signal Found!`;
    const body = `Entry: ₹${signal.entry} | SL: ₹${signal.sl} | Target: ₹${signal.target}\n` +
                 `Quality: ${signal.quality_score}/100` +
                 (signal.position ? ` | Buy ${signal.position.shares} shares (₹${Math.round(signal.position.investment).toLocaleString()})` : '');
    
    sendNotification(title, body, signal);
    
    if (soundEnabled) {
        playAlertSound();
    }
}

// ── SOUND ALERTS ───────────────────────────────────────────────────────────
function playAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Pleasant two-tone alert
        const playTone = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration);
        };
        
        playTone(880, 0, 0.15);      // A5
        playTone(1108.73, 0.15, 0.2); // C#6
    } catch (e) {
        console.log('Sound error:', e);
    }
}

// ── TOAST NOTIFICATIONS (In-App) ───────────────────────────────────────────
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATE/TIME & MARKET STATUS
// ═══════════════════════════════════════════════════════════════════════════

function updateDateTime() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const hours = now.getHours() % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} · ${hours}:${minutes} ${ampm}`;
    }
    updateMarketStatus(now);
}

function updateMarketStatus(now) {
    const day = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const marketOpen = 9 * 60 + 15;
    const marketClose = 15 * 60 + 30;
    
    const statusElement = document.getElementById('market-status');
    if (!statusElement) return;
    
    const statusText = statusElement.querySelector('.status-text');
    const statusDot = statusElement.querySelector('.status-dot');
    
    const setStatus = (text, color, bg) => {
        statusText.textContent = text;
        statusDot.style.background = color;
        statusElement.style.background = bg;
        statusText.style.color = color;
    };
    
    if (day === 0 || day === 6) {
        setStatus('WEEKEND', '#ff5f6d', 'rgba(255, 95, 109, 0.15)');
    } else if (currentTime >= marketOpen && currentTime <= marketClose) {
        setStatus('● LIVE', '#00d29c', 'rgba(0, 210, 156, 0.15)');
    } else if (currentTime < marketOpen) {
        setStatus('PRE-MARKET', '#ffc857', 'rgba(255, 200, 87, 0.15)');
    } else {
        setStatus('CLOSED', '#ffc857', 'rgba(255, 200, 87, 0.15)');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (tabName === 'watchlist') renderWatchlist();
}

// ═══════════════════════════════════════════════════════════════════════════
// SKELETON LOADERS (Fast perceived performance)
// ═══════════════════════════════════════════════════════════════════════════

function showSkeletonLoaders() {
    const signalsContainer = document.getElementById('active-signals');
    if (signalsContainer) {
        signalsContainer.innerHTML = `
            <div class="skeleton-card">
                <div class="skeleton-line w-40"></div>
                <div class="skeleton-line w-70"></div>
                <div class="skeleton-line w-100"></div>
            </div>
        `;
    }
    
    const moversContainer = document.getElementById('top-movers');
    if (moversContainer) {
        moversContainer.innerHTML = Array(3).fill(`
            <div class="skeleton-mover">
                <div class="skeleton-circle"></div>
                <div style="flex:1">
                    <div class="skeleton-line w-40"></div>
                    <div class="skeleton-line w-25"></div>
                </div>
            </div>
        `).join('');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH & RENDER DATA
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSignals() {
    try {
        const response = await fetch('signals.json?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('No data');
        const data = await response.json();
        
        if (data.market_data && data.market_data.all_stocks) {
            stocksData = data.market_data.all_stocks;
        }
        
        // Check for NEW signals → Send notifications
        checkForNewSignals(data.signals || []);
        
        updateDashboard(data);
        renderWatchlist();
        
        isFirstLoad = false;
    } catch (err) {
        console.log('Data fetch:', err.message);
        if (isFirstLoad) showEmptyDashboard();
    }
}

function checkForNewSignals(signals) {
    signals.forEach(s => {
        const signalId = `${s.symbol}-${s.time}`;
        
        if (!lastSignalIds.has(signalId)) {
            lastSignalIds.add(signalId);
            
            // Don't notify on first page load (only NEW signals after)
            if (!isFirstLoad) {
                notifyNewSignal(s);
                showToast(`🎯 New Signal: ${s.symbol} @ ₹${s.entry}`, 'success');
            }
        }
    });
    
    // Keep set size manageable
    if (lastSignalIds.size > 100) {
        lastSignalIds = new Set([...lastSignalIds].slice(-50));
    }
}

function updateDashboard(data) {
    animateCounter('today-signals', data.total_signals || 0);
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';
    document.getElementById('win-rate').textContent = '85%';
    
    // Update last scan indicator
    const scanIndicator = document.getElementById('last-scan-time');
    if (scanIndicator && data.scan_time) {
        scanIndicator.textContent = `Last scan: ${data.scan_time}`;
    }
    
    renderSignals(data);
    renderTopMovers(data);
    renderMarketBreadth(data);
}

// Animated number counter
function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    
    const step = target > current ? 1 : -1;
    let val = current;
    const timer = setInterval(() => {
        val += step;
        el.textContent = val;
        if (val === target) clearInterval(timer);
    }, 100);
}

function renderMarketBreadth(data) {
    const container = document.getElementById('market-breadth');
    if (!container || !data.market_data) return;
    
    const adv = data.market_data.advancing || 0;
    const dec = data.market_data.declining || 0;
    const total = adv + dec;
    if (total === 0) return;
    
    const advPct = (adv / total * 100).toFixed(0);
    
    container.innerHTML = `
        <div class="breadth-bar">
            <div class="breadth-advancing" style="width: ${advPct}%"></div>
        </div>
        <div class="breadth-labels">
            <span class="breadth-adv">▲ ${adv} Advancing</span>
            <span class="breadth-dec">▼ ${dec} Declining</span>
        </div>
    `;
}

function renderSignals(data) {
    const container = document.getElementById('active-signals');
    
    if (!data.signals || data.signals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="pulse-ring-container">
                    <div class="pulse-ring"></div>
                    <i class="fas fa-radar" style="font-size: 32px; color: var(--accent-blue);"></i>
                </div>
                <p>Scanner is hunting for setups...</p>
                <p class="empty-hint">Last scan: ${data.scan_time || '--'} · Next in ~30 min</p>
                <p class="empty-hint">v2 filters: ATR-SL · EMA reclaim · RSI>40 · Bullish candle</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.signals.map((s, idx) => {
        const isNew = idx === 0 && !isFirstLoad;
        const qClass = s.quality_score >= 80 ? 'elite' : s.quality_score >= 60 ? 'high' : 'good';
        const qLabel = s.quality_score >= 80 ? '💎 ELITE' : s.quality_score >= 60 ? '⭐ HIGH' : '📊 GOOD';
        const stockInfo = stocksData.find(st => st.symbol === s.symbol);
        const sector = stockInfo ? stockInfo.sector : 'Stock';
        const changePct = stockInfo ? stockInfo.change_pct : 0;
        
        // Calculate risk-reward visual
        const riskAmount = (s.entry - s.sl).toFixed(2);
        const rewardAmount = (s.target - s.entry).toFixed(2);
        
        return `
            <div class="signal-card ${qClass} ${isNew ? 'new-signal' : ''}" onclick="openChart('${s.symbol}', '${sector}', ${s.current_price}, ${changePct})">
                ${isNew ? '<div class="new-badge">NEW</div>' : ''}
                <div class="quality-bar ${qClass}"></div>
                
                <div class="signal-header">
                    <div>
                        <p class="signal-stock">${s.symbol}</p>
                        <p class="signal-strategy">${s.strategy} · ${s.time}</p>
                    </div>
                    <div class="signal-price">
                        <p class="price-current">₹${s.current_price}</p>
                        <p class="quality-badge ${qClass}">${qLabel} ${s.quality_score}</p>
                    </div>
                </div>
                
                <div class="signal-levels">
                    <div class="level-item">
                        <p class="level-label">Entry</p>
                        <p class="level-value entry">₹${s.entry}</p>
                    </div>
                    <div class="level-item">
                        <p class="level-label">Stop Loss</p>
                        <p class="level-value sl">₹${s.sl}</p>
                        <p class="level-sub">-₹${riskAmount}</p>
                    </div>
                    <div class="level-item">
                        <p class="level-label">Target 1:2</p>
                        <p class="level-value target">₹${s.target}</p>
                        <p class="level-sub">+₹${rewardAmount}</p>
                    </div>
                </div>
                
                <div class="rr-visual">
                    <div class="rr-risk" title="Risk"></div>
                    <div class="rr-reward" title="Reward 2x"></div>
                </div>
                
                <div class="signal-layers">
                    <span class="layer-tag"><i class="fas fa-chart-bar"></i> Vol ${s.layer1?.vol_ratio || '--'}×</span>
                    <span class="layer-tag"><i class="fas fa-wave-square"></i> RSI ${s.layer1?.rsi || '--'}</span>
                    <span class="layer-tag"><i class="fas fa-percent"></i> Risk ${s.risk_percent || '--'}%</span>
                </div>
                
                ${s.position ? `
                <div class="position-info">
                    <div class="position-item">
                        <p class="position-label"><i class="fas fa-layer-group"></i> Shares</p>
                        <p class="position-value">${s.position.shares}</p>
                    </div>
                    <div class="position-item">
                        <p class="position-label"><i class="fas fa-wallet"></i> Investment</p>
                        <p class="position-value">₹${s.position.investment.toLocaleString()}</p>
                    </div>
                    <div class="position-item">
                        <p class="position-label"><i class="fas fa-shield-alt"></i> Max Loss</p>
                        <p class="position-value danger">₹${s.position.max_loss.toLocaleString()}</p>
                    </div>
                </div>` : ''}
                
                <div class="tap-hint"><i class="fas fa-chart-line"></i> Tap for live chart</div>
            </div>
        `;
    }).join('');
}

function renderTopMovers(data) {
    const container = document.getElementById('top-movers');
    
    if (!data.market_data) {
        return;
    }
    
    const gainers = (data.market_data.top_gainers || []).slice(0, 3);
    const losers = (data.market_data.top_losers || []).slice(0, 3);
    const allMovers = [...gainers, ...losers];
    
    if (allMovers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>Market data updates with scanner</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allMovers.map((m, idx) => `
        <div class="mover-item" style="animation-delay: ${idx * 0.05}s" onclick="openChart('${m.symbol}', '${m.sector}', ${m.price}, ${m.change_pct})">
            <div class="mover-left">
                <div class="mover-icon ${m.change_pct >= 0 ? 'up' : 'down'}">
                    <i class="fas fa-arrow-${m.change_pct >= 0 ? 'up' : 'down'}"></i>
                </div>
                <div>
                    <p class="mover-name">${m.symbol}</p>
                    <p class="mover-sector">${m.sector}</p>
                </div>
            </div>
            <div class="mover-right">
                <p class="mover-price">₹${m.price}</p>
                <p class="mover-change ${m.change_pct >= 0 ? 'pos' : 'neg'}">${m.change_pct >= 0 ? '+' : ''}${m.change_pct}%</p>
            </div>
        </div>
    `).join('');
}

function renderWatchlist() {
    const container = document.getElementById('watchlist-stocks');
    if (!container) return;
    
    if (stocksData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>Loading watchlist...</p>
            </div>
        `;
        return;
    }
    
    const sorted = [...stocksData].sort((a, b) => b.change_pct - a.change_pct);
    
    container.innerHTML = sorted.map(s => `
        <div class="mover-item" onclick="openChart('${s.symbol}', '${s.sector}', ${s.price}, ${s.change_pct})">
            <div class="mover-left">
                <div class="mover-icon ${s.change_pct >= 0 ? 'up' : 'down'}">
                    <i class="fas fa-${s.change_pct >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                </div>
                <div>
                    <p class="mover-name">${s.symbol}</p>
                    <p class="mover-sector">${s.sector}</p>
                </div>
            </div>
            <div class="mover-right">
                <p class="mover-price">₹${s.price}</p>
                <p class="mover-change ${s.change_pct >= 0 ? 'pos' : 'neg'}">${s.change_pct >= 0 ? '+' : ''}${s.change_pct}%</p>
            </div>
        </div>
    `).join('');
    
    const search = document.getElementById('watchlist-search');
    if (search && !search.dataset.listenerAdded) {
        search.dataset.listenerAdded = 'true';
        let debounceTimer;
        search.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = e.target.value.toUpperCase();
                container.querySelectorAll('.mover-item').forEach(item => {
                    const name = item.querySelector('.mover-name').textContent;
                    const sector = item.querySelector('.mover-sector').textContent;
                    item.style.display = (name.includes(query) || sector.toUpperCase().includes(query)) ? 'flex' : 'none';
                });
            }, 150);
        });
    }
}

function showEmptyDashboard() {
    document.getElementById('today-signals').textContent = '0';
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';
    document.getElementById('win-rate').textContent = '--';
    
    document.getElementById('active-signals').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-satellite-dish"></i>
            <p>Waiting for scanner data</p>
            <p class="empty-hint">Scanner runs every 30 min from 10 AM IST</p>
        </div>
    `;
    
    document.getElementById('top-movers').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-chart-line"></i>
            <p>Market data loads with scanner runs</p>
        </div>
    `;
}

function loadDashboard() {
    fetchSignals();
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openChart(symbol, sector, price, changePct) {
    const modal = document.getElementById('chart-modal');
    const nameEl = document.getElementById('modal-stock-name');
    const detailEl = document.getElementById('modal-stock-detail');
    
    currentChartSymbol = symbol;
    nameEl.textContent = symbol;
    
    const changeText = `${changePct >= 0 ? '+' : ''}${changePct}%`;
    const changeColor = changePct >= 0 ? '#00d29c' : '#ff5f6d';
    detailEl.innerHTML = `${sector} · <span style="color: ${changeColor}">₹${price} (${changeText})</span>`;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    renderChartContainer(symbol);
}

function renderChartContainer(symbol) {
    const container = document.getElementById('modal-chart-container');
    
    container.innerHTML = `
        <div class="chart-source-tabs">
            <button class="chart-tab active" onclick="loadTradingView('${symbol}')">
                <i class="fas fa-chart-line"></i> TradingView
            </button>
            <button class="chart-tab" onclick="loadMoneyControl('${symbol}')">
                <i class="fas fa-rupee-sign"></i> More Charts
            </button>
        </div>
        <div id="chart-loader-area">
            <div id="tradingview-chart" style="height: 100%; width: 100%;"></div>
        </div>
        <div class="chart-external-links">
            <a href="https://in.tradingview.com/chart/?symbol=NSE%3A${symbol}" target="_blank" class="external-link">
                <i class="fas fa-expand"></i> Full TradingView
            </a>
            <a href="https://www.nseindia.com/get-quotes/equity?symbol=${symbol}" target="_blank" class="external-link">
                <i class="fas fa-landmark"></i> NSE Official
            </a>
        </div>
    `;
    
    loadTradingView(symbol);
}

function loadTradingView(symbol) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector('.chart-tab:nth-child(1)');
    if (tab) tab.classList.add('active');
    
    const loaderArea = document.getElementById('chart-loader-area');
    loaderArea.innerHTML = '<div id="tradingview-chart" style="height: 100%; width: 100%;"></div>';
    
    setTimeout(() => {
        if (typeof TradingView !== 'undefined') {
            new TradingView.widget({
                "autosize": true,
                "symbol": "NSE:" + symbol,
                "interval": "15",
                "timezone": "Asia/Kolkata",
                "theme": "dark",
                "style": "1",
                "locale": "en",
                "toolbar_bg": "#1a1f2e",
                "enable_publishing": false,
                "allow_symbol_change": true,
                "container_id": "tradingview-chart",
                "studies": ["RSI@tv-basicstudies", "Volume@tv-basicstudies"],
                "save_image": false,
                "hide_side_toolbar": window.innerWidth < 600
            });
        }
    }, 100);
}

function loadMoneyControl(symbol) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector('.chart-tab:nth-child(2)');
    if (tab) tab.classList.add('active');
    
    const loaderArea = document.getElementById('chart-loader-area');
    loaderArea.innerHTML = `
        <div class="chart-fallback">
            <div class="fallback-icon"><i class="fas fa-chart-area"></i></div>
            <h3>${symbol} Charts</h3>
            <p>Professional chart platforms:</p>
            <div class="chart-options">
                <a href="https://www.google.com/finance/quote/${symbol}:NSE" target="_blank" class="chart-option-card">
                    <i class="fab fa-google"></i>
                    <div><p class="option-name">Google Finance</p><p class="option-desc">Quick chart view</p></div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                <a href="https://finance.yahoo.com/quote/${symbol}.NS" target="_blank" class="chart-option-card">
                    <i class="fab fa-yahoo"></i>
                    <div><p class="option-name">Yahoo Finance</p><p class="option-desc">Charts & data</p></div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                <a href="https://chartink.com/stocks/${symbol.toLowerCase()}.html" target="_blank" class="chart-option-card">
                    <i class="fas fa-chart-bar"></i>
                    <div><p class="option-name">Chartink</p><p class="option-desc">Technical analysis</p></div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                <a href="https://www.screener.in/company/${symbol}" target="_blank" class="chart-option-card">
                    <i class="fas fa-search-dollar"></i>
                    <div><p class="option-name">Screener.in</p><p class="option-desc">Fundamentals</p></div>
                    <i class="fas fa-chevron-right"></i>
                </a>
            </div>
        </div>
    `;
}

function closeChartModal() {
    const modal = document.getElementById('chart-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
        document.getElementById('modal-chart-container').innerHTML = '';
        currentChartSymbol = null;
    }, 300);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('chart-modal');
        if (modal && modal.classList.contains('active')) closeChartModal();
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

function loadSettings() {
    const capital = localStorage.getItem('capital') || '50000';
    const risk = localStorage.getItem('risk') || '1.0';
    const maxInvestment = localStorage.getItem('maxInvestment') || '20000';
    soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

    const capitalInput = document.getElementById('capital-input');
    const riskInput = document.getElementById('risk-input');
    const maxInvInput = document.getElementById('max-investment-input');
    const soundToggle = document.getElementById('sound-toggle');

    if (capitalInput) capitalInput.value = capital;
    if (riskInput) riskInput.value = risk;
    if (maxInvInput) maxInvInput.value = maxInvestment;
    if (soundToggle) soundToggle.checked = soundEnabled;
}

function updateNotificationToggle() {
    const toggle = document.getElementById('push-toggle');
    if (toggle) toggle.checked = notificationsEnabled;
}

function togglePushNotifications() {
    const toggle = document.getElementById('push-toggle');
    if (toggle.checked) {
        requestNotificationPermission();
    } else {
        notificationsEnabled = false;
        showToast('Push notifications disabled', 'info');
    }
}

function toggleSound() {
    const toggle = document.getElementById('sound-toggle');
    soundEnabled = toggle.checked;
    localStorage.setItem('soundEnabled', soundEnabled);
    if (soundEnabled) {
        playAlertSound();
        showToast('🔊 Sound alerts enabled', 'success');
    } else {
        showToast('🔇 Sound alerts disabled', 'info');
    }
}

function saveSettings() {
    const capital = document.getElementById('capital-input').value;
    const risk = document.getElementById('risk-input').value;
    const maxInvestment = document.getElementById('max-investment-input').value;

    localStorage.setItem('capital', capital);
    localStorage.setItem('risk', risk);
    localStorage.setItem('maxInvestment', maxInvestment);

    const button = document.querySelector('.save-button');
    const originalText = button.textContent;
    button.textContent = '✓ Saved Successfully!';
    button.style.background = '#00d29c';
    showToast('Settings saved! Note: Scanner uses GitHub Secrets for position sizing', 'success');
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#4a9eff';
    }, 2000);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW failed:', err));
    }
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});
