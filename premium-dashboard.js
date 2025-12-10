// ========================================
// PREMIUM DASHBOARD - ENHANCED FUNCTIONALITY
// Theme Toggle, Sidebar, AI Chat, Chart Animations
// ========================================

// Theme Management
let currentTheme = localStorage.getItem('dashboard-theme') || 'dark';

// Load hotel name and update dashboard title
async function loadHotelName() {
    try {
        const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
        if (!hotelId) {
            console.warn('⚠️ No hotel_id found for loading hotel name');
            return;
        }
        
        const api = window.supabaseApi || window.apiService;
        if (!api) {
            console.warn('⚠️ API service not available');
            return;
        }
        
        const client = await api.ensureClient();
        if (!client) {
            console.warn('⚠️ Supabase client not available');
            return;
        }
        
        // Try to get hotel name from hotel_admin_auth_check view
        const { data: hotelData } = await client
            .from('hotel_admin_auth_check')
            .select('hotel_name')
            .or(`hotel_id.eq.${hotelId},hotel_id_normalized.eq.${hotelId.toLowerCase()}`)
            .limit(1)
            .maybeSingle();
        
        if (hotelData && hotelData.hotel_name) {
            const hotelNameElement = document.getElementById('dashboard-hotel-name');
            if (hotelNameElement) {
                hotelNameElement.textContent = hotelData.hotel_name;
                console.log('✅ Updated dashboard hotel name:', hotelData.hotel_name);
            }
        } else {
            // Fallback: try hotels table
            const { data: hotelTableData } = await client
                .from('hotels')
                .select('name')
                .or(`id.eq.${hotelId},slug.eq.${hotelId}`)
                .limit(1)
                .maybeSingle();
            
            if (hotelTableData && hotelTableData.name) {
                const hotelNameElement = document.getElementById('dashboard-hotel-name');
                if (hotelNameElement) {
                    hotelNameElement.textContent = hotelTableData.name;
                    console.log('✅ Updated dashboard hotel name from hotels table:', hotelTableData.name);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading hotel name:', error);
    }
}

// Initialize premium dashboard features
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSidebar();
    initAIChat();
    initAIInsights();
    enhanceCharts();
    
    // Load hotel name
    await loadHotelName();
    
    // Hook into the authentication success to update dashboard
    setupDashboardUpdateHook();
    setupPremiumDashboardListeners();
    
    // Monitor for authentication completion
    monitorAuthentication();
    
    // Initialize page navigation
    initPageNavigation();
    
    // Update dashboard on load if already authenticated
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        console.log('✅ Already authenticated, loading dashboard...');
        
        // Show dashboard panel and hide password modal
        const passwordModal = document.getElementById('password-modal');
        const salesReportPanel = document.getElementById('sales-report-panel');
        if (passwordModal) {
            passwordModal.classList.add('hidden');
        }
        if (salesReportPanel) {
            salesReportPanel.classList.remove('hidden');
        }
        
        // Reload hotel name after authentication
        await loadHotelName();
        
        // First try to load data if not already loaded
        if ((typeof salesData === 'undefined' || !salesData || !salesData.transactions || salesData.transactions.length === 0) &&
            (typeof window.salesData === 'undefined' || !window.salesData || !window.salesData.transactions || window.salesData.transactions.length === 0)) {
            console.log('📥 No data found, attempting to load...');
            if (typeof loadSalesData === 'function') {
                try {
                    await loadSalesData();
                } catch (e) {
                    console.error('Error loading data:', e);
                }
            }
        }
        setTimeout(async () => {
            await updateDashboardData();
        }, 2000);
    }
    
    // Also monitor for when dashboard becomes visible - more aggressive checking
    let visibilityCheckCount = 0;
    const checkVisibility = setInterval(() => {
        visibilityCheckCount++;
        const panel = document.getElementById('sales-report-panel');
        const modal = document.getElementById('password-modal');
        
        if (panel && !panel.classList.contains('hidden') && 
            modal && modal.classList.contains('hidden')) {
            // Dashboard is visible and modal is hidden = authenticated
            clearInterval(checkVisibility);
            console.log('🎯 Dashboard authenticated and visible!');
            
            // Try to update immediately
            setTimeout(async () => {
                await updateDashboardData();
            }, 500);
            
            // Also check multiple times to catch data when it loads
            let dataCheckCount = 0;
            const dataCheckInterval = setInterval(async () => {
                dataCheckCount++;
                
                if ((typeof salesData !== 'undefined' && salesData && salesData.transactions && salesData.transactions.length > 0) ||
                    (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions && window.salesData.transactions.length > 0)) {
                    clearInterval(dataCheckInterval);
                    console.log('📊 Data found, updating dashboard...');
                    await updateDashboardData();
                } else if (dataCheckCount >= 15) {
                    // Timeout after 3 seconds
                    clearInterval(dataCheckInterval);
                    console.log('⏱️ Timeout waiting for data, forcing update...');
                    await updateDashboardData();
                }
            }, 200);
        }
        
        // Clear interval after 30 seconds
        if (visibilityCheckCount >= 30) {
            clearInterval(checkVisibility);
        }
    }, 1000);
});

// Monitor authentication and auto-update dashboard
function monitorAuthentication() {
    let hasUpdated = false;
    
    // Check periodically if dashboard becomes visible
    const checkInterval = setInterval(() => {
        const panel = document.getElementById('sales-report-panel');
        const modal = document.getElementById('password-modal');
        
        if (panel && !panel.classList.contains('hidden')) {
            if (modal && modal.classList.contains('hidden')) {
                // Dashboard is visible and modal is hidden = authenticated
                if (!hasUpdated) {
                    hasUpdated = true;
                    console.log('🔄 Dashboard authenticated, triggering update...');
                    setTimeout(async () => {
                        await updateDashboardData();
                    }, 2000);
                }
                
                // Clear interval after update
                setTimeout(() => {
                    clearInterval(checkInterval);
                }, 5000);
            }
        }
    }, 500);
}

// Setup hook to update dashboard after authentication
function setupDashboardUpdateHook() {
    // Monitor DOM changes to detect when dashboard becomes visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const salesReportPanel = document.getElementById('sales-report-panel');
                if (salesReportPanel && !salesReportPanel.classList.contains('hidden')) {
                    console.log('✅ Dashboard visible, updating data...');
                    setTimeout(async () => {
                        await updateDashboardData();
                    }, 500);
                }
            }
        });
    });
    
    // Start observing the sales report panel
    const salesReportPanel = document.getElementById('sales-report-panel');
    if (salesReportPanel) {
        observer.observe(salesReportPanel, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    // Override loadSalesData to trigger dashboard update
    const originalLoadSalesData = window.loadSalesData;
    if (originalLoadSalesData) {
        window.loadSalesData = async function() {
            const result = await originalLoadSalesData.apply(this, arguments);
            
            // Wait a bit for salesData to be populated
            setTimeout(async () => {
                // Check if dashboard is visible
                const panel = document.getElementById('sales-report-panel');
                if (panel && !panel.classList.contains('hidden')) {
                    console.log('📊 Sales data loaded, updating dashboard...');
                    // Wait a bit more to ensure salesData is set globally
                    setTimeout(async () => {
                        // Make sure salesData is available - check both local and window
                        if (typeof salesData === 'undefined' || !salesData || !salesData.transactions) {
                            // Try to get it from global
                            if (typeof window.salesData !== 'undefined' && window.salesData) {
                                salesData = window.salesData;
                                console.log('✅ Using window.salesData:', window.salesData.transactions?.length || 0, 'transactions');
                            }
                        }
                        await updateDashboardData();
                    }, 1000);
                }
            }, 500);
            
            return result;
        };
    }
    
    // Listen for salesDataLoaded event
    document.addEventListener('salesDataLoaded', async (e) => {
        console.log('📡 Received salesDataLoaded event, updating dashboard...');
        const panel = document.getElementById('sales-report-panel');
        if (panel && !panel.classList.contains('hidden')) {
            // Ensure we have the data
            if (e.detail) {
                window.salesData = e.detail;
                if (typeof salesData !== 'undefined') {
                    salesData = e.detail;
                }
            }
            setTimeout(async () => {
                await updateDashboardData();
            }, 300);
        }
    });
    
    // Listen for transactionSaved event (when payment is completed)
    window.addEventListener('transactionSaved', async (e) => {
        console.log('💾 Received transactionSaved event, refreshing dashboard...');
        const panel = document.getElementById('sales-report-panel');
        if (panel && !panel.classList.contains('hidden')) {
            // Reload sales data and update dashboard
            setTimeout(async () => {
                try {
                    if (typeof loadSalesData === 'function') {
                        await loadSalesData();
                    }
                    await updateDashboardData();
                    console.log('✅ Dashboard refreshed after transaction save');
                } catch (err) {
                    console.error('❌ Error refreshing dashboard after transaction save:', err);
                }
            }, 1000);
        }
    });
    
    // Override setupEventListeners for premium dashboard
    const originalSetupEventListeners = window.setupEventListeners;
    if (originalSetupEventListeners) {
        window.setupEventListeners = function() {
            // Call original first (might do nothing for premium dashboard)
            try {
                originalSetupEventListeners.apply(this, arguments);
            } catch (e) {
                console.log('Original setupEventListeners completed');
            }
            
            // Setup premium dashboard listeners
            setupPremiumDashboardListeners();
            
            // After event listeners are set up, update dashboard
            setTimeout(async () => {
                console.log('🔄 Setup complete, updating dashboard...');
                await updateDashboardData();
            }, 1500);
        };
    }
    
    // Override setupPasswordAuth to trigger update after login
    const originalSetupPasswordAuth = window.setupPasswordAuth;
    if (originalSetupPasswordAuth) {
        window.setupPasswordAuth = function() {
            originalSetupPasswordAuth.apply(this, arguments);
            
            // The original function already handles loadSalesData and setupEventListeners
            // We just need to ensure dashboard updates after data loads
            // This is handled by the loadSalesData override above
        };
    }
}

// Setup premium dashboard specific event listeners
function setupPremiumDashboardListeners() {
    // Remove existing listeners first
    const applyFiltersBtn = document.getElementById('apply-dashboard-filters');
    if (applyFiltersBtn) {
        // Clone and replace to remove old listeners
        const newBtn = applyFiltersBtn.cloneNode(true);
        applyFiltersBtn.parentNode.replaceChild(newBtn, applyFiltersBtn);
        
        // Add new listener
        newBtn.addEventListener('click', async () => {
            console.log('🔍 Applying filters and updating dashboard...');
            if (typeof updateDashboard === 'function') {
                await updateDashboard();
            } else {
                await updateDashboardData();
            }
        });
    }
}

// Update dashboard data function
async function updateDashboardData() {
    try {
        console.log('🔄 Updating dashboard data...');
        
        // STRICT: Get hotel_id from sessionStorage - only show data for logged-in hotel
        const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
        if (!hotelId) {
            console.warn('⚠️ No hotel_id found in sessionStorage. Dashboard will show no data.');
            transactions = [];
            directUpdateSummaryCards([]);
            if (typeof updateCharts === 'function') {
                updateCharts([]);
            }
            return;
        }
        
        console.log('🔒 Filtering dashboard data for hotel_id:', hotelId);
        
        // Get transactions from global salesData - check multiple sources
        let transactions = [];
        
        // Try multiple ways to get the data
        if (typeof salesData !== 'undefined' && salesData && salesData.transactions && Array.isArray(salesData.transactions)) {
            transactions = salesData.transactions;
            console.log('✅ Found salesData.transactions:', transactions.length);
        } else if (window.salesData && window.salesData.transactions && Array.isArray(window.salesData.transactions)) {
            transactions = window.salesData.transactions;
            console.log('✅ Found window.salesData.transactions:', transactions.length);
        } else {
            // Try to get from API directly - MUST filter by hotel_id
            if (typeof apiService !== 'undefined' && apiService.getSales) {
                console.log('📡 Fetching data directly from API...');
                try {
                    if (!apiService.configLoaded) {
                        await apiService.initialize();
                    }
                    // Note: getSales requires branchId, but we need all branches for the hotel
                    // So we'll use loadSalesData which already handles hotel filtering
                    if (typeof loadSalesData === 'function') {
                        await loadSalesData();
                        if (window.salesData && window.salesData.transactions) {
                            transactions = window.salesData.transactions;
                            console.log('✅ Fetched from loadSalesData:', transactions.length, 'transactions');
                        }
                    } else {
                        console.warn('⚠️ loadSalesData function not available');
                    }
                } catch (e) {
                    console.error('❌ Error fetching from API:', e);
                    console.error('Error stack:', e.stack);
                }
            } else {
                console.warn('⚠️ apiService.getSales not available');
            }
        }
        
        // STRICT: Filter transactions by hotel_id (double-check client-side)
        if (transactions.length > 0 && hotelId) {
            const originalCount = transactions.length;
            transactions = transactions.filter(t => {
                // Check if transaction has hotel_id that matches
                const tHotelId = t.hotel_id || t.hotelId || null;
                if (tHotelId && String(tHotelId) === String(hotelId)) {
                    return true;
                }
                // If no hotel_id on transaction, check branch's hotel_id
                if (t.branchId) {
                    // We'll trust that loadSalesData already filtered by hotel_id
                    // But if branch data is available, verify it
                    return true; // Trust the server-side filter
                }
                return false;
            });
            if (transactions.length !== originalCount) {
                console.log(`🔒 Filtered ${originalCount} transactions to ${transactions.length} for hotel_id: ${hotelId}`);
            }
        }
        
        if (transactions.length === 0) {
            console.warn('⚠️ No transactions found. Dashboard will show empty state.');
            transactions = []; // Still update to show zeros
        } else {
            console.log(`📊 Updating dashboard with ${transactions.length} transactions`);
        }
        
        // Always use direct update first to ensure data shows
        console.log('📊 Direct updating summary cards with', transactions.length, 'transactions...');
        directUpdateSummaryCards(transactions);
        
        // Also try the original function if available
        if (typeof updateSummaryCards === 'function') {
            console.log('📊 Also calling updateSummaryCards...');
            try {
                updateSummaryCards(transactions);
                console.log('✅ Summary cards updated via original function');
            } catch (e) {
                console.warn('⚠️ Error in updateSummaryCards, using direct update only:', e);
            }
        }
        
        // Update charts
        if (typeof updateCharts === 'function') {
            console.log('📈 Updating charts with', transactions.length, 'transactions...');
            try {
                updateCharts(transactions);
                console.log('✅ Charts updated');
            } catch (e) {
                console.error('❌ Error updating charts:', e);
            }
        } else {
            console.warn('⚠️ updateCharts function not found - charts may not update');
            // Try to manually update charts
            if (transactions.length > 0) {
                console.log('🔄 Attempting manual chart update...');
                setTimeout(() => {
                    if (typeof updateCumulativeTrendChart === 'function') updateCumulativeTrendChart(transactions);
                    if (typeof updateItemPieChart === 'function') updateItemPieChart(transactions);
                    if (typeof updateDailySalesChart === 'function') updateDailySalesChart(transactions);
                    if (typeof updateRevenueBarChart === 'function') updateRevenueBarChart(transactions);
                }, 500);
            }
        }
        
        // Also trigger AI insights update
        if (typeof initAIInsights === 'function') {
            setTimeout(() => {
                const event = new CustomEvent('insightsUpdate');
                document.dispatchEvent(event);
            }, 500);
        }
        
        console.log('✅ Dashboard update complete!');
    } catch (error) {
        console.error('❌ Error updating dashboard data:', error);
        console.error('Stack:', error.stack);
    }
}

// Theme Toggle Functionality
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');
    const body = document.body;
    
    // Apply saved theme
    applyTheme(currentTheme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('dashboard-theme', currentTheme);
            applyTheme(currentTheme);
        });
    }
    
    function applyTheme(theme) {
        body.setAttribute('data-theme', theme);
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
        }
        
        // Update chart colors based on theme
        setTimeout(() => {
            if (typeof updateCharts === 'function' && typeof salesData !== 'undefined') {
                updateCharts(salesData.transactions || []);
            }
        }, 300);
    }
}

