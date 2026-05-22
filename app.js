// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 60000);
    loadDashboard();
    loadSettings();
    registerServiceWorker();
    setInterval(fetchSignals, 60000);
});

let stocksData = [];
let currentChartSymbol = null;

function updateDateTime() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = now.getHours() % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = `${day}, ${date} ${month} ${year} · ${hours}:${minutes} ${ampm}`;
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
    
    if (day === 0 || day === 6) {
        statusText.textContent = 'CLOSED';
        statusDot.style.background = '#ff5f6d';
        statusElement.style.background = 'rgba(255, 95, 109, 0.15)';
        statusText.style.color = '#ff5f6d';
    } else if (currentTime >= marketOpen && currentTime <= marketClose) {
        statusText.textContent = 'LIVE';
        statusDot.style.background = '#00d29c';
        statusElement.style.background = 'rgba(0, 210, 156, 0.15)';
        statusText.style.color = '#00d29c';
    } else {
        statusText.textContent = 'CLOSED';
        statusDot.style.background = '#ffc857';
        statusElement.style.background = 'rgba(255, 200, 87, 0.15)';
        statusText.style.color = '#ffc857';
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    window.scrollTo(0, 0);
    
    if (tabName === 'watchlist') {
        renderWatchlist();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART MODAL - WITH MULTIPLE CHART SOURCES
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
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Render the chart container with chart source buttons
    renderChartContainer(symbol, price, changePct, sector);
}

function renderChartContainer(symbol, price, changePct, sector) {
    const container = document.getElementById('modal-chart-container');
    
    // Build chart with multiple source options
    container.innerHTML = `
        <div class="chart-source-tabs">
            <button class="chart-tab active" onclick="loadTradingView('${symbol}')">
                <i class="fas fa-chart-line"></i> TradingView
            </button>
            <button class="chart-tab" onclick="loadMoneyControl('${symbol}')">
                <i class="fas fa-rupee-sign"></i> MoneyControl
            </button>
            <button class="chart-tab" onclick="loadInvesting('${symbol}')">
                <i class="fas fa-globe"></i> Investing
            </button>
        </div>
        <div id="chart-loader-area">
            <div id="tradingview-chart" style="height: 100%; width: 100%;"></div>
        </div>
        <div class="chart-external-links">
            <a href="https://www.tradingview.com/symbols/NSE-${symbol}/" target="_blank" class="external-link">
                <i class="fas fa-external-link-alt"></i> Open Full Chart on TradingView
            </a>
            <a href="https://in.tradingview.com/chart/?symbol=NSE%3A${symbol}" target="_blank" class="external-link">
                <i class="fas fa-expand"></i> TradingView Advanced View
            </a>
        </div>
    `;
    
    // Load TradingView by default
    loadTradingView(symbol);
}

function loadTradingView(symbol) {
    // Mark this tab as active
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.chart-tab:nth-child(1)').classList.add('active');
    
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
                "studies": [
                    "RSI@tv-basicstudies",
                    "Volume@tv-basicstudies"
                ],
                "save_image": false,
                "hide_side_toolbar": false,
                "details": false
            });
        }
    }, 100);
}

function loadMoneyControl(symbol) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.chart-tab:nth-child(2)').classList.add('active');
    
    const loaderArea = document.getElementById('chart-loader-area');
    loaderArea.innerHTML = `
        <div class="chart-fallback">
            <div class="fallback-icon">
                <i class="fas fa-chart-area"></i>
            </div>
            <h3>${symbol} - Chart View</h3>
            <p>View detailed charts on these professional platforms:</p>
            
            <div class="chart-options">
                <a href="https://www.moneycontrol.com/stockpricequote/${symbol}" target="_blank" class="chart-option-card">
                    <i class="fas fa-rupee-sign"></i>
                    <div>
                        <p class="option-name">MoneyControl</p>
                        <p class="option-desc">Indian stock charts</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                
                <a href="https://chartink.com/stocks/${symbol.toLowerCase()}.html" target="_blank" class="chart-option-card">
                    <i class="fas fa-chart-bar"></i>
                    <div>
                        <p class="option-name">Chartink</p>
                        <p class="option-desc">Technical analysis</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                
                <a href="https://www.nseindia.com/get-quotes/equity?symbol=${symbol}" target="_blank" class="chart-option-card">
                    <i class="fas fa-landmark"></i>
                    <div>
                        <p class="option-name">NSE India Official</p>
                        <p class="option-desc">Real-time data</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                
                <a href="https://in.tradingview.com/chart/?symbol=NSE%3A${symbol}" target="_blank" class="chart-option-card">
                    <i class="fas fa-chart-line"></i>
                    <div>
                        <p class="option-name">TradingView Full</p>
                        <p class="option-desc">Advanced charts</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
            </div>
        </div>
    `;
}

