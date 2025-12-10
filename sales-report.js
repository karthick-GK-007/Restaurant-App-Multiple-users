// Sales Report JavaScript
let ADMIN_PASSWORD = 'admin123';
let salesData = { transactions: [] };

// Show popup function
function showSalesPopup(type, title, message, buttons = []) {
    const existingPopup = document.querySelector('.sales-popup-overlay');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'sales-popup-overlay';
    
    const content = document.createElement('div');
    content.className = 'sales-popup-content';
    
    const icon = document.createElement('div');
    icon.className = `sales-popup-icon ${type}`;
    
    if (type === 'success') {
        icon.textContent = '✓';
    } else if (type === 'error') {
        icon.textContent = '✕';
    } else {
        icon.textContent = 'ℹ';
    }
    
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    
    const buttonsEl = document.createElement('div');
    buttonsEl.className = 'sales-popup-buttons';
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `sales-popup-btn ${btn.class || 'primary'}`;
        button.textContent = btn.text;
        button.onclick = () => {
            if (btn.onClick) btn.onClick();
            overlay.remove();
        };
        buttonsEl.appendChild(button);
    });
    
    content.appendChild(icon);
    content.appendChild(titleEl);
    content.appendChild(messageEl);
    content.appendChild(buttonsEl);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

// Initialize sales report
document.addEventListener('DOMContentLoaded', async () => {
    // Always show login modal
    sessionStorage.removeItem('adminAuthenticated');
    
    const passwordModal = document.getElementById('password-modal');
    const salesReportPanel = document.getElementById('sales-report-panel');
    
    if (passwordModal) passwordModal.classList.remove('hidden');
    if (salesReportPanel) salesReportPanel.classList.add('hidden');
    
    try {
        // Initialize API service
        try {
            await apiService.initialize();
        } catch (apiError) {
            console.warn('⚠️ API initialization failed:', apiError);
        }
        
        // Load admin password from config
        await loadAdminPassword();
        
        // Setup password authentication
        setupPasswordAuth();
        
        // Ensure modal is visible after a short delay
        setTimeout(() => {
            const passwordModal = document.getElementById('password-modal');
            const passwordInput = document.getElementById('password-input');
            if (passwordModal && passwordInput) {
                passwordModal.classList.remove('hidden');
                passwordInput.focus();
                passwordInput.click();
                console.log('✅ Modal and input verified after initialization');
            }
        }, 300);
    } catch (error) {
        console.error('❌ Error initializing sales report:', error);
        setupPasswordAuth();
        
        // Still try to show modal even on error
        setTimeout(() => {
            const passwordModal = document.getElementById('password-modal');
            const passwordInput = document.getElementById('password-input');
            if (passwordModal && passwordInput) {
                passwordModal.classList.remove('hidden');
                passwordInput.focus();
            }
        }, 500);
    }
});

// Load admin password from config
async function loadAdminPassword() {
    try {
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        
        const password = await apiService.getConfig('admin_password');
        if (password) {
            ADMIN_PASSWORD = password;
        }
    } catch (error) {
        console.warn('Could not load admin password from config:', error);
        if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
            ADMIN_PASSWORD = 'admin123';
        }
    }
}