// Sidebar Toggle Functionality
function initSidebar() {
    console.log('🔧 Initializing sidebar...');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mainContent = document.querySelector('.main-content');
    
    console.log('Sidebar elements:', {
        sidebar: !!sidebar,
        sidebarToggle: !!sidebarToggle,
        mobileMenuToggle: !!mobileMenuToggle,
        mainContent: !!mainContent
    });
    
    // Create sidebar overlay for mobile
    let sidebarOverlay = document.getElementById('sidebar-overlay');
    if (!sidebarOverlay) {
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.id = 'sidebar-overlay';
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);
        console.log('✅ Created sidebar overlay');
    }
    
    if (!sidebar) {
        console.error('❌ Sidebar element not found!');
        return;
    }
    
    // Function to toggle sidebar
    function toggleSidebar() {
        const isMobile = window.innerWidth <= 1024;
        const isActive = sidebar.classList.contains('active');
        const mainContent = document.querySelector('.main-content');
        
        console.log('🔄 Toggling sidebar:', {
            isMobile,
            isActive,
            willBeActive: !isActive
        });
        
        if (isActive) {
            // Close sidebar
            console.log('📤 Closing sidebar');
            sidebar.classList.remove('active');
            if (isMobile) {
                sidebarOverlay.classList.remove('active');
            }
            if (mobileMenuToggle) mobileMenuToggle.classList.remove('active');
            if (mainContent) mainContent.classList.remove('with-sidebar');
            document.body.style.overflow = '';
        } else {
            // Open sidebar
            console.log('📥 Opening sidebar');
            sidebar.classList.add('active');
            if (isMobile) {
                sidebarOverlay.classList.add('active');
            }
            if (mobileMenuToggle) mobileMenuToggle.classList.add('active');
            if (mainContent && !isMobile) mainContent.classList.add('with-sidebar');
            if (isMobile) {
                document.body.style.overflow = 'hidden';
            }
        }
    }
    
    // Handle mobile menu toggle (button in header) - works on all screen sizes
    if (mobileMenuToggle) {
        console.log('✅ Setting up mobile menu toggle button');
        mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('🍔 Hamburger menu clicked!');
            toggleSidebar();
        });
    } else {
        console.error('❌ Mobile menu toggle button not found!');
    }
    
    // Handle sidebar toggle button (inside sidebar) - works on all screen sizes
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
    }
    
    // Close sidebar when clicking overlay (mobile only)
    sidebarOverlay.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            if (mobileMenuToggle) mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !mobileMenuToggle?.contains(e.target) &&
                !sidebarOverlay.contains(e.target)) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                if (mobileMenuToggle) mobileMenuToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    });
    
    // Handle sidebar navigation - switch pages and close on mobile
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const page = item.getAttribute('data-page');
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Switch to the selected page
            if (page) {
                showPage(page);
            }
            
            // Close sidebar on mobile after selection (always close, not just on mobile check)
            const isMobile = window.innerWidth <= 1024;
            if (isMobile) {
                // Use setTimeout to ensure page switch happens first
                setTimeout(() => {
                    sidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                    if (mobileMenuToggle) mobileMenuToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }, 100);
            }
        });
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            if (mobileMenuToggle) mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    console.log('✅ Sidebar initialization complete');
}

// Initialize Page Navigation
function initPageNavigation() {
    // Check initial hash first
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'sales', 'menu-insights', 'branch-insights', 'inventory'].includes(hash)) {
        showPage(hash);
        // Update active nav item
        const navItems = document.querySelectorAll('.nav-item[data-page]');
        navItems.forEach(nav => {
            nav.classList.remove('active');
            if (nav.getAttribute('data-page') === hash) {
                nav.classList.add('active');
            }
        });
    } else {
        // Show dashboard by default
        showPage('dashboard');
    }
    
    // Listen for page changes from URL hash
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && ['dashboard', 'sales', 'menu-insights', 'branch-insights', 'inventory'].includes(hash)) {
            showPage(hash);
        }
    });
}

// Page Navigation System
async function showPage(pageName) {
    console.log('🔄 Switching to page:', pageName);
    
    // Hide all page sections
    const allPageSections = document.querySelectorAll('.page-section');
    allPageSections.forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show the selected page
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        console.log('✅ Page shown:', pageName);
        
        // Update URL hash without triggering navigation
        if (window.location.hash !== `#${pageName}`) {
            window.history.replaceState(null, '', `#${pageName}`);
        }
        
        // Load page-specific data if needed
        if (pageName === 'sales') {
            await loadSalesPage();
        } else if (pageName === 'menu-insights') {
            await loadMenuInsightsPage();
        } else if (pageName === 'branch-insights') {
            await loadBranchInsightsPage();
        } else if (pageName === 'inventory') {
            loadInventoryPage();
        } else if (pageName === 'dashboard') {
            // Dashboard is default, update it
            // First check if we have data, if not try to load it
            if ((typeof salesData === 'undefined' || !salesData || !salesData.transactions || salesData.transactions.length === 0) &&
                (typeof window.salesData === 'undefined' || !window.salesData || !window.salesData.transactions || window.salesData.transactions.length === 0)) {
                console.log('📥 No data found for dashboard, attempting to load...');
                if (typeof loadSalesData === 'function') {
                    try {
                        await loadSalesData();
                    } catch (e) {
                        console.error('Error loading data:', e);
                    }
                }
            }
            setTimeout(async () => {
                await updateDashboardData();
            }, 500);
        }
    } else {
        console.warn('⚠️ Page section not found:', pageName);
    }
}

