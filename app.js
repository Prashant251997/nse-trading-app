// Stock list (matches your scanner)
const STOCKS_BELOW_100 = [
    { symbol: "YESBANK", sector: "Banking" },
    { symbol: "IDFCFIRSTB", sector: "Banking" },
    { symbol: "IDBI", sector: "Banking" },
    { symbol: "PNB", sector: "Banking" },
    { symbol: "UNIONBANK", sector: "Banking" },
    { symbol: "IOB", sector: "Banking" },
    { symbol: "CENTRALBK", sector: "Banking" },
    { symbol: "UCOBANK", sector: "Banking" },
    { symbol: "MAHABANK", sector: "Banking" },
    { symbol: "BANKINDIA", sector: "Banking" },
    { symbol: "INDIANB", sector: "Banking" },
    { symbol: "PSB", sector: "Banking" },
    { symbol: "UJJIVANSFB", sector: "Banking" },
    { symbol: "SOUTHBANK", sector: "Banking" },
    { symbol: "DCBBANK", sector: "Banking" },
    { symbol: "SUZLON", sector: "Energy" },
    { symbol: "NHPC", sector: "Energy" },
    { symbol: "SJVN", sector: "Energy" },
    { symbol: "BHEL", sector: "Energy" },
    { symbol: "RPOWER", sector: "Energy" },
    { symbol: "JPPOWER", sector: "Energy" },
    { symbol: "IRFC", sector: "Energy" },
    { symbol: "RTNINDIA", sector: "Energy" },
    { symbol: "GVKPIL", sector: "Energy" },
    { symbol: "ADANIPOWER", sector: "Energy" },
    { symbol: "IDEA", sector: "Telecom" },
    { symbol: "HFCL", sector: "Telecom" },
    { symbol: "ITI", sector: "Telecom" },
    { symbol: "TVTODAY", sector: "Telecom" },
    { symbol: "DBCORP", sector: "Telecom" },
    { symbol: "NBCC", sector: "Infrastructure" },
    { symbol: "IRCON", sector: "Infrastructure" },
    { symbol: "RVNL", sector: "Infrastructure" },
    { symbol: "GMRINFRA", sector: "Infrastructure" },
    { symbol: "HUDCO", sector: "Infrastructure" },
    { symbol: "MOREPENLAB", sector: "Pharma" },
    { symbol: "GLENMARK", sector: "Pharma" },
    { symbol: "AUROPHARMA", sector: "Pharma" },
    { symbol: "SAIL", sector: "Metals" },
    { symbol: "JINDALSTEL", sector: "Metals" },
    { symbol: "ASHOKLEY", sector: "Auto" },
    { symbol: "TATAMOTORS", sector: "Auto" },
    { symbol: "JKTYRE", sector: "Auto" },
    { symbol: "APOLLOTYRE", sector: "Auto" },
    { symbol: "PAYTM", sector: "IT" },
    { symbol: "ZOMATO", sector: "IT" },
    { symbol: "TRIDENT", sector: "Textile" },
    { symbol: "ALOKINDS", sector: "Textile" },
    { symbol: "MOIL", sector: "Mining" },
];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 60000);
    loadDashboard();
    loadWatchlist();
    loadSettings();
    registerServiceWorker();
});

// Update date and time
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
    
    // Update market status
    updateMarketStatus(now);
}

// Update market status (open/closed)
function updateMarketStatus(now) {
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15;  // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    
    const statusElement = document.getElementById('market-status');
    if (!statusElement) return;
    
    const statusText = statusElement.querySelector('.status-text');
    const statusDot = statusElement.querySelector('.status-dot');
    
    if (day === 0 || day === 6) {
        // Weekend
        statusText.textContent = 'CLOSED';
        statusDot.style.background = '#ff5f6d';
        statusElement.style.background = 'rgba(255, 95, 109, 0.15)';
        statusText.style.color = '#ff5f6d';
    } else if (currentTime >= marketOpen && currentTime <= marketClose) {
        // Market open
        statusText.textContent = 'LIVE';
        statusDot.style.background = '#00d29c';
        statusElement.style.background = 'rgba(0, 210, 156, 0.15)';
        statusText.style.color = '#00d29c';
    } else {
        // Market closed
        statusText.textContent = 'CLOSED';
        statusDot.style.background = '#ffc857';
        statusElement.style.background = 'rgba(255, 200, 87, 0.15)';
        statusText.style.color = '#ffc857';
    }
}