// Password authentication
function setupPasswordAuth() {
    const passwordModal = document.getElementById('password-modal');
    const loginBtn = document.getElementById('login-btn');
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    const salesReportPanel = document.getElementById('sales-report-panel');
    
    if (!loginBtn || !passwordInput || !errorMessage || !salesReportPanel) {
        console.error('❌ Required login elements not found');
        return;
    }
    
    // Ensure modal is visible and panel is hidden
    if (passwordModal) {
        passwordModal.classList.remove('hidden');
        passwordModal.style.display = 'flex';
        passwordModal.style.pointerEvents = 'auto';
        passwordModal.style.zIndex = '10000';
    }
    if (salesReportPanel) {
        salesReportPanel.classList.add('hidden');
    }
    
    // Ensure password input is fully enabled and focusable
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.disabled = false;
        passwordInput.readOnly = false;
        passwordInput.style.pointerEvents = 'auto';
        passwordInput.style.opacity = '1';
        passwordInput.removeAttribute('disabled');
        passwordInput.removeAttribute('readonly');
        
        // Force focus after modal is shown
        setTimeout(() => {
            try {
                passwordInput.focus();
                passwordInput.click();
                console.log('✅ Password input focused and ready');
            } catch (e) {
                console.warn('Could not auto-focus password input:', e);
            }
        }, 200);
    }
    
    // Ensure login button is clickable
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.style.pointerEvents = 'auto';
        loginBtn.style.cursor = 'pointer';
        loginBtn.removeAttribute('disabled');
    }
    
    // Add toggle password visibility
    const togglePasswordBtn = document.getElementById('toggle-password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
            if (eyeIcon) {
                eyeIcon.textContent = type === 'password' ? '👁️' : '🙈';
            }
        });
    }
    
    loginBtn.addEventListener('click', async () => {
        const enteredPassword = passwordInput.value.trim();
        
        if (!enteredPassword) {
            errorMessage.textContent = 'Please enter a password.';
            passwordInput.focus();
            return;
        }
        
        // Get hotel identifier for password verification (same as admin panel)
        let hotelIdentifier = null;
        try {
            // Try multiple methods to get hotel identifier
            // Method 1: URL hash
            const urlHash = window.location.hash || '';
            const urlMatch = urlHash.match(/\/kagzso\/(?:admin|user)\/([^\/]+)/);
            if (urlMatch) {
                hotelIdentifier = urlMatch[1];
            }
            
            // Method 2: URL path (for direct access)
            if (!hotelIdentifier) {
                const urlPath = window.location.pathname || '';
                const pathMatch = urlPath.match(/\/kagzso\/(?:admin|user)\/([^\/]+)/);
                if (pathMatch) {
                    hotelIdentifier = pathMatch[1];
                }
            }
            
            // Method 3: sessionStorage
            if (!hotelIdentifier) {
                const storedHotelId = sessionStorage.getItem('selectedHotelId');
                if (storedHotelId) {
                    hotelIdentifier = storedHotelId;
                }
            }
            
            // Method 4: localStorage (fallback)
            if (!hotelIdentifier) {
                const localHotelId = localStorage.getItem('selectedHotelId');
                if (localHotelId) {
                    hotelIdentifier = localHotelId;
                }
            }
            
            // Method 5: Try to get from branches (if available)
            if (!hotelIdentifier && typeof allBranches !== 'undefined' && allBranches && allBranches.length > 0) {
                const firstBranch = allBranches[0];
                if (firstBranch.hotelName) {
                    hotelIdentifier = String(firstBranch.hotelName).toLowerCase().replace(/\s+/g, '-');
                } else if (firstBranch.hotel_id || firstBranch.hotelId) {
                    hotelIdentifier = firstBranch.hotel_id || firstBranch.hotelId;
                }
            }
            
            // Method 6: Try to fetch from Supabase if API is available
            if (!hotelIdentifier) {
                const api = window.supabaseApi || window.apiService;
                if (api && typeof api.ensureClient === 'function') {
                    try {
                        const client = await api.ensureClient();
                        const { data: branches } = await client
                            .from('branches')
                            .select('hotel_id, hotel_name')
                            .limit(1)
                            .maybeSingle();
                        if (branches) {
                            if (branches.hotel_name) {
                                hotelIdentifier = String(branches.hotel_name).toLowerCase().replace(/\s+/g, '-');
                            } else if (branches.hotel_id) {
                                hotelIdentifier = branches.hotel_id;
                            }
                        }
                    } catch (e) {
                        console.warn('Could not fetch hotel from Supabase:', e);
                    }
                }
            }
        } catch (e) {
            console.warn('Could not determine hotel identifier:', e);
        }
        
        // If still no identifier, use a default or show a more helpful error
        if (!hotelIdentifier) {
            console.warn('⚠️ No hotel identifier found, trying with entered password as fallback');
            // Don't block - let the verification function try with empty identifier
            // The verifyHotelAdminPassword function should handle this gracefully
        }
        
        // Use Supabase password verification (same as admin panel)
        const api = window.supabaseApi || window.apiService;
        let isPasswordValid = false;
        const originalButtonText = loginBtn.textContent;
        
        if (api && typeof api.verifyHotelAdminPassword === 'function') {
            try {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Verifying...';
                
                // Ensure API is initialized - try multiple times if needed
                if (api.initialize && typeof api.initialize === 'function') {
                    let initAttempts = 0;
                    let initialized = false;
                    while (initAttempts < 3 && !initialized) {
                        try {
                            await api.initialize();
                            // Verify client is actually ready
                            if (api.ensureClient) {
                                await api.ensureClient();
                                initialized = true;
                            } else {
                                initialized = true; // If no ensureClient, assume initialized
                            }
                        } catch (initError) {
                            initAttempts++;
                            if (initAttempts >= 3) {
                                throw new Error('Failed to initialize Supabase client after multiple attempts');
                            }
                            // Wait a bit before retrying
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    
                    if (!initialized) {
                        throw new Error('Supabase client could not be initialized');
                    }
                }
                
                // Verify password using Supabase
                // Pass hotelIdentifier only if we have it, otherwise let the function try to find it
                const verifyParams = {
                    password: enteredPassword
                };
                if (hotelIdentifier) {
                    verifyParams.hotelIdentifier = hotelIdentifier;
                }
                
                isPasswordValid = await api.verifyHotelAdminPassword(verifyParams);
            } catch (error) {
                console.error('Password verification error:', error);
                // More helpful error message
                const errorMsg = error.message || String(error) || 'Unknown error';
                if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
                    errorMessage.textContent = 'Network error. Please check your connection and try again.';
                } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
                    errorMessage.textContent = 'Hotel not found. Please check your URL or try again.';
                } else {
                    errorMessage.textContent = `Error verifying password: ${errorMsg}. Please try again.`;
                }
                loginBtn.disabled = false;
                loginBtn.textContent = originalButtonText;
                return;
            }
        } else {
            // Fallback to config-based password if Supabase verification not available
            if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
                errorMessage.textContent = 'Password not configured.';
                passwordInput.focus();
                loginBtn.disabled = false;
                loginBtn.textContent = originalButtonText;
                return;
            }
            isPasswordValid = enteredPassword === ADMIN_PASSWORD.trim();
        }
        
        if (isPasswordValid) {
            sessionStorage.setItem('adminAuthenticated', 'true');
            passwordModal.classList.add('hidden');
            salesReportPanel.classList.remove('hidden');
            errorMessage.textContent = '';
            loginBtn.disabled = false;
            loginBtn.textContent = originalButtonText;
            
            // Load sales data after successful authentication
            try {
                await loadSalesData();
                setupEventListeners();
                
                // Update dashboard if on premium dashboard page
                // Wait for salesData to be fully loaded
                setTimeout(async () => {
                    // Check if we're on premium dashboard
                    const panel = document.getElementById('sales-report-panel');
                    if (panel && !panel.classList.contains('hidden')) {
                        console.log('✅ Premium dashboard detected, updating...');
                        
                        if (typeof updateDashboard === 'function') {
                            await updateDashboard();
                        } else if (typeof updateDashboardData === 'function') {
                            await updateDashboardData();
                        } else {
                            // Direct update as fallback
                            console.log('🔄 Using direct update fallback...');
                            if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
                                if (typeof updateSummaryCards === 'function') {
                                    updateSummaryCards(salesData.transactions);
                                }
                                if (typeof updateCharts === 'function') {
                                    updateCharts(salesData.transactions);
                                }
                            }
                        }
                    }
                }, 1000);
            } catch (error) {
                console.error('❌ Error loading sales data:', error);
                showSalesPopup('error', 'Loading Error', 'Failed to load sales data. Please refresh the page and try again.', [
                    { text: 'Retry', class: 'primary', onClick: () => window.location.reload() },
                    { text: 'OK', class: 'secondary' }
                ]);
            }
        } else {
            errorMessage.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });
    
    // Handle Enter key press
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginBtn.click();
            }
        });
        
        // Also handle keydown for better compatibility
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginBtn.click();
            }
        });
        
        // Ensure input is always focusable
        passwordInput.addEventListener('focus', () => {
            console.log('✅ Password input focused');
        });
        
        passwordInput.addEventListener('blur', () => {
            console.log('⚠️ Password input blurred');
        });
    }
    
    console.log('✅ Password authentication setup complete');
}