// Load Sales Page (Detailed Sales Report)
async function loadSalesPage() {
    console.log('📊 Loading sales page...');
    const salesContent = document.getElementById('page-sales-content');
    if (!salesContent) return;
    
    // Get sales data
    let transactions = [];
    if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
        transactions = salesData.transactions;
    } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
        transactions = window.salesData.transactions;
    } else {
        // Try to load data
        if (typeof loadSalesData === 'function') {
            await loadSalesData();
            if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
                transactions = salesData.transactions;
            } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
                transactions = window.salesData.transactions;
            }
        }
    }
    
    // STRICT: Get branches for filtering - ONLY for logged-in hotel
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    let branches = [];
    if (typeof apiService !== 'undefined') {
        try {
            // Use fetchBranches with hotelId filter if available
            if (apiService.fetchBranches && hotelId) {
                branches = await apiService.fetchBranches({ hotelId: hotelId, useCache: true });
            } else if (apiService.getBranches) {
                const branchesResponse = await apiService.getBranches();
                branches = branchesResponse.branches || [];
                // STRICT: Filter by hotel_id client-side if not filtered server-side
                if (hotelId && branches.length > 0) {
                    branches = branches.filter(b => {
                        const bHotelId = b.hotel_id || b.hotelId;
                        return bHotelId && String(bHotelId) === String(hotelId);
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load branches:', e);
        }
    }
    
    // Build sales report HTML
    let salesReportHTML = `
        <div class="page-header">
            <h2>💰 Sales Report</h2>
            <p>Detailed sales transactions and reports</p>
        </div>
        
        <div class="sales-filters glass-card" style="margin-bottom: 24px; padding: 20px; position: relative;">
            <button id="refresh-sales-filters" class="refresh-btn" title="Reset Filters">
                <span class="refresh-icon">↻</span>
            </button>
            <div style="margin-bottom: 16px;">
                <label class="filter-label" style="margin-bottom: 8px; display: block;">Branch Filter:</label>
                <div id="branch-filter-buttons" class="branch-filter-buttons" style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="branch-filter-btn active" data-branch-id="all">
                        All Branches
                    </button>
                    ${branches.map(branch => `
                        <button class="branch-filter-btn" data-branch-id="${branch.id}">
                            ${branch.name}
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="filter-content" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                <label class="filter-label" style="margin: 0;">From Date:</label>
                <input type="date" id="sales-from-date" class="premium-input" style="flex: 1; min-width: 150px;">
                <label class="filter-label" style="margin: 0;">To Date:</label>
                <input type="date" id="sales-to-date" class="premium-input" style="flex: 1; min-width: 150px;">
                <button id="apply-sales-filters" class="btn-premium btn-gradient">Apply Filters</button>
            </div>
            <div class="export-btn-container">
                <button id="export-sales-excel" class="export-btn export-btn-excel">
                    <span class="export-btn-icon">📊</span>
                    <span>Export Excel</span>
                </button>
                <button id="export-sales-pdf" class="export-btn export-btn-pdf">
                    <span class="export-btn-icon">📄</span>
                    <span>Export PDF</span>
                </button>
            </div>
        </div>
        
        <div class="sales-summary-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="glass-card neon-card" style="padding: 20px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Total Transactions</div>
                <div id="sales-total-transactions" style="font-size: 28px; font-weight: 700; color: var(--neon-cyan);">0</div>
            </div>
            <div class="glass-card neon-card" style="padding: 20px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Total Revenue</div>
                <div id="sales-total-revenue" style="font-size: 28px; font-weight: 700; color: var(--neon-pink);">₹0</div>
            </div>
            <div class="glass-card neon-card" style="padding: 20px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Average Order</div>
                <div id="sales-avg-order" style="font-size: 28px; font-weight: 700; color: var(--neon-orange);">₹0</div>
            </div>
        </div>
        
        <div class="sales-table-container glass-card" style="max-height: 600px; overflow-y: auto; overflow-x: auto; border-radius: 16px;">
            <table class="sales-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 16px; text-align: left; color: var(--text-primary); font-weight: 600;">Date</th>
                        <th style="padding: 16px; text-align: left; color: var(--text-primary); font-weight: 600;">Branch</th>
                        <th style="padding: 16px; text-align: left; color: var(--text-primary); font-weight: 600;">Order Type</th>
                        <th style="padding: 16px; text-align: left; color: var(--text-primary); font-weight: 600;">Items</th>
                        <th style="padding: 16px; text-align: right; color: var(--text-primary); font-weight: 600;">Amount</th>
                        <th style="padding: 16px; text-align: left; color: var(--text-primary); font-weight: 600;">Payment</th>
                    </tr>
                </thead>
                <tbody id="sales-table-body">
                    ${generateSalesTableRows(transactions)}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 12px; text-align: center; color: var(--text-secondary); font-size: 14px;">
            Showing <span id="sales-row-count">${transactions.length}</span> transaction(s)
        </div>
    `;
    
    salesContent.innerHTML = salesReportHTML;
    
    // Store all transactions for filtering
    currentFilteredTransactions = transactions;
    
    // Update summary cards with all transactions initially
    updateSalesSummaryCards(transactions);
    
    // Setup event listeners
    setupSalesPageListeners(transactions);
    
    // Auto-apply filters when branch is changed (but not on initial load)
    // This ensures filters work when user changes branch selection
    setTimeout(() => {
        const fromDateEl = document.getElementById('sales-from-date');
        const toDateEl = document.getElementById('sales-to-date');
        
        // If dates are already set in the inputs, apply filters
        if ((fromDateEl && fromDateEl.value) || (toDateEl && toDateEl.value)) {
            console.log('📅 Dates found in inputs, auto-applying filters...');
            applySalesFilters();
        }
    }, 500);
}

// Generate sales table rows
function generateSalesTableRows(transactions) {
    if (!transactions || transactions.length === 0) {
        return `
            <tr>
                <td colspan="6" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    No transactions found
                </td>
            </tr>
        `;
    }
    
    return transactions.map(transaction => {
        // Format date for display (DD-MM-YYYY format)
        const rawDate = transaction.date || transaction.dateTime || '';
        const date = formatDateForDisplay(rawDate);
        const branchName = transaction.branchName || 'Unknown';
        const orderType = transaction.orderType || 'Dining';
        const items = transaction.items || [];
        const itemCount = items.length;
        const itemNames = items.slice(0, 2).map(item => item.name || 'Unknown').join(', ');
        const moreItems = itemCount > 2 ? ` +${itemCount - 2} more` : '';
        const total = parseFloat(transaction.total) || 0;
        const paymentMode = transaction.paymentMode || 'Cash';
        
        return `
            <tr style="border-bottom: 1px solid var(--glass-border); transition: var(--transition-smooth);" 
                onmouseover="this.style.background='var(--bg-glass-hover)'" 
                onmouseout="this.style.background='transparent'">
                <td style="padding: 16px; color: var(--text-primary);">${date}</td>
                <td style="padding: 16px; color: var(--text-primary);">${branchName}</td>
                <td style="padding: 16px; color: var(--text-primary);">
                    <span style="padding: 4px 12px; border-radius: 8px; background: var(--bg-glass); font-size: 12px;">
                        ${orderType}
                    </span>
                </td>
                <td style="padding: 16px; color: var(--text-primary);">
                    <div style="font-weight: 500;">${itemNames}${moreItems}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${itemCount} item(s)</div>
                </td>
                <td style="padding: 16px; text-align: right; color: var(--neon-cyan); font-weight: 600;">₹${total.toFixed(2)}</td>
                <td style="padding: 16px; color: var(--text-primary);">${paymentMode}</td>
            </tr>
        `;
    }).join('');
}

// Update sales summary cards
function updateSalesSummaryCards(transactions) {
    const totalTransactions = transactions.length;
    const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const avgOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    const totalTransactionsEl = document.getElementById('sales-total-transactions');
    const totalRevenueEl = document.getElementById('sales-total-revenue');
    const avgOrderEl = document.getElementById('sales-avg-order');
    
    if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactions;
    if (totalRevenueEl) totalRevenueEl.textContent = `₹${totalRevenue.toFixed(2)}`;
    if (avgOrderEl) avgOrderEl.textContent = `₹${avgOrder.toFixed(2)}`;
}

// Store current filtered transactions for export
let currentFilteredTransactions = [];

// Setup sales page event listeners
function setupSalesPageListeners(allTransactions = []) {
    // Store all transactions initially
    currentFilteredTransactions = allTransactions;
    
    // Branch filter buttons
    const branchButtons = document.querySelectorAll('.branch-filter-btn');
    branchButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            branchButtons.forEach(b => {
                b.classList.remove('active');
            });
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Apply filters
            applySalesFilters();
        });
    });
    
    const applyFiltersBtn = document.getElementById('apply-sales-filters');
    const exportExcelBtn = document.getElementById('export-sales-excel');
    const exportPdfBtn = document.getElementById('export-sales-pdf');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applySalesFilters();
        });
    }
    
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportToExcel(currentFilteredTransactions);
        });
    }
    
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            exportToPDF(currentFilteredTransactions);
        });
    }
}

// Apply sales filters
async function applySalesFilters() {
    const fromDateInput = document.getElementById('sales-from-date');
    const toDateInput = document.getElementById('sales-to-date');
    const fromDate = fromDateInput?.value || '';
    const toDate = toDateInput?.value || '';
    const activeBranchBtn = document.querySelector('.branch-filter-btn.active');
    const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
    
    // Validate date inputs are in correct format (YYYY-MM-DD)
    // HTML date inputs should always return YYYY-MM-DD, but let's verify
    if (fromDate && !fromDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('❌ Invalid fromDate format:', fromDate, '- Expected YYYY-MM-DD');
    }
    if (toDate && !toDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('❌ Invalid toDate format:', toDate, '- Expected YYYY-MM-DD');
    }
    
    console.log('🔍 Applying sales filters:', { 
        fromDate, 
        toDate, 
        fromDateType: typeof fromDate,
        toDateType: typeof toDate,
        selectedBranchId,
        branchName: activeBranchBtn?.textContent?.trim()
    });
    
    // Get all transactions first (for client-side filtering fallback)
    let allTransactions = [];
    if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
        allTransactions = salesData.transactions;
    } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
        allTransactions = window.salesData.transactions;
    }
    
    console.log(`📊 Total transactions available: ${allTransactions.length}`);
    
    // Get hotel_id from sessionStorage - STRICT: Only show data for logged-in hotel
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    if (!hotelId) {
        console.warn('⚠️ No hotel_id found for sales filters');
        return;
    }
    
    // Get filtered data - ALWAYS use client-side filtering when date filters are applied
    // This ensures consistent date format handling (DD-MM-YYYY display, YYYY-MM-DD comparison)
    let filteredTransactions = [];
    
    // If date filters are applied, always use client-side filtering for reliability
    if ((fromDate || toDate) && allTransactions.length > 0) {
        console.log('📅 Date filters detected - using client-side filtering for reliable date format handling...');
        console.log('📅 Filter details:', {
            fromDate: fromDate,
            toDate: toDate,
            fromDateDisplay: fromDate ? formatDateForDisplay(fromDate) : null,
            toDateDisplay: toDate ? formatDateForDisplay(toDate) : null,
            totalTransactions: allTransactions.length,
            sampleTransactionDate: allTransactions[0].date,
            sampleTransactionDateDisplay: formatDateForDisplay(allTransactions[0].date)
        });
        filteredTransactions = filterTransactionsClientSide(allTransactions, selectedBranchId, fromDate, toDate);
        console.log(`✅ Client-side filtering returned ${filteredTransactions.length} transactions`);
    } else if (typeof apiService !== 'undefined' && apiService.getSales) {
        try {
            console.log('📡 Fetching filtered data from API...', {
                branchId: selectedBranchId,
                fromDate: fromDate || null,
                toDate: toDate || null
            });
            // Date inputs are already in YYYY-MM-DD format, which matches database format
            // Database stores dates in YYYY-MM-DD format (as per schema)
            const apiFromDate = fromDate || null;
            const apiToDate = toDate || null;
            
            console.log('📡 API call parameters:', {
                branchId: selectedBranchId,
                branchIdType: typeof selectedBranchId,
                fromDate: apiFromDate,
                toDate: apiToDate
            });
            
            // Log sample transaction to see what branch IDs look like
            if (allTransactions.length > 0) {
                console.log('📋 Sample transaction from all data:', {
                    date: allTransactions[0].date,
                    dateTime: allTransactions[0].dateTime,
                    branchId: allTransactions[0].branchId,
                    branchIdType: typeof allTransactions[0].branchId,
                    branchName: allTransactions[0].branchName
                });
            }
            
            const response = await apiService.getSales(selectedBranchId, apiFromDate, apiToDate, hotelId);
            filteredTransactions = response.transactions || [];
            console.log(`✅ API returned ${filteredTransactions.length} transactions`);
            
            // Log sample to verify
            if (filteredTransactions.length > 0) {
                console.log('📋 Sample filtered transaction from API:', {
                    date: filteredTransactions[0].date,
                    branchId: filteredTransactions[0].branchId,
                    branchName: filteredTransactions[0].branchName,
                    total: filteredTransactions[0].total
                });
            } else {
                // API returned empty or no results - always use client-side filtering
                console.log('📅 API returned empty results, using client-side filtering...');
                console.log('📅 Date filter details:', {
                    fromDate: apiFromDate,
                    toDate: apiToDate,
                    fromDateDisplay: apiFromDate ? formatDateForDisplay(apiFromDate) : null,
                    toDateDisplay: apiToDate ? formatDateForDisplay(apiToDate) : null,
                    fromDateInput: fromDate,
                    toDateInput: toDate,
                    totalTransactions: allTransactions.length,
                    sampleTransactionDate: allTransactions.length > 0 ? allTransactions[0].date : 'N/A',
                    sampleTransactionDateDisplay: allTransactions.length > 0 ? formatDateForDisplay(allTransactions[0].date) : 'N/A',
                    hotelId: hotelId
                });
                // Always use client-side filtering when we have transactions
                if (allTransactions.length > 0) {
                    filteredTransactions = filterTransactionsClientSide(allTransactions, selectedBranchId, fromDate, toDate);
                    console.log(`✅ Client-side filtering returned ${filteredTransactions.length} transactions`);
                    
                    // If client-side found results but API didn't, log the difference
                    if (filteredTransactions.length > 0) {
                        console.log('📊 Client-side found transactions that API missed. Sample:', {
                            date: filteredTransactions[0].date,
                            dateDisplay: formatDateForDisplay(filteredTransactions[0].date),
                            branchId: filteredTransactions[0].branchId,
                            branchName: filteredTransactions[0].branchName
                        });
                    } else {
                        console.warn('⚠️ Client-side filtering also returned 0 results. Check date formats:', {
                            filterFrom: fromDate,
                            filterTo: toDate,
                            sampleTransDate: allTransactions[0].date
                        });
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error fetching filtered data from API:', e);
            console.log('🔄 Falling back to client-side filtering...');
            // Fallback to client-side filtering
            filteredTransactions = filterTransactionsClientSide(allTransactions, selectedBranchId, fromDate, toDate);
        }
    } else {
        // Client-side filtering (when no API or when dates are provided)
        console.log('🔄 Using client-side filtering (no API or date filters provided)...');
        if (allTransactions.length > 0) {
            filteredTransactions = filterTransactionsClientSide(allTransactions, selectedBranchId, fromDate, toDate);
        }
    }
    
    // IMPORTANT: If we have date filters but no results, always run client-side filtering
    // This handles cases where API filtering fails or dates are in different formats
    if ((fromDate || toDate) && filteredTransactions.length === 0 && allTransactions.length > 0) {
        console.log('🔄 Date filters applied but no results - running client-side filter to handle mixed date formats...');
        filteredTransactions = filterTransactionsClientSide(allTransactions, selectedBranchId, fromDate, toDate);
        console.log(`✅ Client-side filtering (retry) returned ${filteredTransactions.length} transactions`);
    }
    
    console.log(`✅ Filtered to ${filteredTransactions.length} transactions`);
    
    // Store filtered transactions
    currentFilteredTransactions = filteredTransactions;
    
    // Update table
    const tableBody = document.getElementById('sales-table-body');
    if (tableBody) {
        const tableHTML = generateSalesTableRows(filteredTransactions);
        tableBody.innerHTML = tableHTML;
        console.log('✅ Table updated with', filteredTransactions.length, 'rows');
    } else {
        console.error('❌ Table body not found!');
    }
    
    // Update row count
    const rowCountEl = document.getElementById('sales-row-count');
    if (rowCountEl) {
        rowCountEl.textContent = filteredTransactions.length;
    }
    
    // Update summary cards
    updateSalesSummaryCards(filteredTransactions);
}

// Helper function to normalize date format for comparison
// Handles both YYYY-MM-DD and DD/MM/YYYY formats (for backward compatibility)
function normalizeDateForComparison(dateStr) {
    if (!dateStr) return '';
    
    // If already in YYYY-MM-DD format, return as is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }
    
    // If in DD/MM/YYYY format (with or without time), convert to YYYY-MM-DD
    // Handle formats like "23/11/2025" or "23/11/2025, 12:35 AM" or "12/11/2025"
    const ddmmyyyyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        return normalized;
    }
    
    // Try to parse as Date object (handles ISO strings, etc.)
    try {
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        // Silent fail - will return original string
    }
    
    return dateStr;
}

// Helper function to format date for display (DD-MM-YYYY)
function formatDateForDisplay(dateStr) {
    if (!dateStr) return 'N/A';
    
    // If in YYYY-MM-DD format, convert to DD-MM-YYYY
    const yyyymmddMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch;
        return `${day}-${month}-${year}`;
    }
    
    // If already in DD/MM/YYYY or DD-MM-YYYY format, return as is (just replace / with -)
    const ddmmyyyyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
    }
    
    // Try to parse as Date object
    try {
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            return `${day}-${month}-${year}`;
        }
    } catch (e) {
        // Silent fail
    }
    
    // Return original if we can't parse
    return dateStr;
}

// Client-side filtering helper
function filterTransactionsClientSide(transactions, branchId, fromDate, toDate) {
    // STRICT: Get hotel_id from sessionStorage - only filter data for logged-in hotel
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    
    console.log('🔍 Client-side filtering:', { 
        totalTransactions: transactions.length, 
        branchId, 
        fromDate, 
        toDate,
        hotelId: hotelId || 'NOT SET - WILL FILTER ALL'
    });
    
    const filtered = transactions.filter(t => {
        // STRICT: Filter by hotel_id first (most important filter)
        if (hotelId) {
            const tHotelId = t.hotel_id || t.hotelId || null;
            if (tHotelId && String(tHotelId) !== String(hotelId)) {
                return false; // Skip transactions from other hotels
            }
            // If transaction doesn't have hotel_id, we trust it was already filtered server-side
            // But if we have hotel_id and transaction doesn't, skip it to be safe
            if (!tHotelId && hotelId) {
                // Trust server-side filter, but log a warning
                console.warn('⚠️ Transaction missing hotel_id:', t);
            }
        }
        
        // Filter by branch - handle both string and number comparisons
        if (branchId && branchId !== 'all') {
            const tBranchId = t.branchId;
            const filterBranchId = branchId;
            
            // Try multiple comparison methods to handle string/number mismatches
            const matches = (
                tBranchId == filterBranchId || // Loose equality (handles string/number)
                String(tBranchId) === String(filterBranchId) || // String comparison
                Number(tBranchId) === Number(filterBranchId) || // Number comparison
                String(tBranchId).trim() === String(filterBranchId).trim() // Trimmed string comparison
            );
            
            if (!matches) {
                return false;
            }
        }
        
        // Filter by date - normalize both transaction date and filter dates
        // STRICT: Both fromDate and toDate must be valid for filtering to work
        if (fromDate || toDate) {
            const transDate = t.date || t.dateTime || '';
            if (!transDate) {
                return false; // Skip transactions without date
            }
            
            const normalizedTransDate = normalizeDateForComparison(transDate);
            
            // Validate normalized date is in YYYY-MM-DD format
            if (!normalizedTransDate || !normalizedTransDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return false; // Skip if we can't normalize
            }
            
            let dateMatches = true;
            
            // Filter by fromDate (exclude dates before fromDate)
            if (fromDate) {
                const normalizedFromDate = normalizeDateForComparison(fromDate);
                if (!normalizedFromDate || !normalizedFromDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return false; // Skip if we can't normalize filter date
                }
                // Exclude transactions before fromDate (strict: < means exclude)
                if (normalizedTransDate < normalizedFromDate) {
                    dateMatches = false;
                }
            }
            
            // Filter by toDate (exclude dates after toDate)
            if (toDate && dateMatches) {
                const normalizedToDate = normalizeDateForComparison(toDate);
                if (!normalizedToDate || !normalizedToDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return false; // Skip if we can't normalize filter date
                }
                // Exclude transactions after toDate (strict: > means exclude)
                if (normalizedTransDate > normalizedToDate) {
                    dateMatches = false;
                }
            }
            
            if (!dateMatches) {
                return false;
            }
        }
        
        return true;
    });
    
    console.log(`✅ Client-side filtered: ${transactions.length} → ${filtered.length} transactions`);
    
    // Log sample of filtered results for debugging
    if (filtered.length > 0 && filtered.length < transactions.length) {
        console.log('📋 Sample filtered transaction:', {
            date: filtered[0].date,
            branchId: filtered[0].branchId,
            branchName: filtered[0].branchName
        });
    } else if (filtered.length === 0 && transactions.length > 0) {
        console.warn('⚠️ No transactions matched the filters. Sample transaction:', {
            date: transactions[0].date,
            branchId: transactions[0].branchId,
            branchName: transactions[0].branchName
        });
    }
    
    return filtered;
}

// Export to Excel
function exportToExcel(transactions) {
    // STRICT: Filter by hotel_id before exporting
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    if (hotelId && transactions && transactions.length > 0) {
        const originalCount = transactions.length;
        transactions = transactions.filter(t => {
            const tHotelId = t.hotel_id || t.hotelId || null;
            return !tHotelId || String(tHotelId) === String(hotelId);
        });
        if (transactions.length !== originalCount) {
            console.log(`🔒 Filtered ${originalCount} transactions to ${transactions.length} for export (hotel_id: ${hotelId})`);
        }
    }
    
    if (!transactions || transactions.length === 0) {
        alert('No data to export');
        return;
    }
    
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(
            transactions.map(t => ({
                Date: t.date || t.dateTime,
                Branch: t.branchName,
                'Order Type': t.orderType,
                'Item Count': (t.items || []).length,
                Amount: parseFloat(t.total) || 0,
                'Payment Mode': t.paymentMode
            }))
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
        XLSX.writeFile(wb, `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
        alert('Excel export library not loaded');
    }
}

// Export to PDF
function exportToPDF(transactions) {
    // STRICT: Filter by hotel_id before exporting
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    if (hotelId && transactions && transactions.length > 0) {
        const originalCount = transactions.length;
        transactions = transactions.filter(t => {
            const tHotelId = t.hotel_id || t.hotelId || null;
            return !tHotelId || String(tHotelId) === String(hotelId);
        });
        if (transactions.length !== originalCount) {
            console.log(`🔒 Filtered ${originalCount} transactions to ${transactions.length} for export (hotel_id: ${hotelId})`);
        }
    }
    
    if (!transactions || transactions.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Use window.print() for PDF export (simple solution)
    // Or create a new window with formatted content
    const printWindow = window.open('', '_blank');
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sales Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
        </head>
        <body>
            <h1>Sales Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>Total Transactions: ${transactions.length}</p>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Branch</th>
                        <th>Order Type</th>
                        <th>Items</th>
                        <th>Amount (₹)</th>
                        <th>Payment Mode</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => `
                        <tr>
                            <td>${t.date || t.dateTime || 'N/A'}</td>
                            <td>${t.branchName || 'Unknown'}</td>
                            <td>${t.orderType || 'Dining'}</td>
                            <td>${(t.items || []).length} item(s)</td>
                            <td>${(parseFloat(t.total) || 0).toFixed(2)}</td>
                            <td>${t.paymentMode || 'Cash'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// Load Menu Insights Page
async function loadMenuInsightsPage() {
    console.log('📈 Loading menu insights...');
    const content = document.getElementById('page-menu-insights-content');
    if (!content) return;
    
    // Get sales data
    let transactions = [];
    if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
        transactions = salesData.transactions;
    } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
        transactions = window.salesData.transactions;
    } else {
        // Try to load data
        if (typeof loadSalesData === 'function') {
            await loadSalesData();
            transactions = window.salesData?.transactions || [];
        }
    }
    
    // STRICT: Get branches for filtering - ONLY for logged-in hotel
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    let branches = [];
    if (typeof apiService !== 'undefined') {
        try {
            // Use fetchBranches with hotelId filter if available
            if (apiService.fetchBranches && hotelId) {
                branches = await apiService.fetchBranches({ hotelId: hotelId, useCache: true });
            } else if (apiService.getBranches) {
                const branchesResponse = await apiService.getBranches();
                branches = branchesResponse.branches || [];
                // STRICT: Filter by hotel_id client-side if not filtered server-side
                if (hotelId && branches.length > 0) {
                    branches = branches.filter(b => {
                        const bHotelId = b.hotel_id || b.hotelId;
                        return bHotelId && String(bHotelId) === String(hotelId);
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load branches:', e);
        }
    }
    
    // Build menu insights HTML with filters
    const branchFilterOptions = branches.map(branch => `
        <button class="menu-branch-filter-btn" data-branch-id="${branch.id}" style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--bg-glass); color: var(--text-primary); cursor: pointer; transition: var(--transition-smooth);">
            ${branch.name}
        </button>
    `).join('');
    
    content.innerHTML = `
        <div class="page-header">
            <h2>📈 Menu Insights</h2>
            <p>Performance analysis of your menu items</p>
        </div>
        
        <div class="sales-filters glass-card" style="margin-bottom: 24px; padding: 20px; position: relative;">
            <button id="refresh-menu-filters" class="refresh-btn" title="Reset Filters">
                <span class="refresh-icon">↻</span>
            </button>
            <div style="margin-bottom: 16px;">
                <label class="filter-label" style="margin-bottom: 8px; display: block;">Branch Filter:</label>
                <div id="menu-branch-filter-buttons" class="branch-filter-buttons" style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="menu-branch-filter-btn active" data-branch-id="all">
                        All Branches
                    </button>
                    ${branchFilterOptions}
                </div>
            </div>
            <div class="filter-content" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                <label class="filter-label" style="margin: 0;">From Date:</label>
                <input type="date" id="menu-from-date" class="premium-input" style="flex: 1; min-width: 150px;">
                <label class="filter-label" style="margin: 0;">To Date:</label>
                <input type="date" id="menu-to-date" class="premium-input" style="flex: 1; min-width: 150px;">
                <button id="apply-menu-filters" class="btn-premium btn-gradient">Apply Filters</button>
            </div>
            <div class="export-btn-container">
                <button id="export-menu-excel" class="export-btn export-btn-excel">
                    <span class="export-btn-icon">📊</span>
                    <span>Export Excel</span>
                </button>
                <button id="export-menu-pdf" class="export-btn export-btn-pdf">
                    <span class="export-btn-icon">📄</span>
                    <span>Export PDF</span>
                </button>
            </div>
        </div>
        
        <div id="menu-insights-content">
            ${generateMenuInsightsHTML(transactions)}
        </div>
    `;
    
    // Setup event listeners for filters
    setupMenuInsightsFilters(transactions);
}

// Load Branch Insights Page
async function loadBranchInsightsPage() {
    console.log('🏢 Loading branch insights...');
    const content = document.getElementById('page-branch-insights-content');
    if (!content) return;
    
    // Get sales data
    let transactions = [];
    if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
        transactions = salesData.transactions;
    } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
        transactions = window.salesData.transactions;
    } else {
        // Try to load data
        if (typeof loadSalesData === 'function') {
            await loadSalesData();
            transactions = window.salesData?.transactions || [];
        }
    }
    
    // STRICT: Get branches for filtering - ONLY for logged-in hotel
    const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
    let branches = [];
    if (typeof apiService !== 'undefined') {
        try {
            // Use fetchBranches with hotelId filter if available
            if (apiService.fetchBranches && hotelId) {
                branches = await apiService.fetchBranches({ hotelId: hotelId, useCache: true });
            } else if (apiService.getBranches) {
                const branchesResponse = await apiService.getBranches();
                branches = branchesResponse.branches || [];
                // STRICT: Filter by hotel_id client-side if not filtered server-side
                if (hotelId && branches.length > 0) {
                    branches = branches.filter(b => {
                        const bHotelId = b.hotel_id || b.hotelId;
                        return bHotelId && String(bHotelId) === String(hotelId);
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load branches:', e);
        }
    }
    
    // Build branch insights HTML with filters
    const branchFilterOptions = branches.map(branch => `
        <button class="branch-insights-filter-btn" data-branch-id="${branch.id}">
            ${branch.name}
        </button>
    `).join('');
    
    content.innerHTML = `
        <div class="page-header">
            <h2>🏢 Branch Insights</h2>
            <p>Performance comparison across branches</p>
        </div>
        
        <div class="sales-filters glass-card" style="margin-bottom: 24px; padding: 20px; position: relative;">
            <button id="refresh-branch-insights-filters" class="refresh-btn" title="Reset Filters">
                <span class="refresh-icon">↻</span>
            </button>
            <div style="margin-bottom: 16px;">
                <label class="filter-label" style="margin-bottom: 8px; display: block;">Branch Filter:</label>
                <div id="branch-insights-filter-buttons" class="branch-filter-buttons" style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="branch-insights-filter-btn active" data-branch-id="all">
                        All Branches
                    </button>
                    ${branchFilterOptions}
                </div>
            </div>
            <div class="filter-content" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                <label class="filter-label" style="margin: 0;">From Date:</label>
                <input type="date" id="branch-insights-from-date" class="premium-input" style="flex: 1; min-width: 150px;">
                <label class="filter-label" style="margin: 0;">To Date:</label>
                <input type="date" id="branch-insights-to-date" class="premium-input" style="flex: 1; min-width: 150px;">
                <button id="apply-branch-insights-filters" class="btn-premium btn-gradient">Apply Filters</button>
            </div>
            <div class="export-btn-container">
                <button id="export-branch-insights-excel" class="export-btn export-btn-excel">
                    <span class="export-btn-icon">📊</span>
                    <span>Export Excel</span>
                </button>
                <button id="export-branch-insights-pdf" class="export-btn export-btn-pdf">
                    <span class="export-btn-icon">📄</span>
                    <span>Export PDF</span>
                </button>
            </div>
        </div>
        
        <div id="branch-insights-content">
            ${generateBranchInsightsHTML(transactions)}
        </div>
    `;
    
    // Setup event listeners for filters
    setupBranchInsightsFilters(transactions);
}

// Load Inventory Page
function loadInventoryPage() {
    console.log('📦 Loading inventory page...');
    const content = document.getElementById('page-inventory-content');
    if (content) {
        content.innerHTML = `
            <div class="page-header">
                <h2>📦 Inventory Management</h2>
                <p>Track and manage your inventory</p>
            </div>
            <div class="sales-filters glass-card" style="margin-bottom: 24px; padding: 20px; position: relative;">
                <button id="refresh-inventory-filters" class="refresh-btn" title="Reset Filters">
                    <span class="refresh-icon">↻</span>
                </button>
                <div class="inventory-placeholder" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    <p>Inventory management features coming soon...</p>
                </div>
                <div class="export-btn-container">
                    <button id="export-inventory-excel" class="export-btn export-btn-excel">
                        <span class="export-btn-icon">📊</span>
                        <span>Export Excel</span>
                    </button>
                    <button id="export-inventory-pdf" class="export-btn export-btn-pdf">
                        <span class="export-btn-icon">📄</span>
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>
        `;
    }
}

// Generate Menu Insights HTML (helper function)
function generateMenuInsightsHTML(transactions) {
    if (!transactions || transactions.length === 0) {
        return `
            <div class="glass-card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <p>No menu item data available for the selected filters.</p>
            </div>
        `;
    }
    
    // Calculate item statistics
    const itemStats = {};
    transactions.forEach(transaction => {
        const items = transaction.items || [];
        items.forEach(item => {
            if (!item || !item.name) return;
            const key = item.name;
            if (!itemStats[key]) {
                itemStats[key] = {
                    name: key,
                    quantity: 0,
                    revenue: 0,
                    orders: 0
                };
            }
            const price = parseFloat(item.price) || parseFloat(item.finalPrice) || 0;
            const quantity = parseInt(item.quantity) || 1;
            itemStats[key].quantity += quantity;
            itemStats[key].revenue += price * quantity;
            itemStats[key].orders += 1;
        });
    });
    
    const sortedItems = Object.values(itemStats).sort((a, b) => b.revenue - a.revenue);
    
    if (sortedItems.length === 0) {
        return `
            <div class="glass-card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <p>No menu items found in the selected transactions.</p>
            </div>
        `;
    }
    
    return `
        <div class="insights-grid">
            ${sortedItems.map(item => `
                <div class="insight-card glass-card">
                    <h3>${item.name}</h3>
                    <div class="insight-stats">
                        <div class="stat-item">
                            <span class="stat-label">Revenue:</span>
                            <span class="stat-value">₹${item.revenue.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Quantity Sold:</span>
                            <span class="stat-value">${item.quantity}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Orders:</span>
                            <span class="stat-value">${item.orders}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Generate Menu Insights (legacy function for compatibility)
function generateMenuInsights(transactions) {
    const content = document.getElementById('page-menu-insights-content');
    if (!content) return;
    
    content.innerHTML = generateMenuInsightsHTML(transactions);
}

// Setup Menu Insights Filters
function setupMenuInsightsFilters(allTransactions) {
    // Store all transactions for filtering
    let currentTransactions = allTransactions || [];
    
    // Branch filter buttons
    const branchButtons = document.querySelectorAll('.menu-branch-filter-btn');
    branchButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            branchButtons.forEach(b => {
                b.classList.remove('active');
            });
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Apply filters
            applyMenuInsightsFilters();
        });
    });
    
    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-menu-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyMenuInsightsFilters();
        });
    }
    
    // Refresh button to reset filters
    const refreshBtn = document.getElementById('refresh-menu-filters');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Reset branch filter to "All Branches"
            const allBranchBtn = document.querySelector('.menu-branch-filter-btn[data-branch-id="all"]');
            if (allBranchBtn) {
                branchButtons.forEach(b => {
                    b.classList.remove('active');
                });
                allBranchBtn.classList.add('active');
            }
            
            // Clear date inputs
            const fromDateInput = document.getElementById('menu-from-date');
            const toDateInput = document.getElementById('menu-to-date');
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            
            // Reload page with initial state (all transactions, no filters)
            loadMenuInsightsPage();
        });
    }
    
    // Export buttons for Menu Insights
    const exportMenuExcelBtn = document.getElementById('export-menu-excel');
    const exportMenuPdfBtn = document.getElementById('export-menu-pdf');
    
    if (exportMenuExcelBtn) {
        exportMenuExcelBtn.addEventListener('click', () => {
            // Get current filtered transactions
            let transactions = [];
            if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
                transactions = salesData.transactions;
            } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
                transactions = window.salesData.transactions;
            } else {
                transactions = currentTransactions;
            }
            
            // Apply current filters
            const fromDate = document.getElementById('menu-from-date')?.value || '';
            const toDate = document.getElementById('menu-to-date')?.value || '';
            const activeBranchBtn = document.querySelector('.menu-branch-filter-btn.active');
            const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
            
            // Filter transactions
            let filtered = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
            exportToExcel(filtered);
        });
    }
    
    if (exportMenuPdfBtn) {
        exportMenuPdfBtn.addEventListener('click', () => {
            // Get current filtered transactions
            let transactions = [];
            if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
                transactions = salesData.transactions;
            } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
                transactions = window.salesData.transactions;
            } else {
                transactions = currentTransactions;
            }
            
            // Apply current filters
            const fromDate = document.getElementById('menu-from-date')?.value || '';
            const toDate = document.getElementById('menu-to-date')?.value || '';
            const activeBranchBtn = document.querySelector('.menu-branch-filter-btn.active');
            const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
            
            // Filter transactions
            let filtered = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
            exportToPDF(filtered);
        });
    }
    
    // Apply filters function
    async function applyMenuInsightsFilters() {
        // STRICT: Get hotel_id from sessionStorage - only filter data for logged-in hotel
        const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
        if (!hotelId) {
            console.warn('⚠️ No hotel_id found in sessionStorage. Cannot apply filters.');
            alert('Hotel context not found. Please log in again.');
            return;
        }
        
        const fromDate = document.getElementById('menu-from-date')?.value || '';
        const toDate = document.getElementById('menu-to-date')?.value || '';
        const activeBranchBtn = document.querySelector('.menu-branch-filter-btn.active');
        const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
        
        console.log('🔍 Applying menu insights filters:', { 
            fromDate, 
            toDate, 
            selectedBranchId,
            hasDates: !!(fromDate || toDate),
            hasBranch: !!selectedBranchId,
            hotelId: hotelId
        });
        
        // Get all transactions first (should already be filtered by hotel_id from loadSalesData)
        let transactions = [];
        if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
            transactions = salesData.transactions;
        } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
            transactions = window.salesData.transactions;
        } else {
            transactions = currentTransactions;
        }
        
        // STRICT: Double-check hotel_id filtering
        if (hotelId && transactions.length > 0) {
            const originalCount = transactions.length;
            transactions = transactions.filter(t => {
                const tHotelId = t.hotel_id || t.hotelId || null;
                return !tHotelId || String(tHotelId) === String(hotelId);
            });
            if (transactions.length !== originalCount) {
                console.log(`🔒 Filtered ${originalCount} transactions to ${transactions.length} for hotel_id: ${hotelId}`);
            }
        }
        
        console.log(`📊 Total transactions available (filtered by hotel): ${transactions.length}`);
        
        // Get filtered data - always filter, even if no filters are set (shows all)
        let filteredTransactions = [];
        
        // If we have any filters (dates or branch), try API first, otherwise use client-side
        const hasFilters = fromDate || toDate || selectedBranchId;
        
        if (typeof apiService !== 'undefined' && apiService.getSales && hasFilters) {
            try {
                console.log('📡 Fetching filtered data from API for menu insights...', {
                    hotelId: hotelId,
                    branchId: selectedBranchId,
                    fromDate: fromDate || null,
                    toDate: toDate || null
                });
                const response = await apiService.getSales(selectedBranchId, fromDate || null, toDate || null, hotelId);
                filteredTransactions = response.transactions || [];
                console.log(`✅ API returned ${filteredTransactions.length} transactions for menu insights`);
                
                // If API returns empty but we have transactions, try client-side filtering
                if (filteredTransactions.length === 0 && transactions.length > 0) {
                    console.log('⚠️ API returned 0 results, trying client-side filtering...');
                    filteredTransactions = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
                } else if (filteredTransactions.length > 0) {
                    // Log sample to verify filtering
                    console.log('📋 Sample filtered transaction:', {
                        date: filteredTransactions[0].date,
                        branchId: filteredTransactions[0].branchId,
                        branchName: filteredTransactions[0].branchName
                    });
                }
            } catch (e) {
                console.error('❌ Error fetching filtered data from API:', e);
                console.log('🔄 Falling back to client-side filtering...');
                filteredTransactions = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
            }
        } else {
            // Client-side filtering (when no API or no filters set)
            console.log('🔄 Using client-side filtering for menu insights...', {
                hasFilters,
                reason: !hasFilters ? 'No filters set' : 'No API available'
            });
            filteredTransactions = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
        }
        
        console.log(`✅ Filtered to ${filteredTransactions.length} transactions for menu insights (from ${transactions.length} total)`);
        
        // Update menu insights content
        const insightsContent = document.getElementById('menu-insights-content');
        if (insightsContent) {
            insightsContent.innerHTML = generateMenuInsightsHTML(filteredTransactions);
        }
    }
}

// Generate Branch Insights HTML (helper function)
function generateBranchInsightsHTML(transactions) {
    if (!transactions || transactions.length === 0) {
        return `
            <div class="glass-card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <p>No branch data available for the selected filters.</p>
            </div>
        `;
    }
    
    // Calculate branch statistics
    const branchStats = {};
    transactions.forEach(transaction => {
        const branchName = transaction.branchName || 'Unknown';
        if (!branchStats[branchName]) {
            branchStats[branchName] = {
                name: branchName,
                revenue: 0,
                transactions: 0,
                avgOrderValue: 0
            };
        }
        branchStats[branchName].revenue += parseFloat(transaction.total) || 0;
        branchStats[branchName].transactions += 1;
    });
    
    // Calculate average order values
    Object.keys(branchStats).forEach(branch => {
        const stats = branchStats[branch];
        stats.avgOrderValue = stats.transactions > 0 ? stats.revenue / stats.transactions : 0;
    });
    
    const sortedBranches = Object.values(branchStats).sort((a, b) => b.revenue - a.revenue);
    
    if (sortedBranches.length === 0) {
        return `
            <div class="glass-card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <p>No branches found in the selected transactions.</p>
            </div>
        `;
    }
    
    return `
        <div class="insights-grid">
            ${sortedBranches.map(branch => `
                <div class="insight-card glass-card">
                    <h3>${branch.name}</h3>
                    <div class="insight-stats">
                        <div class="stat-item">
                            <span class="stat-label">Total Revenue:</span>
                            <span class="stat-value">₹${branch.revenue.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Transactions:</span>
                            <span class="stat-value">${branch.transactions}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Avg Order Value:</span>
                            <span class="stat-value">₹${branch.avgOrderValue.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Generate Branch Insights (legacy function for compatibility)
function generateBranchInsights(transactions) {
    const content = document.getElementById('page-branch-insights-content');
    if (!content) return;
    
    content.innerHTML = generateBranchInsightsHTML(transactions);
}

// Setup Branch Insights Filters
function setupBranchInsightsFilters(allTransactions) {
    // Store all transactions for filtering
    let currentTransactions = allTransactions || [];
    
    // Branch filter buttons
    const branchButtons = document.querySelectorAll('.branch-insights-filter-btn');
    branchButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            branchButtons.forEach(b => {
                b.classList.remove('active');
            });
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Apply filters
            applyBranchInsightsFilters();
        });
    });
    
    // Apply filters button
    const applyFiltersBtn = document.getElementById('apply-branch-insights-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyBranchInsightsFilters();
        });
    }
    
    // Refresh button to reset filters
    const refreshBtn = document.getElementById('refresh-branch-insights-filters');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Reset branch filter to "All Branches"
            const allBranchBtn = document.querySelector('.branch-insights-filter-btn[data-branch-id="all"]');
            if (allBranchBtn) {
                branchButtons.forEach(b => {
                    b.classList.remove('active');
                });
                allBranchBtn.classList.add('active');
            }
            
            // Clear date inputs
            const fromDateInput = document.getElementById('branch-insights-from-date');
            const toDateInput = document.getElementById('branch-insights-to-date');
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            
            // Reload page with initial state (all transactions, no filters)
            loadBranchInsightsPage();
        });
    }
    
    // Apply filters function
    async function applyBranchInsightsFilters() {
        // STRICT: Get hotel_id from sessionStorage - only filter data for logged-in hotel
        const hotelId = sessionStorage.getItem('dashboardHotelId') || sessionStorage.getItem('selectedHotelId');
        if (!hotelId) {
            console.warn('⚠️ No hotel_id found in sessionStorage. Cannot apply filters.');
            alert('Hotel context not found. Please log in again.');
            return;
        }
        
        const fromDate = document.getElementById('branch-insights-from-date')?.value || '';
        const toDate = document.getElementById('branch-insights-to-date')?.value || '';
        const activeBranchBtn = document.querySelector('.branch-insights-filter-btn.active');
        const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
        
        console.log('🔍 Applying branch insights filters:', { 
            fromDate, 
            toDate, 
            selectedBranchId,
            hasDates: !!(fromDate || toDate),
            hasBranch: !!selectedBranchId,
            hotelId: hotelId
        });
        
        // Get all transactions first (should already be filtered by hotel_id from loadSalesData)
        let transactions = [];
        if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
            transactions = salesData.transactions;
        } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
            transactions = window.salesData.transactions;
        } else {
            transactions = currentTransactions;
        }
        
        // STRICT: Double-check hotel_id filtering
        if (hotelId && transactions.length > 0) {
            const originalCount = transactions.length;
            transactions = transactions.filter(t => {
                const tHotelId = t.hotel_id || t.hotelId || null;
                return !tHotelId || String(tHotelId) === String(hotelId);
            });
            if (transactions.length !== originalCount) {
                console.log(`🔒 Filtered ${originalCount} transactions to ${transactions.length} for hotel_id: ${hotelId}`);
            }
        }
        
        console.log(`📊 Total transactions available (filtered by hotel): ${transactions.length}`);
        
        // Get filtered data - always filter, even if no filters are set (shows all)
        let filteredTransactions = [];
        
        // If we have any filters (dates or branch), try API first, otherwise use client-side
        const hasFilters = fromDate || toDate || selectedBranchId;
        
        if (typeof apiService !== 'undefined' && apiService.getSales && hasFilters) {
            try {
                console.log('📡 Fetching filtered data from API for branch insights...', {
                    hotelId: hotelId,
                    branchId: selectedBranchId,
                    fromDate: fromDate || null,
                    toDate: toDate || null
                });
                const response = await apiService.getSales(selectedBranchId, fromDate || null, toDate || null, hotelId);
                filteredTransactions = response.transactions || [];
                console.log(`✅ API returned ${filteredTransactions.length} transactions for branch insights`);
                
                // If API returns empty but we have transactions, try client-side filtering
                if (filteredTransactions.length === 0 && transactions.length > 0) {
                    console.log('⚠️ API returned 0 results, trying client-side filtering...');
                    filteredTransactions = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
                } else if (filteredTransactions.length > 0) {
                    // Log sample to verify filtering
                    console.log('📋 Sample filtered transaction:', {
                        date: filteredTransactions[0].date,
                        branchId: filteredTransactions[0].branchId,
                        branchName: filteredTransactions[0].branchName
                    });
                }
            } catch (e) {
                console.error('❌ Error fetching filtered data from API:', e);
                console.log('🔄 Falling back to client-side filtering...');
                filteredTransactions = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
            }
        } else {
            // Client-side filtering (when no API or no filters set)
            console.log('🔄 Using client-side filtering for branch insights...', {
                hasFilters,
                reason: !hasFilters ? 'No filters set' : 'No API available'
            });
            filteredTransactions = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
        }
        
        console.log(`✅ Filtered to ${filteredTransactions.length} transactions for branch insights (from ${transactions.length} total)`);
        
        // Update branch insights content
        const insightsContent = document.getElementById('branch-insights-content');
        if (insightsContent) {
            insightsContent.innerHTML = generateBranchInsightsHTML(filteredTransactions);
        }
    }
    
    // Export buttons for Branch Insights
    const exportBranchExcelBtn = document.getElementById('export-branch-insights-excel');
    const exportBranchPdfBtn = document.getElementById('export-branch-insights-pdf');
    
    if (exportBranchExcelBtn) {
        exportBranchExcelBtn.addEventListener('click', () => {
            // Get current filtered transactions
            let transactions = [];
            if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
                transactions = salesData.transactions;
            } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
                transactions = window.salesData.transactions;
            } else {
                transactions = currentTransactions;
            }
            
            // Apply current filters
            const fromDate = document.getElementById('branch-insights-from-date')?.value || '';
            const toDate = document.getElementById('branch-insights-to-date')?.value || '';
            const activeBranchBtn = document.querySelector('.branch-insights-filter-btn.active');
            const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
            
            // Filter transactions
            let filtered = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
            exportToExcel(filtered);
        });
    }
    
    if (exportBranchPdfBtn) {
        exportBranchPdfBtn.addEventListener('click', () => {
            // Get current filtered transactions
            let transactions = [];
            if (typeof salesData !== 'undefined' && salesData && salesData.transactions) {
                transactions = salesData.transactions;
            } else if (typeof window.salesData !== 'undefined' && window.salesData && window.salesData.transactions) {
                transactions = window.salesData.transactions;
            } else {
                transactions = currentTransactions;
            }
            
            // Apply current filters
            const fromDate = document.getElementById('branch-insights-from-date')?.value || '';
            const toDate = document.getElementById('branch-insights-to-date')?.value || '';
            const activeBranchBtn = document.querySelector('.branch-insights-filter-btn.active');
            const selectedBranchId = activeBranchBtn?.getAttribute('data-branch-id') === 'all' ? null : activeBranchBtn?.getAttribute('data-branch-id');
            
            // Filter transactions
            let filtered = filterTransactionsClientSide(transactions, selectedBranchId, fromDate, toDate);
            exportToPDF(filtered);
        });
    }
}

// AI Chat Functionality
function initAIChat() {
    const chatTrigger = document.getElementById('ai-chat-trigger');
    const chatModal = document.getElementById('ai-chat-modal');
    const chatClose = document.getElementById('ai-chat-close');
    const chatOverlay = document.getElementById('ai-chat-overlay');
    const chatInput = document.getElementById('ai-chat-input');
    const chatSend = document.getElementById('ai-chat-send');
    const chatMessages = document.getElementById('ai-chat-messages');
    const typingIndicator = document.getElementById('ai-typing');
    
    if (!chatTrigger || !chatModal) return;
    
    // Open chat modal
    chatTrigger.addEventListener('click', () => {
        chatModal.classList.remove('hidden');
        setTimeout(() => {
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.readOnly = false;
                chatInput.style.pointerEvents = 'auto';
                chatInput.focus();
            }
        }, 300);
    });
    
    // Close chat modal
    function closeChat() {
        chatModal.classList.add('hidden');
        if (chatInput) chatInput.value = '';
    }
    
    if (chatClose) {
        chatClose.addEventListener('click', closeChat);
    }
    
    if (chatOverlay) {
        chatOverlay.addEventListener('click', closeChat);
    }
    
    // Send message
    function sendMessage() {
        const message = chatInput?.value.trim();
        if (!message) return;
        
        // Add user message
        addChatMessage(message, 'user');
        chatInput.value = '';
        
        // Show typing indicator
        if (typingIndicator) {
            typingIndicator.classList.remove('hidden');
        }
        
        // Simulate AI response (rule-based)
        setTimeout(() => {
            if (typingIndicator) {
                typingIndicator.classList.add('hidden');
            }
            const aiResponse = generateAIResponse(message);
            addChatMessage(aiResponse, 'ai');
        }, 1000 + Math.random() * 1000);
    }
    
    if (chatSend) {
        chatSend.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    function addChatMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'ai-message user-message' : 'ai-message';
        
        if (type === 'ai') {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar ai-avatar';
            avatar.textContent = '🤖';
            messageDiv.appendChild(avatar);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        const p = document.createElement('p');
        p.textContent = text;
        content.appendChild(p);
        messageDiv.appendChild(content);
        
        if (type === 'user') {
            messageDiv.appendChild(content);
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.style.background = 'linear-gradient(135deg, var(--neon-purple), var(--neon-pink))';
            avatar.textContent = '👤';
            messageDiv.insertBefore(avatar, content);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function generateAIResponse(message) {
        const lowerMessage = message.toLowerCase().trim();
        const transactions = typeof salesData !== 'undefined' ? salesData.transactions || [] : [];
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Helper function to calculate statistics
        function calculateStats(transactionList) {
            if (!transactionList || transactionList.length === 0) {
                return { revenue: 0, count: 0, avgOrder: 0, items: {} };
            }
            
            let totalRevenue = 0;
            const itemBreakdown = {};
            
            transactionList.forEach(transaction => {
                totalRevenue += parseFloat(transaction.total) || 0;
                const items = transaction.items || transaction.transaction_items || [];
                items.forEach(item => {
                    const itemName = item.name || item.item_name || '';
                    if (itemName) {
                        if (!itemBreakdown[itemName]) {
                            itemBreakdown[itemName] = { quantity: 0, revenue: 0 };
                        }
                        const qty = parseInt(item.quantity) || 1;
                        const price = parseFloat(item.price || item.final_price || item.finalPrice || 0);
                        itemBreakdown[itemName].quantity += qty;
                        itemBreakdown[itemName].revenue += price * qty;
                    }
                });
            });
            
            return {
                revenue: totalRevenue,
                count: transactionList.length,
                avgOrder: transactionList.length > 0 ? totalRevenue / transactionList.length : 0,
                items: itemBreakdown
            };
        }
        
        // Helper function to get top items
        function getTopItems(itemBreakdown, limit = 5) {
            return Object.entries(itemBreakdown)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, limit);
        }
        
        // Helper function to format currency
        function formatCurrency(amount) {
            return `₹${parseFloat(amount).toFixed(2)}`;
        }
        
        // ========== GREETINGS & GENERAL ==========
        if (lowerMessage.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)$/i)) {
            return `👋 Hello! I'm your AI sales assistant. I can help you analyze your sales data, identify trends, and provide actionable insights.\n\nI can answer questions about:\n• Sales performance and revenue\n• Top selling items\n• Daily/weekly/monthly trends\n• Business recommendations\n• Data comparisons\n\nWhat would you like to know? 📊`;
        }
        
        // ========== HELP & CAPABILITIES ==========
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you') || lowerMessage.includes('what do you') || lowerMessage.includes('capabilities')) {
            return `🤖 I'm your intelligent sales analytics assistant! Here's what I can help with:\n\n📊 **Sales Analysis:**\n• Total revenue and transaction counts\n• Average order values\n• Daily, weekly, monthly performance\n• Revenue trends and patterns\n\n🔥 **Product Insights:**\n• Top selling items by quantity\n• Best revenue generators\n• Product performance comparisons\n• Inventory recommendations\n\n📈 **Business Intelligence:**\n• Performance comparisons\n• Growth trends\n• Peak sales periods\n• Actionable recommendations\n\n💡 **Just ask naturally!** Try:\n• "How are sales today?"\n• "What are my top 5 items?"\n• "Compare this week to last week"\n• "Give me business recommendations"`;
        }
        
        // ========== SALES & REVENUE QUERIES ==========
        if (lowerMessage.match(/(sales|revenue|income|earnings|money made|total sales)/i)) {
            const stats = calculateStats(transactions);
            
            if (stats.count === 0) {
                return `📊 **Sales Summary:**\n\nNo sales data available yet. Once you start processing orders, I'll provide detailed insights!\n\n💡 **Tip:** Make sure your POS system is connected and transactions are being recorded.`;
            }
            
            // Calculate growth if we have date data
            const recentTransactions = transactions.slice(0, Math.floor(transactions.length / 2));
            const olderTransactions = transactions.slice(Math.floor(transactions.length / 2));
            const recentStats = calculateStats(recentTransactions);
            const olderStats = calculateStats(olderTransactions);
            const growth = olderStats.revenue > 0 ? ((recentStats.revenue - olderStats.revenue) / olderStats.revenue * 100) : 0;
            
            let growthText = '';
            if (Math.abs(growth) > 5) {
                growthText = growth > 0 
                    ? `\n📈 **Growth:** +${growth.toFixed(1)}% compared to earlier period - Excellent trend! 🚀`
                    : `\n📉 **Trend:** ${growth.toFixed(1)}% decrease - Consider reviewing strategies.`;
            }
            
            return `📊 **Complete Sales Summary:**\n\n💰 **Total Revenue:** ${formatCurrency(stats.revenue)}\n📦 **Total Transactions:** ${stats.count}\n💵 **Average Order Value:** ${formatCurrency(stats.avgOrder)}\n${growthText}\n\n${stats.avgOrder > 500 ? '✨ **Insight:** Your average order value is strong! Consider upselling to increase revenue further.' : '💡 **Insight:** Focus on increasing average order value through combos and add-ons.'}`;
        }
        
        // ========== TOP ITEMS QUERIES ==========
        if (lowerMessage.match(/(top|best|popular|selling|most sold|best seller|favorite)/i)) {
            const stats = calculateStats(transactions);
            const topItems = getTopItems(stats.items, 5);
            
            if (topItems.length === 0) {
                return `📦 No sales data available yet. Start processing orders to see which items are most popular!\n\n💡 **Tip:** Popular items often indicate customer preferences - use this data to optimize your menu.`;
            }
            
            let response = `🔥 **Top ${topItems.length} Best Sellers:**\n\n`;
            topItems.forEach((item, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📌';
                response += `${medal} **${item.name}**\n   • Quantity: ${item.quantity} units\n   • Revenue: ${formatCurrency(item.revenue)}\n\n`;
            });
            
            const topItem = topItems[0];
            response += `💡 **Recommendation:** "${topItem.name}" is your star performer! Consider:\n• Promoting it more prominently\n• Creating combo deals around it\n• Ensuring adequate stock levels`;
            
            return response;
        }
        
        // ========== TODAY'S PERFORMANCE ==========
        if (lowerMessage.match(/(today|today's|current day|this day)/i)) {
            const todayTransactions = transactions.filter(t => {
                const transDate = t.date || t.date_time?.split('T')[0] || '';
                return transDate === today;
            });
            const stats = calculateStats(todayTransactions);
            
            if (stats.count === 0) {
                return `📅 **Today's Performance:**\n\nNo transactions recorded for today yet.\n\n💡 **Action Items:**\n• Check if your POS system is recording transactions\n• Verify date settings are correct\n• Start processing orders to see real-time data`;
            }
            
            // Compare with yesterday if available
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const yesterdayTransactions = transactions.filter(t => {
                const transDate = t.date || t.date_time?.split('T')[0] || '';
                return transDate === yesterdayStr;
            });
            const yesterdayStats = calculateStats(yesterdayTransactions);
            
            let comparison = '';
            if (yesterdayStats.count > 0) {
                const revenueChange = stats.revenue - yesterdayStats.revenue;
                const changePercent = (revenueChange / yesterdayStats.revenue * 100).toFixed(1);
                comparison = `\n📊 **vs Yesterday:**\n• Revenue: ${revenueChange >= 0 ? '+' : ''}${formatCurrency(revenueChange)} (${changePercent >= 0 ? '+' : ''}${changePercent}%)\n• Transactions: ${stats.count - yesterdayStats.count >= 0 ? '+' : ''}${stats.count - yesterdayStats.count}`;
            }
            
            return `📅 **Today's Performance:**\n\n💰 **Revenue:** ${formatCurrency(stats.revenue)}\n📦 **Transactions:** ${stats.count}\n💵 **Avg Order:** ${formatCurrency(stats.avgOrder)}${comparison}\n\n${stats.revenue > 10000 ? '✨ **Great day!** You\'re performing well. Keep up the momentum! 🚀' : stats.revenue > 5000 ? '💪 **Good progress!** Consider running a promotion to boost sales further.' : '💡 **Tip:** Focus on upselling and promoting popular items to increase today\'s revenue.'}`;
        }
        
        // ========== WEEK/MONTH QUERIES ==========
        if (lowerMessage.match(/(this week|week|weekly|last week|month|monthly|this month)/i)) {
            const daysBack = lowerMessage.includes('week') ? 7 : 30;
            const cutoffDate = new Date(now);
            cutoffDate.setDate(cutoffDate.getDate() - daysBack);
            
            const periodTransactions = transactions.filter(t => {
                const transDate = t.date || t.date_time?.split('T')[0] || '';
                return new Date(transDate) >= cutoffDate;
            });
            
            const stats = calculateStats(periodTransactions);
            const periodName = lowerMessage.includes('week') ? 'week' : 'month';
            
            if (stats.count === 0) {
                return `📅 **This ${periodName}:**\n\nNo transactions in the last ${daysBack} days.\n\n💡 **Recommendation:** Review your sales strategy and consider promotional campaigns.`;
            }
            
            const dailyAvg = stats.revenue / daysBack;
            return `📅 **Last ${daysBack} Days Performance:**\n\n💰 **Total Revenue:** ${formatCurrency(stats.revenue)}\n📦 **Transactions:** ${stats.count}\n💵 **Avg Order:** ${formatCurrency(stats.avgOrder)}\n📊 **Daily Average:** ${formatCurrency(dailyAvg)}\n\n${dailyAvg > 1000 ? '✨ **Excellent performance!** Your daily average is strong.' : '💡 **Insight:** Focus on consistent daily sales to improve overall performance.'}`;
        }
        
        // ========== COMPARISON QUERIES ==========
        if (lowerMessage.match(/(compare|comparison|vs|versus|difference|better|worse)/i)) {
            if (transactions.length < 2) {
                return `📊 **Comparison Analysis:**\n\nNeed more data to make meaningful comparisons. Collect at least a few days of sales data for accurate insights.\n\n💡 **Tip:** Comparisons help identify trends and optimize performance.`;
            }
            
            const halfPoint = Math.floor(transactions.length / 2);
            const recent = calculateStats(transactions.slice(0, halfPoint));
            const older = calculateStats(transactions.slice(halfPoint));
            
            const revenueChange = recent.revenue - older.revenue;
            const revenuePercent = older.revenue > 0 ? ((revenueChange / older.revenue) * 100).toFixed(1) : 0;
            const transactionChange = recent.count - older.count;
            
            return `📊 **Performance Comparison:**\n\n**Recent Period:**\n• Revenue: ${formatCurrency(recent.revenue)}\n• Transactions: ${recent.count}\n• Avg Order: ${formatCurrency(recent.avgOrder)}\n\n**Earlier Period:**\n• Revenue: ${formatCurrency(older.revenue)}\n• Transactions: ${older.count}\n• Avg Order: ${formatCurrency(older.avgOrder)}\n\n**Changes:**\n• Revenue: ${revenueChange >= 0 ? '+' : ''}${formatCurrency(revenueChange)} (${revenuePercent >= 0 ? '+' : ''}${revenuePercent}%)\n• Transactions: ${transactionChange >= 0 ? '+' : ''}${transactionChange}\n\n${revenuePercent > 0 ? '📈 **Trend:** Positive growth! Keep up the momentum. 🚀' : '📉 **Trend:** Declining performance. Review strategies and consider promotions.'}`;
        }
        
        // ========== RECOMMENDATIONS ==========
        if (lowerMessage.match(/(recommend|suggestion|advice|tip|improve|optimize|better|should|what should)/i)) {
            const stats = calculateStats(transactions);
            const topItems = getTopItems(stats.items, 3);
            
            if (stats.count === 0) {
                return `💡 **Business Recommendations:**\n\nSince you're just starting:\n1. **Focus on Marketing:** Promote your restaurant through social media\n2. **Menu Optimization:** Highlight your best dishes\n3. **Customer Service:** Excellent service leads to repeat customers\n4. **Track Everything:** Keep detailed records for better insights\n\nOnce you have sales data, I'll provide personalized recommendations!`;
            }
            
            let recommendations = `💡 **Personalized Recommendations:**\n\n`;
            
            // Revenue-based recommendations
            if (stats.avgOrder < 300) {
                recommendations += `1. **Increase Average Order Value:**\n   • Create combo deals\n   • Suggest add-ons and upsells\n   • Offer premium options\n\n`;
            }
            
            // Top items recommendations
            if (topItems.length > 0) {
                recommendations += `2. **Leverage Top Performers:**\n   • Promote "${topItems[0].name}" more prominently\n   • Create special offers around popular items\n   • Ensure adequate stock of best sellers\n\n`;
            }
            
            // Transaction volume recommendations
            if (stats.count < 50) {
                recommendations += `3. **Boost Transaction Volume:**\n   • Run limited-time promotions\n   • Offer loyalty programs\n   • Improve marketing reach\n\n`;
            } else {
                recommendations += `3. **Maintain Momentum:**\n   • You're doing well! Focus on consistency\n   • Consider expanding popular items\n   • Reward loyal customers\n\n`;
            }
            
            recommendations += `4. **Data-Driven Decisions:**\n   • Monitor trends daily\n   • Adjust menu based on sales data\n   • Test new items during peak times`;
            
            return recommendations;
        }
        
        // ========== AVERAGE ORDER VALUE ==========
        if (lowerMessage.match(/(average|avg|aov|order value|per order|each order)/i)) {
            const stats = calculateStats(transactions);
            
            if (stats.count === 0) {
                return `💵 **Average Order Value:**\n\nNo data available yet. Once you have transactions, I'll calculate your average order value.\n\n💡 **Industry Insight:** Higher average order values typically indicate better profitability.`;
            }
            
            const benchmark = 500;
            const comparison = stats.avgOrder >= benchmark ? 'above' : 'below';
            const difference = Math.abs(stats.avgOrder - benchmark);
            
            return `💵 **Average Order Value Analysis:**\n\n**Current AOV:** ${formatCurrency(stats.avgOrder)}\n**Industry Benchmark:** ${formatCurrency(benchmark)}\n\n**Status:** Your AOV is ${comparison} the benchmark by ${formatCurrency(difference)}\n\n${stats.avgOrder >= benchmark ? '✨ **Excellent!** Your customers are spending well. Consider:\n• Premium menu additions\n• Exclusive offers for high-value customers' : '💡 **Improvement Opportunity:**\n• Create combo deals\n• Suggest add-ons during checkout\n• Offer bundle discounts\n• Highlight premium options'}`;
        }
        
        // ========== GENERIC QUESTIONS ==========
        if (lowerMessage.match(/(how|what|when|where|why|who|which|tell me|explain|describe)/i)) {
            // Try to extract intent
            if (lowerMessage.match(/(how.*sales|how.*revenue|how.*business|how.*doing)/i)) {
                const stats = calculateStats(transactions);
                if (stats.count === 0) {
                    return `📊 **Business Status:**\n\nNo sales data available yet. Once transactions start coming in, I'll provide detailed performance analysis.\n\n💡 **Getting Started:** Make sure your POS system is properly configured and recording all transactions.`;
                }
                
                const performance = stats.revenue > 50000 ? 'excellent' : stats.revenue > 20000 ? 'good' : 'developing';
                return `📊 **How's Your Business?**\n\nBased on current data:\n\n**Performance Level:** ${performance.toUpperCase()}\n💰 **Total Revenue:** ${formatCurrency(stats.revenue)}\n📦 **Transactions:** ${stats.count}\n💵 **Avg Order:** ${formatCurrency(stats.avgOrder)}\n\n${performance === 'excellent' ? '🚀 **Outstanding!** You\'re performing exceptionally well. Consider expansion opportunities.' : performance === 'good' ? '💪 **Solid Performance!** Keep optimizing and you\'ll see even better results.' : '💡 **Growing Business!** Focus on consistent sales and customer retention.'}`;
            }
            
            if (lowerMessage.match(/(what.*best|what.*top|what.*popular|what.*selling)/i)) {
                const stats = calculateStats(transactions);
                const topItems = getTopItems(stats.items, 3);
                
                if (topItems.length === 0) {
                    return `📦 **Top Items:**\n\nNo sales data available yet. Once you start processing orders, I'll identify your best sellers.\n\n💡 **Tip:** Popular items are key indicators of customer preferences.`;
                }
                
                return `🔥 **Your Best Sellers:**\n\n${topItems.map((item, i) => `${i + 1}. **${item.name}** - ${item.quantity} units (${formatCurrency(item.revenue)})`).join('\n')}\n\n💡 **Insight:** These items drive your revenue. Consider promoting them more and ensuring consistent availability.`;
            }
            
            // Generic helpful response
            return `💡 I understand you're asking: "${message}"\n\nLet me help you with that! I can provide insights about:\n\n📊 **Sales & Revenue:**\n• Total sales and revenue\n• Average order values\n• Performance trends\n\n🔥 **Products:**\n• Top selling items\n• Product performance\n• Inventory insights\n\n📈 **Analytics:**\n• Daily/weekly/monthly comparisons\n• Growth trends\n• Business recommendations\n\n**Try asking:**\n• "How are sales today?"\n• "What are my top items?"\n• "Give me recommendations"\n• "Compare this week to last week"`;
        }
        
        // ========== DEFAULT INTELLIGENT RESPONSE ==========
        // Try to provide a helpful response even for unclear queries
        const stats = calculateStats(transactions);
        
        if (stats.count === 0) {
            return `💡 I understand you're asking about "${message}".\n\nCurrently, there's no sales data available. Once you start processing transactions, I can provide detailed insights!\n\n**I can help with:**\n• Sales summaries and revenue analysis\n• Top selling items identification\n• Performance trends and comparisons\n• Business recommendations\n\n**Try asking:**\n• "How are sales?"\n• "What are my top items?"\n• "Give me recommendations"`;
        }
        
        // Provide a summary with context
        const topItems = getTopItems(stats.items, 1);
        const topItemName = topItems.length > 0 ? topItems[0].name : 'N/A';
        
        return `💡 Regarding "${message}":\n\nHere's a quick overview of your business:\n\n💰 **Revenue:** ${formatCurrency(stats.revenue)}\n📦 **Transactions:** ${stats.count}\n💵 **Avg Order:** ${formatCurrency(stats.avgOrder)}\n🔥 **Top Item:** ${topItemName}\n\n**I can help you with:**\n• Detailed sales analysis\n• Product performance insights\n• Trend comparisons\n• Business recommendations\n\n**Try asking:**\n• "Show me sales summary"\n• "What are my top 5 items?"\n• "How's today's performance?"\n• "Give me recommendations"`;
    }
}

// AI Insights Auto-Rotation
function initAIInsights() {
    const insightsContent = document.getElementById('ai-insights-content');
    if (!insightsContent) return;
    
    function updateInsights() {
        if (typeof salesData === 'undefined' || !salesData.transactions) return;
        
        const transactions = salesData.transactions || [];
        const insights = generateInsights(transactions);
        
        insightsContent.innerHTML = '';
        insights.forEach((insight, index) => {
            setTimeout(() => {
                const item = document.createElement('div');
                item.className = 'insight-item';
                item.style.animation = `insightSlide 0.5s ease-out ${index * 0.1}s both`;
                
                const icon = document.createElement('span');
                icon.className = 'insight-icon';
                icon.textContent = insight.icon;
                
                const text = document.createElement('span');
                text.className = 'insight-text';
                text.textContent = insight.text;
                
                item.appendChild(icon);
                item.appendChild(text);
                insightsContent.appendChild(item);
            }, index * 200);
        });
    }
    
    // Update insights every 30 seconds
    setInterval(updateInsights, 30000);
    
    // Initial update
    setTimeout(updateInsights, 2000);
    
    function generateInsights(transactions) {
        const insights = [];
        
        if (transactions.length === 0) {
            return [{
                icon: '💡',
                text: 'Start processing orders to see real-time insights!'
            }];
        }
        
        const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
        const totalTransactions = transactions.length;
        const avgOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
        
        // Revenue insight
        insights.push({
            icon: '💰',
            text: `Total revenue: ₹${totalRevenue.toFixed(2)} from ${totalTransactions} transactions`
        });
        
        // Average order value
        insights.push({
            icon: '📈',
            text: `Average order value: ₹${avgOrder.toFixed(2)} - ${avgOrder > 500 ? 'Strong!' : 'Room for growth'}`
        });
        
        // Top item
        const itemBreakdown = {};
        transactions.forEach(transaction => {
            const items = transaction.items || [];
            items.forEach(item => {
                if (item && item.name) {
                    const key = item.name;
                    if (!itemBreakdown[key]) {
                        itemBreakdown[key] = { quantity: 0 };
                    }
                    itemBreakdown[key].quantity += parseInt(item.quantity) || 1;
                }
            });
        });
        
        const topItem = Object.entries(itemBreakdown)
            .sort((a, b) => b[1].quantity - a[1].quantity)[0];
        
        if (topItem) {
            insights.push({
                icon: '🔥',
                text: `Top seller: "${topItem[0]}" - ${topItem[1].quantity} units sold`
            });
        }
        
        // Performance tip
        if (totalRevenue > 50000) {
            insights.push({
                icon: '🎉',
                text: 'Excellent performance! Consider expanding popular items'
            });
        } else if (totalRevenue > 20000) {
            insights.push({
                icon: '💪',
                text: 'Good progress! Try promotions to boost sales further'
            });
        } else {
            insights.push({
                icon: '💡',
                text: 'Promote top items and offer combo deals to increase revenue'
            });
        }
        
        return insights.slice(0, 4); // Show max 4 insights
    }
}

// Enhance Charts with Neon Colors and Animations
function enhanceCharts() {
    // Override chart creation functions to use neon colors
    const originalUpdateCumulativeTrendChart = window.updateCumulativeTrendChart;
    const originalUpdateItemPieChart = window.updateItemPieChart;
    const originalUpdateDailySalesChart = window.updateDailySalesChart;
    const originalUpdateRevenueBarChart = window.updateRevenueBarChart;
    
    // Get neon colors based on theme
    function getNeonColors() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        return {
            primary: isDark ? '#00f2fe' : '#0099cc',
            secondary: isDark ? '#ff006e' : '#cc0066',
            accent: isDark ? '#8338ec' : '#6633cc',
            success: isDark ? '#06ffa5' : '#00cc66',
            warning: isDark ? '#ffbe0b' : '#ff9900'
        };
    }
    
    // Enhanced Cumulative Trend Chart
    if (originalUpdateCumulativeTrendChart) {
        window.updateCumulativeTrendChart = function(transactions) {
            const ctx = document.getElementById('cumulative-trend-chart');
            if (!ctx) return;
            
            const colors = getNeonColors();
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
            
            if (window.cumulativeTrendChart) {
                window.cumulativeTrendChart.destroy();
            }
            
            window.cumulativeTrendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Cumulative Revenue',
                        data: cumulativeData,
                        borderColor: '#7DF9FF',
                        backgroundColor: `rgba(125, 249, 255, 0.15)`,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.5,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#7DF9FF',
                        pointBorderColor: 'transparent',
                        pointBorderWidth: 0,
                        pointHoverBackgroundColor: '#90B6FF',
                        pointHoverBorderColor: 'transparent',
                        pointHoverBorderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'center',
                            labels: {
                                color: '#B8C5D6',
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 9,
                                    weight: '400'
                                },
                                padding: 8,
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#7DF9FF',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 10
                                },
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                lineWidth: 1
                            },
                            border: {
                                display: false
                            }
                        },
                        y: {
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                lineWidth: 1
                            },
                            border: {
                                display: false
                            }
                        }
                    }
                }
            });
        };
    }
    
    // Enhanced Pie Chart
    if (originalUpdateItemPieChart) {
        window.updateItemPieChart = function(transactions) {
            const ctx = document.getElementById('item-pie-chart');
            if (!ctx) return;
            
            const colors = getNeonColors();
            const itemBreakdown = {};
            transactions.forEach(transaction => {
                const items = transaction.items || [];
                if (!Array.isArray(items)) return;
                items.forEach(item => {
                    if (!item || !item.name) return;
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
            
            // Pastel neon glassmorphism color palette
            const pastelNeonPalette = [
                '#7DF9FF', // Pastel cyan
                '#FF8AD1', // Pastel pink
                '#C8FF8E', // Pastel green
                '#FFE98E', // Pastel yellow
                '#D9C8FF', // Pastel purple
                '#90B6FF', // Pastel blue
                '#FFBD8A'  // Pastel orange
            ];
            
            // Extend palette if needed for more items
            const getPastelColor = (index) => {
                return pastelNeonPalette[index % pastelNeonPalette.length];
            };
            
            if (window.itemPieChart) {
                window.itemPieChart.destroy();
            }
            
            window.itemPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: quantities,
                        backgroundColor: labels.map((_, i) => {
                            const color = getPastelColor(i);
                            return color + 'CC'; // ~80% opacity for pastel effect
                        }),
                        borderColor: 'transparent',
                        borderWidth: 0,
                        hoverBorderWidth: 0,
                        hoverOffset: 8,
                        cutout: '40%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            align: 'center',
                            labels: {
                                color: '#B8C5D6', // Pastel text color
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 9,
                                    weight: '400'
                                },
                                padding: 6,
                                boxWidth: 10,
                                boxHeight: 10,
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: colors.primary,
                            borderWidth: 2,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        };
    }
    
    // Enhanced Daily Sales Chart
    if (originalUpdateDailySalesChart) {
        window.updateDailySalesChart = function(transactions) {
            const ctx = document.getElementById('daily-sales-chart');
            if (!ctx) return;
            
            const colors = getNeonColors();
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
            
            if (window.dailySalesChart) {
                window.dailySalesChart.destroy();
            }
            
            window.dailySalesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Daily Revenue',
                        data: sales,
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return '#7DF9FFCC';
                            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            gradient.addColorStop(0, '#7DF9FFFF');
                            gradient.addColorStop(1, '#90B6FFCC');
                            return gradient;
                        },
                        borderColor: 'transparent',
                        borderWidth: 0,
                        borderRadius: 8,
                        borderSkipped: false,
                        barThickness: 'flex',
                        maxBarThickness: 50
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'center',
                            labels: {
                                color: '#B8C5D6',
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 9,
                                    weight: '400'
                                },
                                padding: 8,
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#7DF9FF',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 10
                                }
                            },
                            grid: {
                                display: false
                            },
                            border: {
                                display: false
                            }
                        },
                        y: {
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                lineWidth: 1
                            },
                            border: {
                                display: false
                            },
                            beginAtZero: true
                        }
                    }
                }
            });
        };
    }
    
    // Enhanced Revenue Bar Chart
    if (originalUpdateRevenueBarChart) {
        window.updateRevenueBarChart = function(transactions) {
            const ctx = document.getElementById('revenue-bar-chart');
            if (!ctx) return;
            
            const colors = getNeonColors();
            const itemBreakdown = {};
            transactions.forEach(transaction => {
                const items = transaction.items || [];
                if (!Array.isArray(items)) return;
                items.forEach(item => {
                    if (!item || !item.name) return;
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
            
            if (window.revenueBarChart) {
                window.revenueBarChart.destroy();
            }
            
            window.revenueBarChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Revenue (₹)',
                        data: revenues,
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return '#FF8AD1CC';
                            const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                            gradient.addColorStop(0, '#FF8AD1FF');
                            gradient.addColorStop(1, '#FFBD8ACC');
                            return gradient;
                        },
                        borderColor: 'transparent',
                        borderWidth: 0,
                        borderRadius: 8,
                        borderSkipped: false,
                        barThickness: 'flex',
                        maxBarThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    animation: {
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'center',
                            labels: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-primary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 11,
                                    weight: '500'
                                },
                                padding: 8,
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: colors.accent,
                            borderWidth: 2,
                            padding: 12,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 12
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 1
                            },
                            beginAtZero: true
                        },
                        y: {
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                                font: {
                                    family: 'Inter, sans-serif',
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 1
                            }
                        }
                    }
                }
            });
        };
    }
}

