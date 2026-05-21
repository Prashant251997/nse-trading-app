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
    { symbol: "HCC", sector: "Infrastructure" },
    { symbol: "CGPOWER", sector: "Infrastructure" },
    { symbol: "PNCINFRA", sector: "Infrastructure" },
    { symbol: "RAYMOND", sector: "Infrastructure" },
    { symbol: "MOREPENLAB", sector: "Pharma" },
    { symbol: "GLENMARK", sector: "Pharma" },
    { symbol: "AUROPHARMA", sector: "Pharma" },
    { symbol: "INDOCO", sector: "Pharma" },
    { symbol: "FDC", sector: "Pharma" },
    { symbol: "BLISSGVS", sector: "Pharma" },
    { symbol: "JBCHEPHARM", sector: "Pharma" },
    { symbol: "SAIL", sector: "Metals" },
    { symbol: "JINDALSTEL", sector: "Metals" },
    { symbol: "WELCORP", sector: "Metals" },
    { symbol: "JSL", sector: "Metals" },
    { symbol: "RATNAMANI", sector: "Metals" },
    { symbol: "JSWENERGY", sector: "Metals" },
    { symbol: "GMDCLTD", sector: "Metals" },
    { symbol: "ASHOKLEY", sector: "Auto" },
    { symbol: "TATAMOTORS", sector: "Auto" },
    { symbol: "JKTYRE", sector: "Auto" },
    { symbol: "CEATLTD", sector: "Auto" },
    { symbol: "APOLLOTYRE", sector: "Auto" },
    { symbol: "FIEMIND", sector: "Auto" },
    { symbol: "MOTHERSON", sector: "Auto" },
    { symbol: "DLF", sector: "Real Estate" },
    { symbol: "OMAXAUTO", sector: "Real Estate" },
    { symbol: "ANANTRAJ", sector: "Real Estate" },
    { symbol: "SUNTECK", sector: "Real Estate" },
    { symbol: "MAHINDCIE", sector: "Real Estate" },
    { symbol: "ROUTE", sector: "IT" },
    { symbol: "INTELLECT", sector: "IT" },
    { symbol: "MASTEK", sector: "IT" },
    { symbol: "PAYTM", sector: "IT" },
    { symbol: "ZOMATO", sector: "IT" },
    { symbol: "TRIDENT", sector: "Textile" },
    { symbol: "VARDHACRLC", sector: "Textile" },
    { symbol: "ALOKINDS", sector: "Textile" },
    { symbol: "WELSPUNLIV", sector: "Textile" },
    { symbol: "BIRLATYRE", sector: "Textile" },
    { symbol: "MMTC", sector: "Consumer" },
    { symbol: "MOIL", sector: "Mining" },
    { symbol: "PAGEIND", sector: "Consumer" },
    { symbol: "PRAKASH", sector: "Consumer" },
    { symbol: "JINDWORLD", sector: "Consumer" },
    { symbol: "CGCL", sector: "Consumer" },
    { symbol: "ORIENTHOT", sector: "Consumer" }
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
    
    updateMarketStatus(now);
}

// Update market status (open/closed)
function updateMarketStatus(now) {
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
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

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    window.scrollTo(0, 0);
}

// Load dashboard - REAL DATA ONLY (no demo)
function loadDashboard() {
    // Initialize with zero/empty values
    document.getElementById('today-signals').textContent = '0';
    document.getElementById('open-trades').textContent = '0';
    document.getElementById('today-pnl').textContent = '₹0';
    document.getElementById('win-rate').textContent = '--';

    // Active Signals - Empty state
    const signalsContainer = document.getElementById('active-signals');
    signalsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <p>No active signals yet</p>
            <p class="empty-hint">Scanner runs every 30 min from 10 AM - 2:30 PM IST</p>
            <p class="empty-hint" style="margin-top: 12px;">Real signals will appear here when found</p>
        </div>
    `;

    // Top Movers - Empty state (will be populated when data is available)
    const moversContainer = document.getElementById('top-movers');
    moversContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-chart-line"></i>
            <p>Market data will appear here</p>
            <p class="empty-hint">After scanner runs during market hours</p>
        </div>
    `;
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
                <p class="mover-change" style="color: #6b7383;">View live</p>
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