// Load sales data from Supabase
async function loadSalesData() {
    try {
        console.log('📥 Loading sales data from Supabase...');
        
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        
        const response = await apiService.getSales();
        salesData = response || { transactions: [] };
        
        // Also set on window for global access
        window.salesData = salesData;
        
        console.log(`✅ Loaded ${salesData.transactions.length} transactions`);
        console.log('✅ salesData set globally on window.salesData');
        
        // Debug: Log sample transaction structure
        if (salesData.transactions.length > 0) {
            console.log('📋 Sample transaction:', salesData.transactions[0]);
            console.log(`📦 Items in first transaction: ${(salesData.transactions[0].items || []).length}`);
        } else {
            console.warn('⚠️ No transactions found in database. Make sure you have created some sales transactions.');
        }
        
        // Dispatch event that data is loaded
        const dataLoadedEvent = new CustomEvent('salesDataLoaded', { detail: salesData });
        document.dispatchEvent(dataLoadedEvent);
    } catch (error) {
        console.error('❌ Error loading sales data:', error);
        console.error('Error details:', error.message);
        salesData = { transactions: [] };
        window.salesData = { transactions: [] };
        showSalesPopup('error', 'Loading Error', `Failed to load sales data: ${error.message}. Please check your Supabase configuration.`, [
            { text: 'OK', class: 'primary' }
        ]);
    }
}