// Tab switching
function switchTab(tabName) {
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Load dashboard with demo data
function loadDashboard() {
    // Demo data - will be replaced with real data from Telegram/GitHub
    const demoSignals = [
        {
            symbol: "SUZLON",
            strategy: "Triple-Layer",
            time: "10:30 AM",
            current_price: 53.42,
            change: 0.85,
            entry: 53.42,
            sl: 52.50,
            target: 55.26,
            layers: ["Vol 2.1×", "D+0.4%", "Fib 50%"],
            shares: 543,
            investment: 29007
        }
    ];

    const demoMovers = [
        { symbol: "SUZLON", sector: "Energy", price: 53.42, change: 3.45 },
        { symbol: "IDBI", sector: "Banking", price: 92.10, change: 2.10 },
        { symbol: "NHPC", sector: "Energy", price: 84.50, change: 1.85 },
        { symbol: "PNB", sector: "Banking", price: 95.30, change: 1.55 },
        { symbol: "IDEA", sector: "Telecom", price: 14.50, change: -2.30 },
        { symbol: "ZOMATO", sector: "IT", price: 78.20, change: -1.85 }
    ];

    // Update stats
    document.getElementById('today-signals').textContent = demoSignals.length;
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';

    // Render signals
    const signalsContainer = document.getElementById('active-signals');
    if (demoSignals.length > 0) {
        signalsContainer.innerHTML = demoSignals.map(s => `
            <div class="signal-card">
                <div class="signal-header">
                    <div>
                        <p class="signal-stock">${s.symbol}</p>
                        <p class="signal-strategy">${s.strategy} · ${s.time}</p>
                    </div>
                    <div class="signal-price">
                        <p class="price-current">₹${s.current_price}</p>
                        <p class="price-change ${s.change >= 0 ? 'up' : 'down'}">${s.change >= 0 ? '+' : ''}${s.change}%</p>
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
                    ${s.layers.map(l => `<span class="layer-tag">${l}</span>`).join('')}
                </div>
                
                <div class="position-info">
                    <div class="position-item">
                        <p class="position-label">Shares</p>
                        <p class="position-value">${s.shares}</p>
                    </div>
                    <div class="position-item">
                        <p class="position-label">Investment</p>
                        <p class="position-value">₹${s.investment.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render movers
    const moversContainer = document.getElementById('top-movers');
    moversContainer.innerHTML = demoMovers.map(m => `
        <div class="mover-item">
            <div class="mover-left">
                <div class="mover-icon ${m.change >= 0 ? 'up' : 'down'}">
                    <i class="fas fa-arrow-${m.change >= 0 ? 'up' : 'down'}"></i>
                </div>
                <div>
                    <p class="mover-name">${m.symbol}</p>
                    <p class="mover-sector">${m.sector}</p>
                </div>
            </div>
            <div class="mover-right">
                <p class="mover-price">₹${m.price}</p>
                <p class="mover-change ${m.change >= 0 ? 'up' : 'down'}" style="color: ${m.change >= 0 ? '#00d29c' : '#ff5f6d'}">${m.change >= 0 ? '+' : ''}${m.change}%</p>
            </div>
        </div>
    `).join('');
}

// Load watchlist
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
                <p class="mover-change muted">Tap to view</p>
            </div>
        </div>
    `).join('');

    // Search functionality
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

// Settings - Load from localStorage
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

// Save settings
function saveSettings() {
    const capital = document.getElementById('capital-input').value;
    const risk = document.getElementById('risk-input').value;
    const maxInvestment = document.getElementById('max-investment-input').value;

    localStorage.setItem('capital', capital);
    localStorage.setItem('risk', risk);
    localStorage.setItem('maxInvestment', maxInvestment);

    // Show success animation
    const button = document.querySelector('.save-button');
    const originalText = button.textContent;
    button.textContent = '✓ Saved!';
    button.style.background = '#00d29c';
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#4a9eff';
    }, 2000);
}

// Register Service Worker for PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
}

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});