function loadInvesting(symbol) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.chart-tab:nth-child(3)').classList.add('active');
    
    const loaderArea = document.getElementById('chart-loader-area');
    loaderArea.innerHTML = `
        <div class="chart-fallback">
            <div class="fallback-icon">
                <i class="fas fa-globe"></i>
            </div>
            <h3>${symbol} - International View</h3>
            <p>View on these global platforms:</p>
            
            <div class="chart-options">
                <a href="https://www.investing.com/search/?q=${symbol}+NSE" target="_blank" class="chart-option-card">
                    <i class="fas fa-globe"></i>
                    <div>
                        <p class="option-name">Investing.com</p>
                        <p class="option-desc">Global financial data</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                
                <a href="https://finance.yahoo.com/quote/${symbol}.NS" target="_blank" class="chart-option-card">
                    <i class="fab fa-yahoo"></i>
                    <div>
                        <p class="option-name">Yahoo Finance</p>
                        <p class="option-desc">Charts & analysis</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                
                <a href="https://www.google.com/finance/quote/${symbol}:NSE" target="_blank" class="chart-option-card">
                    <i class="fab fa-google"></i>
                    <div>
                        <p class="option-name">Google Finance</p>
                        <p class="option-desc">Quick overview</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </a>
                
                <a href="https://www.screener.in/company/${symbol}" target="_blank" class="chart-option-card">
                    <i class="fas fa-search-dollar"></i>
                    <div>
                        <p class="option-name">Screener.in</p>
                        <p class="option-desc">Fundamentals</p>
                    </div>
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
        if (modal && modal.classList.contains('active')) {
            closeChartModal();
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS & DATA
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSignals() {
    try {
        const response = await fetch('signals.json?t=' + Date.now());
        if (!response.ok) throw new Error('No data yet');
        const data = await response.json();
        
        if (data.market_data && data.market_data.all_stocks) {
            stocksData = data.market_data.all_stocks;
        }
        
        updateDashboard(data);
        renderWatchlist();
    } catch (err) {
        console.log('Waiting for data...', err.message);
        showEmptyDashboard();
    }
}

function updateDashboard(data) {
    document.getElementById('today-signals').textContent = data.total_signals || 0;
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';
    document.getElementById('win-rate').textContent = '75%';
    
    renderSignals(data);
    renderTopMovers(data);
}

function renderSignals(data) {
    const container = document.getElementById('active-signals');
    
    if (!data.signals || data.signals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No active signals yet</p>
                <p class="empty-hint">Last scan: ${data.scan_time || '--'}</p>
                <p class="empty-hint" style="margin-top: 4px;">Next scan in ~30 minutes</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.signals.map(s => {
        const qe = s.quality_score >= 80 ? '💎 ELITE' : s.quality_score >= 60 ? '⭐ HIGH' : '📊 GOOD';
        const stockInfo = stocksData.find(st => st.symbol === s.symbol);
        const sector = stockInfo ? stockInfo.sector : 'Stock';
        const changePct = stockInfo ? stockInfo.change_pct : 0;
        
        return `
            <div class="signal-card" onclick="openChart('${s.symbol}', '${sector}', ${s.current_price}, ${changePct})">
                <div class="signal-header">
                    <div>
                        <p class="signal-stock">${s.symbol}</p>
                        <p class="signal-strategy">${s.strategy} · ${s.time}</p>
                    </div>
                    <div class="signal-price">
                        <p class="price-current">₹${s.current_price}</p>
                        <p class="price-change up">${qe}</p>
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
                    </div>
                    <div class="level-item">
                        <p class="level-label">Target</p>
                        <p class="level-value target">₹${s.target}</p>
                    </div>
                </div>
                <div class="signal-layers">
                    <span class="layer-tag">Vol ${s.layer1?.vol_ratio || '--'}×</span>
                    <span class="layer-tag">RSI ${s.layer1?.rsi || '--'}</span>
                    <span class="layer-tag">Q-${s.quality_score}</span>
                </div>
                ${s.position ? `
                <div class="position-info">
                    <div class="position-item">
                        <p class="position-label">Shares</p>
                        <p class="position-value">${s.position.shares}</p>
                    </div>
                    <div class="position-item">
                        <p class="position-label">Investment</p>
                        <p class="position-value">₹${s.position.investment.toLocaleString()}</p>
                    </div>
                </div>` : ''}
            </div>
        `;
    }).join('');
}

function renderTopMovers(data) {
    const container = document.getElementById('top-movers');
    
    if (!data.market_data) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>Market data loading...</p>
            </div>
        `;
        return;
    }
    
    const gainers = (data.market_data.top_gainers || []).slice(0, 3);
    const losers = (data.market_data.top_losers || []).slice(0, 3);
    const allMovers = [...gainers, ...losers];
    
    if (allMovers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>No market data yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allMovers.map(m => `
        <div class="mover-item" onclick="openChart('${m.symbol}', '${m.sector}', ${m.price}, ${m.change_pct})">
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
                <p class="mover-change" style="color: ${m.change_pct >= 0 ? '#00d29c' : '#ff5f6d'}">${m.change_pct >= 0 ? '+' : ''}${m.change_pct}%</p>
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
                <p class="empty-hint">Prices update every 30 min</p>
            </div>
        `;
        return;
    }
    
    const sorted = [...stocksData].sort((a, b) => a.symbol.localeCompare(b.symbol));
    
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
                <p class="mover-change" style="color: ${s.change_pct >= 0 ? '#00d29c' : '#ff5f6d'}">${s.change_pct >= 0 ? '+' : ''}${s.change_pct}%</p>
            </div>
        </div>
    `).join('');
    
    const search = document.getElementById('watchlist-search');
    if (search && !search.dataset.listenerAdded) {
        search.dataset.listenerAdded = 'true';
        search.addEventListener('input', (e) => {
            const query = e.target.value.toUpperCase();
            const items = container.querySelectorAll('.mover-item');
            items.forEach(item => {
                const name = item.querySelector('.mover-name').textContent;
                const sector = item.querySelector('.mover-sector').textContent;
                if (name.includes(query) || sector.toUpperCase().includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
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
            <i class="fas fa-bell-slash"></i>
            <p>Waiting for scanner data</p>
            <p class="empty-hint">Scanner runs every 30 min from 10 AM</p>
        </div>
    `;
    
    document.getElementById('top-movers').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-chart-line"></i>
            <p>Loading market data...</p>
        </div>
    `;
}

function loadDashboard() {
    fetchSignals();
}

function loadSettings() {
    const capital = localStorage.getItem('capital') || '50000';
    const risk = localStorage.getItem('risk') || '1.0';
    const maxInvestment = localStorage.getItem('maxInvestment') || '20000';

    const capitalInput = document.getElementById('capital-input');
    const riskInput = document.getElementById('risk-input');
    const maxInvInput = document.getElementById('max-investment-input');

    if (capitalInput) capitalInput.value = capital;
    if (riskInput) riskInput.value = risk;
    if (maxInvInput) maxInvInput.value = maxInvestment;
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
    button.textContent = '✓ Saved!';
    button.style.background = '#00d29c';
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