// Setup event listeners
function setupEventListeners() {
    const generateReportBtn = document.getElementById('generate-report-btn');
    const viewDashboardBtn = document.getElementById('view-dashboard');
    const closeReportModal = document.getElementById('close-report-modal');
    const closeDashboard = document.getElementById('close-dashboard');
    const generateReport = document.getElementById('generate-report');
    const applyDashboardFilters = document.getElementById('apply-dashboard-filters');
    const exportExcel = document.getElementById('export-excel');
    
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            document.getElementById('sales-report-modal').classList.remove('hidden');
        });
    }
    
    if (viewDashboardBtn) {
        viewDashboardBtn.addEventListener('click', () => {
            document.getElementById('dashboard-modal').classList.remove('hidden');
            updateDashboard();
        });
    }
    
    if (closeReportModal) {
        closeReportModal.addEventListener('click', () => {
            document.getElementById('sales-report-modal').classList.add('hidden');
        });
    }
    
    if (closeDashboard) {
        closeDashboard.addEventListener('click', () => {
            document.getElementById('dashboard-modal').classList.add('hidden');
        });
    }
    
    if (generateReport) {
        generateReport.addEventListener('click', () => {
            generateSalesReport();
        });
    }
    
    if (applyDashboardFilters) {
        applyDashboardFilters.addEventListener('click', () => {
            updateDashboard();
        });
    }
    
    if (exportExcel) {
        exportExcel.addEventListener('click', () => {
            exportToExcel();
        });
    }
}