// Number Counter Animation for KPI Cards
function animateCounter(element, start, end, duration = 1000) {
    if (!element) return;
    
    const startTime = performance.now();
    const isCurrency = element.textContent.includes('₹');
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = start + (end - start) * easeOutQuart;
        
        if (isCurrency) {
            element.textContent = `₹${current.toFixed(2)}`;
        } else {
            element.textContent = Math.floor(current);
        }
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            if (isCurrency) {
                element.textContent = `₹${end.toFixed(2)}`;
            } else {
                element.textContent = end;
            }
        }
    }
    
    requestAnimationFrame(update);
}

// Direct update function if updateSummaryCards is not available
function directUpdateSummaryCards(transactions) {
    try {
        if (!transactions || !Array.isArray(transactions)) {
            console.warn('⚠️ Invalid transactions data for direct update');
            return;
        }
        
        const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
        const totalTransactions = transactions.length;
        const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
        
        // Calculate top item
        const itemBreakdown = {};
        transactions.forEach(transaction => {
            const items = transaction.items || [];
            if (!Array.isArray(items)) return;
            items.forEach(item => {
                if (!item || !item.name) return;
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
        
        if (totalRevenueEl) {
            const currentText = totalRevenueEl.textContent.replace(/[₹,]/g, '') || '0';
            const currentValue = parseFloat(currentText) || 0;
            totalRevenueEl.textContent = `₹${totalRevenue.toFixed(2)}`;
            // Animate counter if function exists
            if (typeof animateCounter === 'function' && totalRevenue > 0) {
                animateCounter(totalRevenueEl, currentValue, totalRevenue, 1500);
            }
        }
        
        if (totalTransactionsEl) {
            const currentText = totalTransactionsEl.textContent || '0';
            const currentValue = parseInt(currentText) || 0;
            totalTransactionsEl.textContent = totalTransactions;
            if (typeof animateCounter === 'function' && totalTransactions > 0) {
                animateCounter(totalTransactionsEl, currentValue, totalTransactions, 1000);
            }
        }
        
        if (avgOrderValueEl) {
            const currentText = avgOrderValueEl.textContent.replace(/[₹,]/g, '') || '0';
            const currentValue = parseFloat(currentText) || 0;
            avgOrderValueEl.textContent = `₹${avgOrderValue.toFixed(2)}`;
            if (typeof animateCounter === 'function' && avgOrderValue > 0) {
                animateCounter(avgOrderValueEl, currentValue, avgOrderValue, 1200);
            }
        }
        
        if (topItemEl) {
            topItemEl.textContent = topItem;
        }
        
        console.log('✅ Direct update complete:', {
            revenue: totalRevenue,
            transactions: totalTransactions,
            avgOrder: avgOrderValue,
            topItem: topItem
        });
    } catch (error) {
        console.error('❌ Error in directUpdateSummaryCards:', error);
    }
}

// Enhanced updateSummaryCards with animations
const originalUpdateSummaryCards = window.updateSummaryCards;
if (originalUpdateSummaryCards) {
    window.updateSummaryCards = function(transactions) {
        // Call original function first
        originalUpdateSummaryCards(transactions);
        
        // Add counter animations
        const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
        const totalTransactions = transactions.length;
        const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
        
        const totalRevenueEl = document.getElementById('total-revenue');
        const totalTransactionsEl = document.getElementById('total-transactions');
        const avgOrderValueEl = document.getElementById('avg-order-value');
        
        if (totalRevenueEl) {
            const currentValue = parseFloat(totalRevenueEl.textContent.replace('₹', '')) || 0;
            animateCounter(totalRevenueEl, currentValue, totalRevenue, 1500);
        }
        
        if (totalTransactionsEl) {
            const currentValue = parseInt(totalTransactionsEl.textContent) || 0;
            animateCounter(totalTransactionsEl, currentValue, totalTransactions, 1000);
        }
        
        if (avgOrderValueEl) {
            const currentValue = parseFloat(avgOrderValueEl.textContent.replace('₹', '')) || 0;
            animateCounter(avgOrderValueEl, currentValue, avgOrderValue, 1200);
        }
    };
}

// Enhanced updateDashboard function
const originalUpdateDashboard = window.updateDashboard;
if (originalUpdateDashboard) {
    window.updateDashboard = async function() {
        await originalUpdateDashboard();
        
        // Trigger AI insights update
        if (typeof initAIInsights === 'function') {
            setTimeout(() => {
                const insightsContent = document.getElementById('ai-insights-content');
                if (insightsContent) {
                    const insightsUpdate = insightsContent.querySelector('.insight-item');
                    if (insightsUpdate) {
                        // Trigger insight refresh
                        const event = new Event('insightsUpdate');
                        document.dispatchEvent(event);
                    }
                }
            }, 500);
        }
    };
}

// Expose functions globally if needed
window.premiumDashboard = {
    initTheme,
    initSidebar,
    initAIChat,
    initAIInsights,
    enhanceCharts
};

// Ensure charts are enhanced when dashboard loads
if (typeof Chart !== 'undefined') {
    // Wait for Chart.js to be ready
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (typeof enhanceCharts === 'function') {
                enhanceCharts();
            }
        }, 100);
    });
}

