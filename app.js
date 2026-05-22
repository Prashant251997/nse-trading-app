// Stock list
const STOCKS_BELOW_100 = [
    { symbol: "YESBANK", sector: "Banking" }, { symbol: "IDFCFIRSTB", sector: "Banking" },
    { symbol: "IDBI", sector: "Banking" }, { symbol: "PNB", sector: "Banking" },
    { symbol: "UNIONBANK", sector: "Banking" }, { symbol: "IOB", sector: "Banking" },
    { symbol: "CENTRALBK", sector: "Banking" }, { symbol: "UCOBANK", sector: "Banking" },
    { symbol: "MAHABANK", sector: "Banking" }, { symbol: "BANKINDIA", sector: "Banking" },
    { symbol: "INDIANB", sector: "Banking" }, { symbol: "PSB", sector: "Banking" },
    { symbol: "UJJIVANSFB", sector: "Banking" }, { symbol: "SOUTHBANK", sector: "Banking" },
    { symbol: "DCBBANK", sector: "Banking" }, { symbol: "SUZLON", sector: "Energy" },
    { symbol: "NHPC", sector: "Energy" }, { symbol: "SJVN", sector: "Energy" },
    { symbol: "BHEL", sector: "Energy" }, { symbol: "RPOWER", sector: "Energy" },
    { symbol: "JPPOWER", sector: "Energy" }, { symbol: "IRFC", sector: "Energy" },
    { symbol: "IDEA", sector: "Telecom" }, { symbol: "HFCL", sector: "Telecom" },
    { symbol: "ITI", sector: "Telecom" }, { symbol: "NBCC", sector: "Infrastructure" },
    { symbol: "IRCON", sector: "Infrastructure" }, { symbol: "RVNL", sector: "Infrastructure" },
    { symbol: "GMRINFRA", sector: "Infrastructure" }, { symbol: "HUDCO", sector: "Infrastructure" },
    { symbol: "MOREPENLAB", sector: "Pharma" }, { symbol: "GLENMARK", sector: "Pharma" },
    { symbol: "SAIL", sector: "Metals" }, { symbol: "JINDALSTEL", sector: "Metals" },
    { symbol: "ASHOKLEY", sector: "Auto" }, { symbol: "TATAMOTORS", sector: "Auto" },
    { symbol: "JKTYRE", sector: "Auto" }, { symbol: "APOLLOTYRE", sector: "Auto" },
    { symbol: "PAYTM", sector: "IT" }, { symbol: "ZOMATO", sector: "IT" },
    { symbol: "TRIDENT", sector: "Textile" }, { symbol: "ALOKINDS", sector: "Textile" },
    { symbol: "MOIL", sector: "Mining" }
];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 60000);
    loadDashboard();
    loadWatchlist();
    loadSettings();
    registerServiceWorker();
    
    // Auto-refresh signals every 60 seconds
    setInterval(fetchSignals, 60000);
});

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
}

// ── FETCH REAL SIGNALS FROM signals.json ──────────────────────────────────────
async function fetchSignals() {
    try {
        // Add cache-busting timestamp
        const response = await fetch('signals.json?t=' + Date.now());
        if (!response.ok) throw new Error('No signals.json yet');
        const data = await response.json();
        updateDashboardWithRealData(data);
    } catch (err) {
        console.log('Waiting for scanner data...', err.message);
        showEmptyState();
    }
}

function updateDashboardWithRealData(data) {
    // Update stats
    document.getElementById('today-signals').textContent = data.total_signals || 0;
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';
    document.getElementById('win-rate').textContent = '75%';

    const signalsContainer = document.getElementById('active-signals');
    
    if (!data.signals || data.signals.length === 0) {
        signalsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No active signals yet</p>
                <p class="empty-hint">Last scan: ${data.scan_time || '--'}</p>
                <p class="empty-hint" style="margin-top: 4px;">Next scan in ~30 minutes</p>
            </div>
        `;
        return;
    }
    
    signalsContainer.innerHTML = data.signals.map(s => {
        const qualityBadge = s.quality_score >= 80 ? '💎 ELITE' : 
                            s.quality_score >= 60 ? '⭐ HIGH' : '📊 GOOD';
        
        return `
            <div class="signal-card">
                <div class="signal-header">
                    <div>
                        <p class="signal-stock">${s.symbol}</p>
                        <p class="signal-strategy">${s.strategy} · ${s.time}</p>
                    </div>
                    <div class="signal-price">
                        <p class="price-current">₹${s.current_price}</p>
                        <p class="price-change up">${qualityBadge}</p>
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
                    <span class="layer-tag">Q-Score ${s.quality_score}</span>
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

function showEmptyState() {
    document.getElementById('today-signals').textContent = '0';
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';
    document.getElementById('win-rate').textContent = '--';
    
    const signalsContainer = document.getElementById('active-signals');
    signalsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <p>Waiting for scanner data</p>
            <p class="empty-hint">Scanner runs every 30 min from 10 AM - 2:30 PM IST</p>
            <p class="empty-hint" style="margin-top: 8px;">App refreshes automatically</p>
        </div>
    `;
    
    const moversContainer = document.getElementById('top-movers');
    moversContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-chart-line"></i>
            <p>Market data will appear here</p>
            <p class="empty-hint">After scanner runs</p>
        </div>
    `;
}

function loadDashboard() {
    fetchSignals(); // Fetch on load
}

function loadWatchlist() {
    const container = document.getElementById('watchlist-stocks');
    container.innerHTML = STOCKS_BELOW_100.map(s => `
        <div class="mover-item">
            <div class="mover-left">
                <div class="mover-icon up">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div>
                    <p class="mover-name">${s.symbol}</p>
                    <p class="mover-sector">${s.sector}</p>
                </div>
            </div>
            <div class="mover-right">
                <p class="mover-price">--</p>
                <p class="mover-change" style="color: #6b7383;">Live</p>
            </div>
        </div>
    `).join('');

    const search = document.getElementById('watchlist-search');
    if (search) {
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
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW failed:', err));
    }
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});