// Generate sales report
async function generateSalesReport() {
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    try {
        // Load sales data with filters
        const response = await apiService.getSales(null, fromDate, toDate);
        const filteredTransactions = response.transactions || [];
        
        if (filteredTransactions.length === 0) {
            document.getElementById('sales-report').innerHTML = '<p>No transactions found for the selected period.</p>';
            return;
        }
        
        // Calculate totals
        const totalRevenue = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
        const totalTransactions = filteredTransactions.length;
        
        // Item-wise breakdown
        const itemBreakdown = {};
        filteredTransactions.forEach(transaction => {
            const items = transaction.items || [];
            if (!Array.isArray(items)) {
                console.warn('Transaction items is not an array:', transaction);
                return;
            }
            items.forEach(item => {
                if (!item || !item.name) {
                    console.warn('Invalid item found:', item);
                    return;
                }
                const key = item.name;
                if (!itemBreakdown[key]) {
                    itemBreakdown[key] = { quantity: 0, revenue: 0 };
                }
                const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;
                const quantity = parseInt(item.quantity) || 1;
                itemBreakdown[key].quantity += quantity;
                itemBreakdown[key].revenue += price * quantity;
            });
        });
        
        // Daily breakdown
        const dailyBreakdown = {};
        filteredTransactions.forEach(transaction => {
            const date = transaction.date;
            if (!dailyBreakdown[date]) {
                dailyBreakdown[date] = { transactions: 0, revenue: 0 };
            }
            dailyBreakdown[date].transactions += 1;
            dailyBreakdown[date].revenue += parseFloat(transaction.total) || 0;
        });
        
        // Render report
        let html = `
            <div class="report-summary">
                <h3>📊 Summary</h3>
                <div class="summary-item">
                    <span>Total Transactions:</span>
                    <span><strong>${totalTransactions}</strong></span>
                </div>
                <div class="summary-item total">
                    <span>Total Revenue:</span>
                    <span><strong>₹${totalRevenue.toFixed(2)}</strong></span>
                </div>
            </div>
            
            <div class="item-breakdown">
                <h3>🍽️ Item-wise Sales</h3>
                <table class="breakdown-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Quantity</th>
                            <th>Revenue (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        Object.entries(itemBreakdown).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([name, data]) => {
            html += `
                <tr>
                    <td>${name}</td>
                    <td>${data.quantity}</td>
                    <td>₹${data.revenue.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="item-breakdown">
                <h3>📅 Daily Breakdown</h3>
                <table class="breakdown-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Transactions</th>
                            <th>Revenue (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        Object.entries(dailyBreakdown).sort().forEach(([date, data]) => {
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${data.transactions}</td>
                    <td>₹${data.revenue.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('sales-report').innerHTML = html;
        
        // Store filtered data for export
        window.reportData = {
            transactions: filteredTransactions,
            summary: {
                totalRevenue,
                totalTransactions
            },
            itemBreakdown,
            dailyBreakdown
        };
    } catch (error) {
        console.error('Error generating report:', error);
        console.error('Error details:', error.message, error.stack);
        document.getElementById('sales-report').innerHTML = `
            <p style="color: #c84040; padding: 20px;">
                <strong>Error generating report:</strong><br>
                ${error.message}<br><br>
                Please check the browser console for more details.
            </p>`;
    }
}

// Update dashboard
async function updateDashboard() {
    const fromDate = document.getElementById('dashboard-from-date').value;
    const toDate = document.getElementById('dashboard-to-date').value;
    
    try {
        const response = await apiService.getSales(null, fromDate, toDate);
        const filteredTransactions = response.transactions || [];
        
        updateSummaryCards(filteredTransactions);
        updateCharts(filteredTransactions);
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

// Update summary cards
function updateSummaryCards(transactions) {
    const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const totalTransactions = transactions.length;
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    // Calculate top item
    const itemBreakdown = {};
    transactions.forEach(transaction => {
        const items = transaction.items || [];
        if (!Array.isArray(items)) {
            return;
        }
        items.forEach(item => {
            if (!item || !item.name) {
                return;
            }
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;
            const quantity = parseInt(item.quantity) || 1;
            itemBreakdown[key].quantity += quantity;
            itemBreakdown[key].revenue += price * quantity;
        });
    });
    
    let topItem = '-';
    let maxQuantity = 0;
    Object.entries(itemBreakdown).forEach(([name, data]) => {
        if (data.quantity > maxQuantity) {
            maxQuantity = data.quantity;
            topItem = name;
        }
    });
    
    const totalRevenueEl = document.getElementById('total-revenue');
    const totalTransactionsEl = document.getElementById('total-transactions');
    const avgOrderValueEl = document.getElementById('avg-order-value');
    const topItemEl = document.getElementById('top-item');
    
    if (totalRevenueEl) totalRevenueEl.textContent = `₹${totalRevenue.toFixed(2)}`;
    if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactions;
    if (avgOrderValueEl) avgOrderValueEl.textContent = `₹${avgOrderValue.toFixed(2)}`;
    if (topItemEl) topItemEl.textContent = topItem;
}

// Update all charts
function updateCharts(transactions) {
    updateCumulativeTrendChart(transactions);
    updateItemPieChart(transactions);
    updateDailySalesChart(transactions);
    updateRevenueBarChart(transactions);
}

// Chart instances
let cumulativeTrendChart = null;
let itemPieChart = null;
let dailySalesChart = null;
let revenueBarChart = null;

// Cumulative Trend Chart
function updateCumulativeTrendChart(transactions) {
    const ctx = document.getElementById('cumulative-trend-chart');
    if (!ctx) return;
    
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const dateMap = {};
    let cumulativeTotal = 0;
    
    sortedTransactions.forEach(transaction => {
        const date = transaction.date;
        cumulativeTotal += parseFloat(transaction.total) || 0;
        if (!dateMap[date]) {
            dateMap[date] = { date, cumulative: 0, daily: 0 };
        }
        dateMap[date].cumulative = cumulativeTotal;
        dateMap[date].daily += parseFloat(transaction.total) || 0;
    });
    
    const dates = Object.keys(dateMap).sort();
    const cumulativeData = dates.map(date => dateMap[date].cumulative);
    
    if (cumulativeTrendChart) {
        cumulativeTrendChart.destroy();
    }
    
    cumulativeTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Cumulative Revenue',
                data: cumulativeData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Item Pie Chart
function updateItemPieChart(transactions) {
    const ctx = document.getElementById('item-pie-chart');
    if (!ctx) return;
    
    const itemBreakdown = {};
    transactions.forEach(transaction => {
        const items = transaction.items || [];
        if (!Array.isArray(items)) {
            return;
        }
        items.forEach(item => {
            if (!item || !item.name) {
                return;
            }
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;
            const quantity = parseInt(item.quantity) || 1;
            itemBreakdown[key].quantity += quantity;
            itemBreakdown[key].revenue += price * quantity;
        });
    });
    
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .slice(0, 8);
    
    const labels = sortedItems.map(([name]) => name);
    const quantities = sortedItems.map(([, data]) => data.quantity);
    
    if (itemPieChart) {
        itemPieChart.destroy();
    }
    
    itemPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: quantities,
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
                    '#43e97b', '#fa709a', '#fee140'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Daily Sales Chart
function updateDailySalesChart(transactions) {
    const ctx = document.getElementById('daily-sales-chart');
    if (!ctx) return;
    
    const dailyBreakdown = {};
    transactions.forEach(transaction => {
        const date = transaction.date;
        if (!dailyBreakdown[date]) {
            dailyBreakdown[date] = 0;
        }
        dailyBreakdown[date] += parseFloat(transaction.total) || 0;
    });
    
    const dates = Object.keys(dailyBreakdown).sort();
    const sales = dates.map(date => dailyBreakdown[date]);
    
    if (dailySalesChart) {
        dailySalesChart.destroy();
    }
    
    dailySalesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Revenue',
                data: sales,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: '#667eea',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Revenue Bar Chart
function updateRevenueBarChart(transactions) {
    const ctx = document.getElementById('revenue-bar-chart');
    if (!ctx) return;
    
    const itemBreakdown = {};
    transactions.forEach(transaction => {
        const items = transaction.items || [];
        if (!Array.isArray(items)) {
            return;
        }
        items.forEach(item => {
            if (!item || !item.name) {
                return;
            }
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;
            const quantity = parseInt(item.quantity) || 1;
            itemBreakdown[key].quantity += quantity;
            itemBreakdown[key].revenue += price * quantity;
        });
    });
    
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10);
    
    const labels = sortedItems.map(([name]) => name);
    const revenues = sortedItems.map(([, data]) => data.revenue);
    
    if (revenueBarChart) {
        revenueBarChart.destroy();
    }
    
    revenueBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: revenues,
                backgroundColor: 'rgba(118, 75, 162, 0.8)',
                borderColor: '#764ba2',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y'
        }
    });
}

// Export to Excel
function exportToExcel() {
    if (!window.reportData || !window.reportData.transactions.length) {
        alert('Please generate a report first.');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded.');
        return;
    }
    
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
        ['Sales Report Summary'],
        [''],
        ['Total Transactions', window.reportData.summary.totalTransactions],
        ['Total Revenue', `₹${window.reportData.summary.totalRevenue.toFixed(2)}`],
        [''],
        ['Item-wise Sales'],
        ['Item Name', 'Quantity', 'Revenue (₹)']
    ];
    
    Object.entries(window.reportData.itemBreakdown).forEach(([name, data]) => {
        summaryData.push([name, data.quantity, data.revenue.toFixed(2)]);
    });
    
    summaryData.push(['']);
    summaryData.push(['Daily Breakdown']);
    summaryData.push(['Date', 'Transactions', 'Revenue (₹)']);
    
    Object.entries(window.reportData.dailyBreakdown).forEach(([date, data]) => {
        summaryData.push([date, data.transactions, data.revenue.toFixed(2)]);
    });
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Transactions sheet
    const transactionsData = [
        ['Transaction ID', 'Date', 'Item Name', 'Quantity', 'Price', 'Total']
    ];
    
    window.reportData.transactions.forEach(transaction => {
        const items = transaction.items || [];
        items.forEach(item => {
            transactionsData.push([
                transaction.id,
                transaction.date,
                item.name,
                item.quantity,
                item.price || 0,
                ((item.price || 0) * (item.quantity || 0)).toFixed(2)
            ]);
        });
    });
    
    const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData);
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');
    
    // Download
    const fileName = `sales_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}


