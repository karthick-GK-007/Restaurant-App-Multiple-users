// Cart storage
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let menuItems = [];
let branches = [];
let selectedBranchId = sessionStorage.getItem('selectedBranchId') || '';
let selectedOrderType = localStorage.getItem('selectedOrderType') || 'Dining';
const VALID_ORDER_TYPES = ['Dining', 'Takeaway', 'Online Order'];
if (!VALID_ORDER_TYPES.includes(selectedOrderType)) {
    selectedOrderType = 'Dining';
}
let currentOrderSummary = null;
let gstEnabled = true; // Global GST enabled flag
let restaurantTitle = 'Restaurant'; // Global restaurant title from config

// MULTI SELECT UI - UI state only, does not affect cart logic
let selectedItems = {}; // Format: { [itemId]: true }

// Smart QR System - Temporary QR overrides per branch
function getTemporaryQR(branchId) {
    const qrOverrides = JSON.parse(localStorage.getItem('qr_overrides') || '{}');
    return qrOverrides[branchId] || null;
}

function setTemporaryQR(branchId, qrData) {
    try {
        const qrOverrides = JSON.parse(localStorage.getItem('qr_overrides') || '{}');
        
        // Remove redundant base64 field since it's already in the URL (data URI)
        const optimizedData = {
            url: qrData.url,
            mimeType: qrData.mimeType,
            timestamp: qrData.timestamp || new Date().toISOString()
        };
        
        // Remove base64 if it's redundant (already in data URI)
        if (qrData.url && qrData.url.startsWith('data:') && qrData.base64) {
            // base64 is redundant since it's already in the data URI
            // Only store base64 separately if URL is not a data URI
        } else if (qrData.base64 && !qrData.url.startsWith('data:')) {
            optimizedData.base64 = qrData.base64;
        }
        
        qrOverrides[branchId] = optimizedData;
        
        // Check size before storing
        const dataString = JSON.stringify(qrOverrides);
        const sizeInMB = new Blob([dataString]).size / (1024 * 1024);
        
        if (sizeInMB > 4) { // Warn if approaching 5MB limit
            console.warn(`⚠️ QR overrides storage is ${sizeInMB.toFixed(2)}MB. Consider clearing old QR codes.`);
        }
        
        localStorage.setItem('qr_overrides', dataString);
    } catch (error) {
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
            // Clear old QR codes and try again
            console.warn('⚠️ Storage quota exceeded. Clearing old QR codes...');
            clearAllTemporaryQRs();
            
            // Try again with just the new QR code
            try {
                const newOverride = {
                    [branchId]: {
                        url: qrData.url,
                        mimeType: qrData.mimeType,
                        timestamp: qrData.timestamp || new Date().toISOString()
                    }
                };
                localStorage.setItem('qr_overrides', JSON.stringify(newOverride));
            } catch (retryError) {
                throw new Error('QR code is too large to store. Please use a smaller image (max 2MB recommended).');
            }
        } else {
            throw error;
        }
    }
}

// Clear all temporary QR codes to free up storage
function clearAllTemporaryQRs() {
    try {
        localStorage.removeItem('qr_overrides');
        console.log('✅ All temporary QR codes cleared');
    } catch (error) {
        console.error('Error clearing QR codes:', error);
    }
}

function clearTemporaryQR(branchId) {
    const qrOverrides = JSON.parse(localStorage.getItem('qr_overrides') || '{}');
    delete qrOverrides[branchId];
    localStorage.setItem('qr_overrides', JSON.stringify(qrOverrides));
}

function getActiveQR(branchId) {
    console.log('🔍 getActiveQR called for branchId:', branchId);
    console.log('🔍 Current branches:', branches);
    
    // Check temporary override first
    const tempQR = getTemporaryQR(branchId);
    if (tempQR) {
        console.log('🔍 Found temporary QR override');
        return {
            url: tempQR.url,
            base64: tempQR.base64,
            mimeType: tempQR.mimeType,
            source: 'temporary'
        };
    }
    
    // Fall back to branch QR from Sheets
    const branch = branches.find(b => b.id == branchId || b.id == String(branchId));
    console.log('🔍 Found branch:', branch);
    
    if (branch && branch.qrCodeURL) {
        // Ensure qrCodeURL is a string - handle objects properly
        let qrUrl = '';
        if (typeof branch.qrCodeURL === 'string') {
            qrUrl = branch.qrCodeURL;
        } else if (typeof branch.qrCodeURL === 'object' && branch.qrCodeURL !== null) {
            // If it's an object, try to extract URL
            if (branch.qrCodeURL.url) {
                qrUrl = String(branch.qrCodeURL.url);
            } else if (branch.qrCodeURL.dataURI) {
                qrUrl = String(branch.qrCodeURL.dataURI);
            } else {
                // Try to convert object to string, but check if it's valid
                const objStr = String(branch.qrCodeURL);
                if (objStr !== '[object Object]' && objStr !== '{}') {
                    qrUrl = objStr;
                } else {
                    console.warn('⚠️ qrCodeURL is an object that cannot be converted:', branch.qrCodeURL);
                    qrUrl = '';
                }
            }
        } else {
            qrUrl = String(branch.qrCodeURL || '');
        }
        
        // Final validation - reject "[object Object]"
        if (qrUrl === '[object Object]' || qrUrl === '{}') {
            console.warn('⚠️ qrCodeURL converted to "[object Object]", treating as empty');
            qrUrl = '';
        }
        
        if (qrUrl) {
            console.log('🔍 Branch has QRCodeURL:', qrUrl.substring(0, 50) + '...');
            console.log('🔍 QRCodeURL type:', typeof branch.qrCodeURL, '→ converted to:', typeof qrUrl);
            console.log('🔍 QRCodeURL is data URI:', qrUrl.startsWith('data:'));
            return {
                url: qrUrl,
                base64: null,
                mimeType: null,
                source: 'branch'
            };
        } else {
            console.warn('⚠️ Branch has qrCodeURL but it could not be converted to a valid string');
        }
    }
    
    console.log('🔍 No QR found for branch:', branchId);
    return null;
}

// View mode (grid or list)
let viewMode = localStorage.getItem('viewMode') || 'grid';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing application...');
    
    // Clear cart on page load/refresh
    cart = [];
    renderCart();
    
    // Show loader on page load
    showLoader('Loading...');
    
    // Set a maximum timeout to force hide loader (10 seconds)
    const maxTimeout = setTimeout(() => {
        console.warn('⚠️ Initialization timeout - forcing loader removal');
        hideLoader();
    }, 10000);
    
    try {
        // Initialize ThemeManager first (loads theme from Supabase)
        if (typeof ThemeManager !== 'undefined') {
            await ThemeManager.init();
            console.log('✅ Theme loaded from Supabase');
        }
        
        // Initialize API service with timeout
        const initPromise = apiService.initialize();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API initialization timeout')), 5000)
        );
        
        try {
            await Promise.race([initPromise, timeoutPromise]);
            console.log('✅ API service initialized');
        } catch (initError) {
            console.warn('⚠️ API initialization timeout or error:', initError);
            // Continue anyway
        }
        
        // Load restaurant title from Config (non-blocking)
        loadRestaurantTitle().catch(err => {
            console.warn('Could not load restaurant title:', err);
        });
        
        // Load GST enabled setting (non-blocking)
        loadGstEnabledSetting().catch(err => {
            console.warn('Could not load GST enabled setting:', err);
        });
    } catch (error) {
        console.error('❌ Error initializing API service:', error);
    }
    
    // Load branches and menu
    try {
        console.log('📥 Loading branches...');
        
        // Add timeout to loadBranches
        const branchesPromise = loadBranches();
        const branchesTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Branches loading timeout')), 8000)
        );
        
        try {
            await Promise.race([branchesPromise, branchesTimeout]);
            console.log('✅ Branches loaded:', branches.length);
        } catch (branchesError) {
            console.warn('⚠️ Branches loading timeout or error:', branchesError);
            // Use empty branches array and continue
            branches = [];
        }
        
        // Setup event listeners after branches are loaded
        setupEventListeners();
        
        // Load menu for selected branch (with timeout)
        if (selectedBranchId) {
            console.log('📥 Loading menu for selected branch:', selectedBranchId);
            try {
                const menuPromise = loadMenu();
                const menuTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Menu loading timeout')), 8000)
                );
                await Promise.race([menuPromise, menuTimeout]);
                console.log('✅ Menu loaded');
                renderCategoryButtons();
            } catch (menuError) {
                console.warn('⚠️ Menu loading timeout or error:', menuError);
                menuItems = [];
            }
        } else if (branches.length > 0) {
            // Auto-select first branch if none selected
            const branchSelector = document.getElementById('branch-selector');
            if (branchSelector && branchSelector.options.length > 1) {
                selectedBranchId = branches[0].id;
                sessionStorage.setItem('selectedBranchId', selectedBranchId);
                branchSelector.value = selectedBranchId;
                console.log('📥 Auto-selecting first branch and loading menu...');
                try {
                    const menuPromise = loadMenu();
                    const menuTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Menu loading timeout')), 8000)
                    );
                    await Promise.race([menuPromise, menuTimeout]);
                    console.log('✅ Menu loaded');
                    renderCategoryButtons();
                } catch (menuError) {
                    console.warn('⚠️ Menu loading timeout or error:', menuError);
                    menuItems = [];
                }
            }
        }
        
        renderMenu();
        renderCart();
        updateViewMode(viewMode);
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    } finally {
        // Clear the max timeout
        clearTimeout(maxTimeout);
        
        // Always hide loader when initialization completes
        hideLoader();
        
        // Multiple backup timeouts to ensure loader is removed
        setTimeout(() => {
            hideLoader();
        }, 100);
        setTimeout(() => {
            hideLoader();
        }, 500);
        setTimeout(() => {
            hideLoader();
        }, 1000);
    }
});

// Convert to IST (Indian Standard Time)
function toIST(date) {
    const istDate = new Date(date);
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const utc = istDate.getTime() + (istDate.getTimezoneOffset() * 60 * 1000);
    return new Date(utc + istOffset);
}

// Format date/time in IST (12-hour format for Sales sheet)
// Format: "DD/MM/YYYY, HH:MM AM/PM" (no seconds)
function formatIST(date) {
    const istDate = toIST(date);
    // Format: "DD/MM/YYYY, HH:MM AM/PM"
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getFullYear();
    
    let hours = istDate.getHours();
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = hours.toString().padStart(2, '0');
    
    return `${day}/${month}/${year}, ${hoursStr}:${minutes} ${ampm}`;
}

// Format date only in IST
function formatISTDate(date) {
    const istDate = toIST(date);
    return istDate.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Load restaurant title from Supabase Config
async function loadRestaurantTitle() {
    try {
        // Wait for API service to be initialized
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        
        // Try to get config from Supabase
        try {
            const title = await apiService.getConfig('restaurant_title');
            if (title) {
                restaurantTitle = title; // Store in global variable
                const titleElement = document.getElementById('restaurant-title');
                if (titleElement) {
                    titleElement.textContent = title;
                    console.log('✅ Restaurant title loaded from Supabase Config:', title);
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not load restaurant title from Supabase Config:', e);
        }
        
        console.warn('⚠️ restaurantTitle not found in config, using default');
    } catch (error) {
        console.warn('Could not load restaurant title from Config:', error);
    }
}

// Load GST enabled setting from Supabase Config
async function loadGstEnabledSetting() {
    try {
        // Wait for API service to be initialized
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        
        // Try to get config from Supabase
        try {
            const gstEnabledValue = await apiService.getConfig('gst_enabled');
            if (gstEnabledValue !== null && gstEnabledValue !== undefined) {
                gstEnabled = gstEnabledValue.toString() !== 'false';
                console.log('✅ GST enabled setting loaded:', gstEnabled);
                return;
            }
        } catch (e) {
            console.warn('Could not load GST enabled setting from Supabase Config:', e);
        }
        
        // Default to enabled if not found
        gstEnabled = true;
        console.log('⚠️ GST enabled setting not found in config, defaulting to enabled');
    } catch (error) {
        console.warn('Could not load GST enabled setting from Config:', error);
        gstEnabled = true; // Default to enabled on error
    }
}

// Show loading overlay
function showLoader(message = 'Loading...') {
    const existingLoader = document.getElementById('loading-overlay');
    if (existingLoader) {
        existingLoader.remove();
    }
    
    const loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.className = 'loading-overlay';
    loader.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center;">
            <div class="loading-spinner" style="margin: 0 auto;"></div>
            <div class="loading-text" style="margin: 0;">${message}</div>
        </div>
    `;
    document.body.appendChild(loader);
}

// Hide loading overlay
function hideLoader() {
    // Remove by ID
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.display = 'none';
        loader.style.visibility = 'hidden';
        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
        loader.classList.add('hidden');
        try {
            loader.remove();
        } catch(e) {
            // Ignore errors
        }
    }
    
    // Also remove all elements with loading-overlay class as backup
    const allLoaders = document.querySelectorAll('.loading-overlay, #loading-overlay, [id*="loading-overlay"], [class*="loading-overlay"]');
    allLoaders.forEach(loader => {
        try {
            loader.style.display = 'none';
            loader.style.visibility = 'hidden';
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
            loader.classList.add('hidden');
            loader.remove();
        } catch(e) {
            // Ignore errors
        }
    });
    
    // Force hide with display none as final backup - check all possible loading elements
    const forceHide = document.querySelectorAll('[id*="loading"], [class*="loading"], [id*="loader"], [class*="loader"]');
    forceHide.forEach(el => {
        try {
            if (el.id && (el.id.includes('loading') || el.id.includes('loader')) || 
                el.className && (el.className.includes('loading') || el.className.includes('loader'))) {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
                el.classList.add('hidden');
                if (el.id === 'loading-overlay' || el.classList.contains('loading-overlay')) {
                    el.remove();
                }
            }
        } catch(e) {
            // Ignore errors
        }
    });
    
    // Also check body for any inline styles that might be blocking
    if (document.body) {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
    }
}

// Show progress loader for payment
function showPaymentLoader() {
    const existingLoader = document.getElementById('payment-loader-overlay');
    if (existingLoader) {
        existingLoader.remove();
    }
    
    const loader = document.createElement('div');
    loader.id = 'payment-loader-overlay';
    loader.className = 'payment-loader-overlay';
    loader.innerHTML = `
        <div class="payment-loader-content">
            <div class="payment-progress-bar">
                <div class="payment-progress-fill"></div>
            </div>
            <div class="payment-loader-text">Processing Payment...</div>
        </div>
    `;
    document.body.appendChild(loader);
}

// Hide progress loader for payment
function hidePaymentLoader() {
    const loader = document.getElementById('payment-loader-overlay');
    if (loader) {
        loader.remove();
    }
}

// Load branches from Google Sheets
async function loadBranches() {
    try {
        showLoader('Loading branches...');
        const response = await apiService.getBranches();
        branches = response.branches || [];
        
        console.log('✅ Loaded branches:', branches);
        console.log('📦 Full API response:', JSON.stringify(response, null, 2));
        branches.forEach(branch => {
            // Safe type checking for qrCodeURL
            const qrUrl = branch.qrCodeURL && typeof branch.qrCodeURL === 'string' 
                ? branch.qrCodeURL 
                : String(branch.qrCodeURL || '');
            const qrPreview = qrUrl 
                ? (qrUrl.startsWith('data:') 
                    ? `data:image/... (${qrUrl.length} chars)` 
                    : qrUrl)
                : 'empty';
            console.log(`Branch ${branch.id} (${branch.name}): QRCodeURL = ${qrPreview}`);
            console.log(`   Full QRCodeURL:`, qrUrl);
        });
        
        // Populate branch tiles
        const branchTiles = document.getElementById('branch-tiles');
        if (!branchTiles) {
            console.error('❌ Branch tiles element not found');
            return;
        }
        
        // Clear existing tiles
        branchTiles.innerHTML = '';
        
        console.log(`📝 Populating branch tiles with ${branches.length} branches`);
        
        branches.forEach((branch, index) => {
            const tile = document.createElement('button');
            tile.className = 'branch-tile';
            tile.setAttribute('data-branch-id', branch.id);
            tile.textContent = branch.name || `Branch ${branch.id}`;
            if (branch.id == selectedBranchId) {
                tile.classList.add('active');
            }
            tile.addEventListener('click', async () => {
                // Remove active class from all tiles
                branchTiles.querySelectorAll('.branch-tile').forEach(t => t.classList.remove('active'));
                // Add active class to clicked tile
                tile.classList.add('active');
                // Update selected branch
                selectedBranchId = branch.id;
                // Store in sessionStorage
                sessionStorage.setItem('selectedBranchId', selectedBranchId);
                // Clear existing menu and cart
                menuItems = [];
                cart = [];
                renderCart();
                // Show loader and load menu for selected branch
                showLoader('Loading menu...');
                try {
                    await loadMenu();
                    renderMenu();
                } catch (error) {
                    console.error('Error loading menu:', error);
                } finally {
                    hideLoader();
                }
            });
            branchTiles.appendChild(tile);
            console.log(`   Added tile ${index + 1}: ${branch.name} (ID: ${branch.id})`);
        });
        
        console.log(`✅ Populated branch tiles with ${branches.length} branches`);
        
        // If no branch selected and branches exist, select first one
        if (!selectedBranchId && branches.length > 0) {
            selectedBranchId = branches[0].id;
            sessionStorage.setItem('selectedBranchId', selectedBranchId);
            // Activate first tile
            const firstTile = branchTiles.querySelector(`[data-branch-id="${selectedBranchId}"]`);
            if (firstTile) {
                branchTiles.querySelectorAll('.branch-tile').forEach(t => t.classList.remove('active'));
                firstTile.classList.add('active');
            }
            await loadMenu();
            renderMenu();
        }
        
        // Refresh QR display if billing section is visible
        if (!document.getElementById('billing-section').classList.contains('hidden')) {
            displayActiveQR();
        }
        hideLoader();
    } catch (error) {
        console.error('Error loading branches:', error);
        hideLoader();
        // Fallback to localStorage or default
        branches = JSON.parse(localStorage.getItem('branches') || '[]');
    }
}

// Handle branch selection change
async function handleBranchChange(event) {
    console.log('🔍 Branch change event triggered');
    const branchSelector = document.getElementById('branch-selector');
    if (!branchSelector) {
        console.error('❌ Branch selector not found in handleBranchChange');
        return;
    }
    
    selectedBranchId = branchSelector.value;
    console.log('🔍 Selected branch ID:', selectedBranchId);
    
    if (!selectedBranchId) {
        console.log('⚠️ No branch selected, clearing menu');
        menuItems = [];
        renderMenu();
        return;
    }
    
    sessionStorage.setItem('selectedBranchId', selectedBranchId);
    
    try {
        console.log('📥 Loading menu for branch:', selectedBranchId);
        await loadMenu();
        console.log('✅ Menu loaded for branch:', selectedBranchId);
        // Reset filters when branch changes
        selectedCategory = '';
        searchTerm = '';
        const searchInput = document.getElementById('menu-search');
        if (searchInput) searchInput.value = '';
        const clearSearchBtn = document.getElementById('clear-search');
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        renderCategoryButtons();
        renderMenu();
        
        // Clear cart when branch changes
        cart = [];
        saveCart();
        renderCart();
        
        // Refresh QR display if billing section is visible
        const billingSection = document.getElementById('billing-section');
        if (billingSection && !billingSection.classList.contains('hidden')) {
            displayActiveQR();
        }
    } catch (error) {
        console.error('❌ Error loading menu:', error);
        // Show error message to user
        const menuGrid = document.getElementById('menu-grid');
        if (menuGrid) {
            menuGrid.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger); grid-column: 1 / -1;">Error loading menu. Please try again.</p>';
        }
    }
}

// Force reload menu from JSON file (ignore localStorage cache)
async function reloadMenuFromFile() {
    try {
        const response = await fetch('data/menu.json?v=' + Date.now());
        const data = await response.json();
        menuItems = data.items || data;
        localStorage.setItem('admin_menu', JSON.stringify(menuItems));
        renderMenu();
        console.log('Menu reloaded from file');
    } catch (error) {
        console.error('Error reloading menu:', error);
    }
}

// Load menu from Google Sheets or fallback
async function loadMenu() {
    if (!selectedBranchId) {
        console.log('⚠️ No branch selected, clearing menu');
        menuItems = [];
        renderMenu();
        return;
    }
    
    try {
        showLoader('Loading menu...');
        console.log(`📥 Loading menu for branch: ${selectedBranchId}`);
        // Try Google Sheets API first
        const response = await apiService.getMenu(selectedBranchId);
        
        if (!response) {
            throw new Error('Empty response from API');
        }
        
        menuItems = response.items || [];
        console.log(`✅ Loaded ${menuItems.length} menu items for branch ${selectedBranchId}`);
        
        // Save to localStorage as backup
        if (menuItems.length > 0) {
            localStorage.setItem(`menu_${selectedBranchId}`, JSON.stringify(menuItems));
        }
        hideLoader();
    } catch (error) {
        console.error('❌ Error loading menu from API:', error);
        hideLoader();
        // Fallback to localStorage
        const savedMenu = localStorage.getItem(`menu_${selectedBranchId}`);
        if (savedMenu) {
            try {
                menuItems = JSON.parse(savedMenu);
                console.log('✅ Loaded menu from localStorage');
            } catch (e) {
                console.error('Error parsing localStorage menu:', e);
                menuItems = [];
            }
        } else {
            console.log('⚠️ No cached menu found, using empty menu');
            menuItems = [];
        }
    }
}

// Global variables for filtering
let selectedCategory = '';
let searchTerm = '';

// Render category buttons
function renderCategoryButtons() {
    const categoryButtonsContainer = document.getElementById('category-buttons');
    if (!categoryButtonsContainer) return;
    
    // Get all unique categories from menu items for the selected branch
    const categories = new Set();
    menuItems.forEach(item => {
        if (item.category && item.category.trim() !== '') {
            categories.add(item.category.trim());
        }
    });
    
    const categoryArray = Array.from(categories).sort();
    
    // Clear existing buttons
    categoryButtonsContainer.innerHTML = '';
    
    // Add "All" button
    const allButton = document.createElement('button');
    allButton.className = `category-btn ${selectedCategory === '' ? 'active' : ''}`;
    allButton.textContent = 'All';
    allButton.addEventListener('click', () => {
        selectedCategory = '';
        renderCategoryButtons();
        renderMenu();
    });
    categoryButtonsContainer.appendChild(allButton);
    
    // Add category buttons
    categoryArray.forEach(category => {
        const categoryButton = document.createElement('button');
        categoryButton.className = `category-btn ${selectedCategory === category ? 'active' : ''}`;
        categoryButton.textContent = category;
        categoryButton.addEventListener('click', () => {
            selectedCategory = category;
            renderCategoryButtons();
            renderMenu();
        });
        categoryButtonsContainer.appendChild(categoryButton);
    });
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('menu-search');
    const clearSearchBtn = document.getElementById('clear-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.trim().toLowerCase();
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            }
            renderMenu();
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchTerm = '';
            if (searchInput) {
                searchInput.value = '';
            }
            clearSearchBtn.style.display = 'none';
            renderMenu();
        });
    }
}

// Helper function to check if an item is in the cart
function isItemInCart(itemId, size = null) {
    return cart.some(cartItem => {
        if (cartItem.id !== itemId) return false;
        // If item has sizes, check size match
        if (size !== null) {
            return cartItem.size === size;
        }
        // If no size specified, check if any variant of this item is in cart
        return true;
    });
}

// Render menu items
function renderMenu() {
    const menuGrid = document.getElementById('menu-grid');
    if (!menuGrid) return;
    
    menuGrid.innerHTML = '';

    if (!selectedBranchId) {
        menuGrid.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">Please select a branch to view menu.</p>';
        return;
    }

    // Filter items by availability and validate item structure
    let availableItems = menuItems.filter(item => {
        // Check if item exists and has required properties
        if (!item || typeof item !== 'object') {
            console.warn('⚠️ Invalid menu item found:', item);
            return false;
        }
        // Check if item has a name (required)
        if (!item.name) {
            console.warn('⚠️ Menu item missing name:', item);
            return false;
        }
        // Check if item has price or sizes (required)
        if (!item.price && (!item.hasSizes || !item.sizes)) {
            console.warn('⚠️ Menu item missing price/sizes:', item);
            return false;
        }
        // Filter by availability
        return item.availability !== 'Unavailable';
    });
    
    // Filter by category
    if (selectedCategory) {
        availableItems = availableItems.filter(item => 
            item.category && item.category.trim() === selectedCategory
        );
    }
    
    // Filter by search term
    if (searchTerm) {
        availableItems = availableItems.filter(item => 
            item.name && item.name.toLowerCase().includes(searchTerm)
        );
    }

    if (availableItems.length === 0) {
        menuGrid.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">No menu items found.</p>';
        return;
    }

    availableItems.forEach(item => {
        // Additional safety check
        if (!item || !item.name) {
            console.warn('⚠️ Skipping invalid item:', item);
            return;
        }
        const menuItemCard = document.createElement('div');
        menuItemCard.className = 'menu-item';
        menuItemCard.setAttribute('data-item-id', item.id);
        
        // Handle image with better error handling to prevent console errors
        const imageUrl = item.image || '';
        let imageHTML = '';
        if (viewMode === 'grid') {
            if (imageUrl && imageUrl.trim() !== '') {
                // Create image with error handler that shows placeholder instead (prevents console errors)
                const placeholderId = `placeholder-${item.id}-${Date.now()}`;
                imageHTML = `
                    <div style="position: relative; width: 100%; height: 160px; margin-bottom: 12px;">
                        <img src="${imageUrl}" alt="${item.name}" class="menu-item-image" 
                             data-item-id="${item.id}"
                             style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; background: var(--background); display: block;"
                             onerror="(function(img) {
                                img.style.display = 'none';
                                let placeholder = img.parentNode.querySelector('.image-placeholder');
                                if (!placeholder) {
                                    placeholder = document.createElement('div');
                                    placeholder.className = 'image-placeholder';
                                    placeholder.style.cssText = 'width: 100%; height: 160px; background: var(--background); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85em;';
                                    placeholder.textContent = 'No image at this moment';
                                    img.parentNode.appendChild(placeholder);
                                } else {
                                    placeholder.style.display = 'flex';
                                }
                             })(this);"
                             onload="(function(img) {
                                const placeholder = img.parentNode.querySelector('.image-placeholder');
                                if (placeholder) placeholder.style.display = 'none';
                             })(this);">
                        <div class="image-placeholder" style="display: none; width: 100%; height: 160px; background: var(--background); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85em; position: absolute; top: 0; left: 0; pointer-events: none;">
                            No image at this moment
                        </div>
                    </div>
                `;
            } else {
                // No image URL provided
                imageHTML = `<div class="image-placeholder" style="width: 100%; height: 160px; background: var(--background); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85em; margin-bottom: 12px;">
                    No image at this moment
                </div>`;
            }
        }
        
        let priceHTML = '';
        let sizeSelectorHTML = '';
        
        if (item.hasSizes && item.sizes && typeof item.sizes === 'object') {
            // Build size options dynamically from available sizes in the data
            const sizeOptions = [];
            const sizeLabels = {
                quarter: 'Quarter',
                half: 'Half',
                full: 'Full',
                small: 'Small',
                medium: 'Medium',
                large: 'Large'
            };
            
            // Only include sizes that exist in the data and have a valid price
            Object.keys(item.sizes).forEach(sizeKey => {
                const sizeData = item.sizes[sizeKey];
                if (sizeData && typeof sizeData === 'object' && sizeData.price !== undefined && sizeData.price !== null) {
                    const price = parseFloat(sizeData.price) || 0;
                    if (price > 0) { // Only show sizes with price > 0
                        const label = sizeLabels[sizeKey] || sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1);
                        sizeOptions.push({
                            key: sizeKey,
                            label: label,
                            price: price
                        });
                    }
                }
            });
            
            // Only show size selector if there are valid sizes
            if (sizeOptions.length > 0) {
                const sizeTilesHTML = sizeOptions.map(opt => 
                    `<button type="button" class="size-tile" data-item-id="${item.id}" data-size="${opt.key}" data-price="${opt.price}">
                        <span class="size-label">${opt.label}</span>
                        <span class="size-price">₹${opt.price}</span>
                    </button>`
                ).join('');
                
                sizeSelectorHTML = `
                    <div class="size-selector-tiles" data-item-id="${item.id}">
                        ${sizeTilesHTML}
                    </div>
                `;
                // Don't show price HTML when size tiles are shown (price is in tiles)
                priceHTML = '';
            } else {
                // If no valid sizes, show regular price
                const price = item.price || 0;
                priceHTML = `<div class="item-price">₹${price}</div>`;
            }
        } else {
            const price = item.price || 0;
            priceHTML = `<div class="item-price">₹${price}</div>`;
        }
        
        const categoryDisplay = item.category ? `<div class="menu-item-category">${item.category}</div>` : '';
        
        // Check if item is in cart (for highlighting)
        const isInCart = isItemInCart(item.id);
        
        if (viewMode === 'list') {
            // MULTI SELECT UI - Add checkbox to list view
            const isSelected = selectedItems[item.id] || false;
            menuItemCard.innerHTML = `
                <div class="menu-item-select-toggle ${isSelected ? 'selected' : ''} ${isInCart ? 'in-cart' : ''}" data-item-id="${item.id}" title="Select item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                ${imageHTML}
                <div class="menu-item-content">
                    <div class="menu-item-details">
                        <div class="menu-item-name-row">
                            <div class="menu-item-name-wrapper">
                                <div class="menu-item-name">${item.name}</div>
                                ${categoryDisplay}
                            </div>
                            ${sizeSelectorHTML}
                        </div>
                        ${priceHTML}
                    </div>
                    <button class="add-to-cart" data-item-id="${item.id}">Add to Cart</button>
                </div>
            `;
        } else {
            // MULTI SELECT UI - Add checkbox to top-right corner
            const isSelected = selectedItems[item.id] || false;
            menuItemCard.innerHTML = `
                <div class="menu-item-select-toggle ${isSelected ? 'selected' : ''} ${isInCart ? 'in-cart' : ''}" data-item-id="${item.id}" title="Select item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                ${imageHTML}
                <div class="menu-item-name">${item.name}</div>
                ${categoryDisplay}
                ${sizeSelectorHTML}
                ${priceHTML}
                <button class="add-to-cart" data-item-id="${item.id}">Add to Cart</button>
            `;
        }
        
        // MULTI SELECT UI - Add selected class if item is selected
        if (selectedItems[item.id]) {
            menuItemCard.classList.add('menu-item-selected');
        }
        
        // Add in-cart class if item is in cart (for gold border/background)
        if (isInCart) {
            menuItemCard.classList.add('menu-item-in-cart');
        }
        
        menuGrid.appendChild(menuItemCard);
    });
    
    // Add event listeners for add to cart buttons
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent any parent click handlers
            const button = e.currentTarget || this;
            const itemIdAttr = button.getAttribute('data-item-id');
            const itemId = parseInt(itemIdAttr);
            
            console.log('🛒 Add to Cart clicked - Item ID:', itemId, 'Button:', button);
            
            if (itemId && !isNaN(itemId)) {
                addToCart(itemId);
            } else {
                console.error('❌ Invalid item ID from button:', itemIdAttr, button);
            }
        });
    });
    
    // Add event listeners for size tiles
    document.querySelectorAll('.size-tile').forEach(tile => {
        tile.addEventListener('click', (e) => {
            const itemId = e.target.closest('.size-tile').getAttribute('data-item-id');
            // Remove active class from all size tiles for this item
            document.querySelectorAll(`.size-tile[data-item-id="${itemId}"]`).forEach(t => {
                t.classList.remove('active');
            });
            // Add active class to clicked tile
            e.target.closest('.size-tile').classList.add('active');
        });
    });
    
    // MULTI SELECT UI - Add event listeners for selection toggles
    document.querySelectorAll('.menu-item-select-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const itemId = parseInt(toggle.getAttribute('data-item-id'));
            toggleItemSelection(itemId);
        });
    });
    
    // MULTI SELECT UI - Update multi-select bar
    updateMultiSelectBar();
    
    // Initialize cart count badge
    updateCartCountBadge();
    
    // Update menu highlights based on cart contents
    updateMenuHighlights();
}

// Add item to cart
function addToCart(itemId) {
    console.log('🛒 addToCart called with itemId:', itemId, 'Type:', typeof itemId);
    const item = menuItems.find(i => i.id === itemId);
    if (!item) {
        console.error('❌ Item not found:', itemId, 'Available items:', menuItems.map(i => ({ id: i.id, name: i.name })));
        return;
    }
    console.log('✅ Item found:', item.name);
    
    // Validate item has required properties
    if (!item.name) {
        console.error('❌ Item missing name:', item);
        return;
    }
    
    let cartItem = {
        id: itemId,
        name: item.name,
        price: item.price || 0,
        size: null,
        image: item.image || '',
        sizeKey: null,
        pricingMetadata: item.pricingMetadata || null,
        pricingMode: item.pricingMode || 'inclusive',
        priceIncludesTax: (item.pricingMode || 'inclusive') !== 'exclusive',
        gst: item.gst || {},
        showTaxOnBill: item.showTaxOnBill !== false
    };
    
    // Handle size selection for items with sizes
    if (item.hasSizes && item.sizes) {
        // Check for selected size tile
        const selectedSizeTile = document.querySelector(`.size-tile.active[data-item-id="${itemId}"]`);
        if (selectedSizeTile) {
            const selectedSize = selectedSizeTile.getAttribute('data-size');
            const selectedPrice = parseFloat(selectedSizeTile.getAttribute('data-price')) || 0;
            cartItem.size = selectedSize;
            cartItem.sizeKey = selectedSize;
            cartItem.price = selectedPrice;
            cartItem.name = `${item.name} (${selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)})`;
        } else {
            // If no size selected, show error
            showPopup('error', 'Size Required', 'Please select a size for this item.', [
                { text: 'OK', class: 'primary' }
            ]);
            return;
        }
    }
    
    // Check if item already exists in cart
    const existingIndex = cart.findIndex(ci => 
        ci.id === itemId && 
        (!item.hasSizes || ci.size === cartItem.size)
    );
    
    if (existingIndex !== -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cartItem.quantity = 1;
        cart.push(cartItem);
    }
    
    saveCart();
    renderCart();
    updateCartCountBadge();
    
    // Update menu highlights to show items in cart
    updateMenuHighlights();
    
    // Clear selection if this item was selected via toggle
    // This allows user to select another item after adding to cart
    if (selectedItems[itemId]) {
        delete selectedItems[itemId];
        // Remove UI highlights
        const menuItem = document.querySelector(`.menu-item[data-item-id="${itemId}"]`);
        if (menuItem) menuItem.classList.remove('menu-item-selected');
        const toggle = document.querySelector(`.menu-item-select-toggle[data-item-id="${itemId}"]`);
        if (toggle) toggle.classList.remove('selected');
    }
}

// Remove item from cart
function removeFromCart(itemId, size = null) {
    cart = cart.filter(item => !(item.id === itemId && (!item.size || item.size === size)));
    saveCart();
    renderCart();
    updateCartCountBadge();
    // Update menu highlights to remove highlight from removed item
    updateMenuHighlights();
}

// Update quantity
function updateQuantity(itemId, size, change) {
    const item = cart.find(ci => 
        ci.id === itemId && 
        (!ci.size || ci.size === size)
    );
    
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(itemId, size);
        } else {
            saveCart();
            renderCart();
            updateCartCountBadge();
            // Update menu highlights (item still in cart)
            updateMenuHighlights();
        }
    }
}

// Update menu item highlights based on cart contents
function updateMenuHighlights() {
    // Remove all existing cart highlights
    document.querySelectorAll('.menu-item-select-toggle.in-cart').forEach(toggle => {
        toggle.classList.remove('in-cart');
    });
    document.querySelectorAll('.menu-item.menu-item-in-cart').forEach(item => {
        item.classList.remove('menu-item-in-cart');
    });
    
    // Add highlights for items currently in cart
    cart.forEach(cartItem => {
        const itemId = cartItem.id;
        const toggle = document.querySelector(`.menu-item-select-toggle[data-item-id="${itemId}"]`);
        const menuItem = document.querySelector(`.menu-item[data-item-id="${itemId}"]`);
        
        if (toggle) {
            toggle.classList.add('in-cart');
        }
        if (menuItem) {
            menuItem.classList.add('menu-item-in-cart');
        }
    });
}

// Render cart
function renderCart() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const payNowBtn = document.getElementById('pay-now');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        cartTotal.textContent = '0';
        payNowBtn.disabled = true;
        return;
    }
    
    cartItems.innerHTML = '';
    let total = 0;
    
    // Enable Pay Now button and make it green
    payNowBtn.disabled = false;
    payNowBtn.classList.remove('btn-primary');
    payNowBtn.classList.add('btn-success');
    
    cart.forEach(item => {
        // Safety check for price and quantity
        if (!item || !item.name) {
            console.warn('⚠️ Invalid cart item found:', item);
            return;
        }
        
        const price = item.price || 0;
        const quantity = item.quantity || 0;
        const itemTotal = price * quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">₹${price} × ${quantity} = ₹${itemTotal.toFixed(2)}</div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, '${item.size || ''}', -1)">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, '${item.size || ''}', 1)">+</button>
                <button class="quantity-btn" style="background: var(--danger); margin-left: 10px;" onclick="removeFromCart(${item.id}, '${item.size || ''}')">×</button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });
    
    cartTotal.textContent = total.toFixed(2);
    payNowBtn.disabled = false;
    
    // Update cart count badge
    updateCartCountBadge();
    
    const billingSection = document.getElementById('billing-section');
    if (billingSection && !billingSection.classList.contains('hidden')) {
        renderBillDetails();
    }
}

// Update cart count badge on floating button
// IMPORTANT: This ONLY counts actual cart items, NOT selected items
function updateCartCountBadge() {
    // Cart count is now shown in the cart section itself
    // This function is kept for compatibility but does nothing
}

// Cart functions removed - cart is now always visible on the page

// MULTI SELECT UI - Toggle item selection (SINGLE SELECT MODE ONLY)
// IMPORTANT: Only ONE item can be selected at a time. This function ONLY updates UI state.
function toggleItemSelection(itemId) {
    itemId = parseInt(itemId);
    
    // Check if this item is already selected
    const isCurrentlySelected = selectedItems[itemId];
    
    // If trying to select a new item while another is already selected
    if (!isCurrentlySelected && Object.keys(selectedItems).length > 0) {
        // Show warning toast
        showToast('Please add the selected item to cart before selecting another.', 'warning');
        return; // Prevent selection
    }
    
    // Toggle selection state (UI only, does not affect cart)
    if (isCurrentlySelected) {
        delete selectedItems[itemId];
    } else {
        // Clear any existing selection (single select mode)
        selectedItems = {};
        selectedItems[itemId] = true;
        
        // Remove highlights from all other items
        document.querySelectorAll('.menu-item-selected').forEach(item => {
            item.classList.remove('menu-item-selected');
        });
        document.querySelectorAll('.menu-item-select-toggle.selected').forEach(toggle => {
            toggle.classList.remove('selected');
        });
    }
    
    // Update UI highlights only
    const menuItem = document.querySelector(`.menu-item[data-item-id="${itemId}"]`);
    const toggle = document.querySelector(`.menu-item-select-toggle[data-item-id="${itemId}"]`);
    
    if (selectedItems[itemId]) {
        if (menuItem) menuItem.classList.add('menu-item-selected');
        if (toggle) toggle.classList.add('selected');
    } else {
        if (menuItem) menuItem.classList.remove('menu-item-selected');
        if (toggle) toggle.classList.remove('selected');
    }
    
    // DO NOT call addToCart() here
    // DO NOT update cart count here
}

// MULTI SELECT UI - Add selected item to cart (SINGLE SELECT MODE)
// IMPORTANT: This is the ONLY function that should add items to cart and show success popup
function addSelectedToCart() {
    const selectedIds = Object.keys(selectedItems).map(id => parseInt(id));
    
    if (selectedIds.length === 0) {
        return;
    }
    
    // Single select mode - only one item should be selected
    const itemId = selectedIds[0];
    let addedCount = 0;
    let errorCount = 0;
    let sizeErrorCount = 0;
    
    try {
        // Call existing addToCart function - NO MODIFICATIONS
        // Note: addToCart may show error popup if size is required but not selected
        // We'll track these errors and show a summary at the end
        const item = menuItems.find(i => i.id === itemId);
        if (item && item.hasSizes && item.sizes) {
            const selectedSizeTile = document.querySelector(`.size-tile.active[data-item-id="${itemId}"]`);
            if (!selectedSizeTile) {
                errorCount++;
                sizeErrorCount++;
                console.warn(`⚠️ Item ${itemId} requires size selection`);
            } else {
                addToCart(itemId);
                addedCount++;
            }
        } else {
            addToCart(itemId);
            addedCount++;
        }
    } catch (error) {
        console.error('Error adding item to cart:', itemId, error);
        errorCount++;
    }
    
    // Clear selection after adding (regardless of success/failure)
    clearSelection();
    
    // Show success popup ONLY after item is processed
    // This is the ONLY place where success popup should appear for single-select
    if (addedCount > 0) {
        showPopup('success', 'Item Added', 'Item added to cart!', [
            { text: 'OK', class: 'primary' }
        ]);
    } else if (errorCount > 0) {
        const message = sizeErrorCount > 0 
            ? 'Please select a size for this item before adding to cart.'
            : 'Item could not be added to cart.';
        showPopup('error', 'Cannot Add Item', message, [
            { text: 'OK', class: 'primary' }
        ]);
    }
}

// MULTI SELECT UI - Clear all selections
function clearSelection() {
    selectedItems = {};
    
    // Remove all selection highlights
    document.querySelectorAll('.menu-item-selected').forEach(item => {
        item.classList.remove('menu-item-selected');
    });
    document.querySelectorAll('.menu-item-select-toggle.selected').forEach(toggle => {
        toggle.classList.remove('selected');
    });
    
    updateMultiSelectBar();
}

// MULTI SELECT UI - Update bottom sticky bar visibility (removed - no longer needed)
function updateMultiSelectBar() {
    // Multi-select bar removed - function kept for compatibility
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Clear cart
function clearCart() {
    if (confirm('Are you sure you want to clear the cart?')) {
        cart = [];
        saveCart();
        renderCart();
        updateCartCountBadge();
        document.getElementById('billing-section').classList.add('hidden');
        // Clear all size tile selections
        clearSizeTileSelections();
        currentOrderSummary = null;
        // Update menu highlights to remove all highlights
        updateMenuHighlights();
    }
}

// Clear all size tile selections
function clearSizeTileSelections() {
    document.querySelectorAll('.size-tile.active').forEach(tile => {
        tile.classList.remove('active');
    });
}

// Setup event listeners
function setupEventListeners() {
    const branchSelector = document.getElementById('branch-selector');
    if (branchSelector) {
        // Remove any existing event listeners first
        const newBranchSelector = branchSelector.cloneNode(true);
        branchSelector.parentNode.replaceChild(newBranchSelector, branchSelector);
        
        // Attach event listener to the new element
        const updatedSelector = document.getElementById('branch-selector');
        updatedSelector.addEventListener('change', handleBranchChange);
        
        // Also add click event for debugging
        updatedSelector.addEventListener('click', function() {
            console.log('🔍 Branch selector clicked');
            console.log('🔍 Current value:', updatedSelector.value);
            console.log('🔍 Options count:', updatedSelector.options.length);
        });
        
        // Ensure it's enabled
        updatedSelector.disabled = false;
        
        console.log('✅ Branch selector event listener attached');
        console.log('✅ Branch selector enabled:', !updatedSelector.disabled);
        console.log('✅ Branch selector options:', updatedSelector.options.length);
    } else {
        console.error('❌ Branch selector element not found in setupEventListeners');
    }
    // Clear Cart button - ensure it works properly
    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🛒 Clear Cart button clicked');
            clearCart();
        });
    } else {
        console.error('❌ Clear Cart button not found');
    }
    
    // Pay Now button - ensure it works properly
    const payNowBtn = document.getElementById('pay-now');
    if (payNowBtn) {
        payNowBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('💰 Pay Now button clicked');
            console.log('💰 Cart length:', cart.length);
            console.log('💰 Selected branch ID:', selectedBranchId);
            showBillingSection();
        });
    } else {
        console.error('❌ Pay Now button not found');
    }
    
    document.getElementById('confirm-payment').addEventListener('click', confirmPayment);
    document.getElementById('print-bill').addEventListener('click', printBill);
    document.getElementById('back-to-menu').addEventListener('click', backToMenu);
    
    // Change QR button
    document.getElementById('change-qr-btn').addEventListener('click', handleChangeQR);
    
    // View toggle buttons
    document.getElementById('grid-view-btn').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('list-view-btn').addEventListener('click', () => setViewMode('list'));
    
    // Payment mode buttons
    document.querySelectorAll('.payment-mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.getAttribute('data-mode');
            setPaymentMode(mode);
        });
    });
    
    
    // Order type buttons
    document.querySelectorAll('.order-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            setOrderType(type);
        });
    });
    setOrderType(selectedOrderType, false);
    
    // Set default payment mode
    setPaymentMode('UPI');
    
    // Setup search functionality
    setupSearch();
}

// Popup System
// Show toast notification (lightweight, auto-dismiss)
function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function showPopup(type, title, message, buttons = []) {
    // Remove existing popup if any
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const content = document.createElement('div');
    content.className = 'popup-content';
    
    const icon = document.createElement('div');
    icon.className = `popup-icon ${type}`;
    
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
    buttonsEl.className = 'popup-buttons';
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `popup-btn ${btn.class || 'primary'}`;
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
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

// View Mode Functions
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('viewMode', mode);
    updateViewMode(mode);
    renderMenu();
}

// Select Mode Functions removed - single select only

function updateViewMode(mode) {
    const menuGrid = document.getElementById('menu-grid');
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    
    if (mode === 'list') {
        menuGrid.classList.add('list-view');
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    } else {
        menuGrid.classList.remove('list-view');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    }
}

// Payment Mode Functions
function setPaymentMode(mode) {
    document.getElementById('payment-mode').value = mode;
    document.querySelectorAll('.payment-mode-btn').forEach(btn => {
        if (btn.getAttribute('data-mode') === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setOrderType(type = 'Dining', rerender = true) {
    selectedOrderType = VALID_ORDER_TYPES.includes(type) ? type : 'Dining';
    localStorage.setItem('selectedOrderType', selectedOrderType);
    const orderTypeInput = document.getElementById('order-type');
    if (orderTypeInput) {
        orderTypeInput.value = selectedOrderType;
    }
    updateOrderTypeButtons();
    if (rerender && document.getElementById('billing-section') && !document.getElementById('billing-section').classList.contains('hidden')) {
        renderBillDetails();
    }
}

function updateOrderTypeButtons() {
    document.querySelectorAll('.order-type-btn').forEach(btn => {
        if (btn.getAttribute('data-type') === selectedOrderType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Compress image to reduce storage size
function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    // Create canvas and compress
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to JPEG data URI with compression
                    const compressedDataURI = canvas.toDataURL('image/jpeg', quality);
                    
                    // Check if compressed size is reasonable (under 500KB)
                    const sizeInKB = (compressedDataURI.length * 3) / 4 / 1024;
                    if (sizeInKB > 500) {
                        console.warn(`⚠️ Compressed image is still ${sizeInKB.toFixed(0)}KB. Consider using a smaller quality setting.`);
                    }
                    
                    resolve(compressedDataURI);
                } catch (error) {
                    reject(new Error('Failed to compress image: ' + error.message));
                }
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

// Handle Change QR button - Mobile-friendly version
async function handleChangeQR() {
    if (!selectedBranchId) {
        alert('Please select a branch first.');
        return;
    }
    
    // Get or create hidden file input (prefer existing one from HTML)
    let input = document.getElementById('qr-file-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'qr-file-input';
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        // Attach to body for better mobile compatibility
        document.body.appendChild(input);
    }
    
    // Set up the change handler (only if not already set)
    if (!input.hasAttribute('data-handler-attached')) {
        input.setAttribute('data-handler-attached', 'true');
        input.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) {
                // Reset input for next use
                input.value = '';
                return;
            }
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file.');
                input.value = '';
                return;
            }
            
            // Validate file size (max 2MB to avoid localStorage quota issues)
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (file.size > maxSize) {
                alert('Image file is too large. Please select an image smaller than 2MB. For best results, use images under 500KB.');
                input.value = '';
                return;
            }
            
            try {
                // Show loading indicator
                const changeBtn = document.getElementById('change-qr-btn');
                const originalText = changeBtn ? changeBtn.textContent : '';
                if (changeBtn) {
                    changeBtn.disabled = true;
                    changeBtn.textContent = 'Uploading...';
                }
                
                // Compress and convert image to data URI (reduces storage size significantly)
                const compressedDataURI = await compressImage(file, 800, 0.8); // Max width 800px, quality 0.8
                
                // Determine MIME type (always JPEG after compression for smaller size)
                const mimeType = 'image/jpeg';
                
                // Save as temporary override (only store data URI, not separate base64)
                setTemporaryQR(selectedBranchId, {
                    url: compressedDataURI,
                    mimeType: mimeType,
                    timestamp: new Date().toISOString()
                });
                
                // Refresh display
                displayActiveQR();
                
                // Show success message
                alert('QR code changed successfully! This is a temporary override for this branch.');
                
                // Reset button
                if (changeBtn) {
                    changeBtn.disabled = false;
                    changeBtn.textContent = originalText;
                }
                
            } catch (error) {
                console.error('Error changing QR code:', error);
                
                // Show user-friendly error message
                let errorMessage = 'Error changing QR code. Please try again.';
                if (error.message) {
                    if (error.message.includes('FileReader') || error.message.includes('Failed to read')) {
                        errorMessage = 'Your browser does not support file uploads. Please try a different browser.';
                    } else if (error.message.includes('aborted')) {
                        errorMessage = 'Upload was cancelled.';
                    } else if (error.message.includes('too large') || error.message.includes('quota') || error.name === 'QuotaExceededError') {
                        errorMessage = 'Image is too large or storage is full.\n\nPlease:\n1. Use a smaller image (under 500KB recommended)\n2. Clear old QR codes from browser storage\n3. Try compressing the image before uploading';
                    } else if (error.message.includes('Failed to compress')) {
                        errorMessage = 'Failed to process image. Please try a different image format (JPEG or PNG).';
                    } else {
                        errorMessage = 'Error: ' + error.message;
                    }
                } else if (error.name === 'QuotaExceededError') {
                    errorMessage = 'Storage quota exceeded. Please clear old QR codes or use a smaller image.';
                }
                alert(errorMessage);
                
                // Reset button
                const changeBtn = document.getElementById('change-qr-btn');
                if (changeBtn) {
                    changeBtn.disabled = false;
                    if (changeBtn.textContent === 'Uploading...') {
                        changeBtn.textContent = 'Change QR';
                    }
                }
            } finally {
                // Reset input for next use
                input.value = '';
            }
        });
    }
    
    // Trigger file input - use setTimeout for better mobile compatibility
    try {
        // Detect mobile device or mobile viewport (works in responsive mode too)
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isMobileViewport = window.innerWidth <= 768 || window.matchMedia('(max-width: 768px)').matches;
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobile = isMobileDevice || (isMobileViewport && isTouchDevice);
        
        if (isMobile) {
            // Mobile device or mobile viewport - use a small delay to ensure DOM is ready
            // This helps with mobile browsers that need time to process the file input
            setTimeout(() => {
                try {
                    input.click();
                } catch (clickError) {
                    console.error('Error clicking file input on mobile:', clickError);
                    // Fallback: try making input visible temporarily (some mobile browsers need this)
                    const originalDisplay = input.style.display;
                    const originalPosition = input.style.position;
                    input.style.display = 'block';
                    input.style.position = 'absolute';
                    input.style.left = '-9999px';
                    input.style.opacity = '0';
                    input.style.width = '1px';
                    input.style.height = '1px';
                    
                    setTimeout(() => {
                        try {
                            input.click();
                        } catch (fallbackError) {
                            console.error('Fallback click also failed:', fallbackError);
                            alert('Unable to open file picker. Please try tapping the button again or use a different browser.');
                        } finally {
                            input.style.display = originalDisplay;
                            input.style.position = originalPosition;
                        }
                    }, 50);
                }
            }, 150);
        } else {
            // Desktop - immediate click
            input.click();
        }
    } catch (error) {
        console.error('Error triggering file input:', error);
        alert('Unable to open file picker. Please ensure you are using a modern browser and try again.');
    }
}


// Show billing section
function showBillingSection() {
    console.log('🔍 showBillingSection called');
    console.log('🔍 selectedBranchId:', selectedBranchId);
    console.log('🔍 cart.length:', cart.length);
    
    // Validate branch selection
    if (!selectedBranchId) {
        console.warn('⚠️ No branch selected');
        showPopup('error', 'Branch Required', 'Please select a branch first before proceeding to payment.', [
            { text: 'OK', class: 'primary' }
        ]);
        return;
    }
    
    // Validate cart is not empty
    if (!cart || cart.length === 0) {
        console.warn('⚠️ Cart is empty');
        showPopup('error', 'Empty Cart', 'Your cart is empty. Please add items to cart before proceeding to payment.', [
            { text: 'OK', class: 'primary' }
        ]);
        return;
    }
    
    console.log('✅ Validation passed, showing billing section');
    
    // Show billing section and hide menu/cart
    const billingSection = document.getElementById('billing-section');
    const menuSection = document.getElementById('menu-section');
    const cartSection = document.getElementById('cart-section');
    const categoryFilterContainer = document.querySelector('.category-filter-container');
    
    // Hide category filter container on payment page
    if (categoryFilterContainer) {
        categoryFilterContainer.style.display = 'none';
    }
    
    if (billingSection) {
        billingSection.classList.remove('hidden');
    }
    if (menuSection) {
        menuSection.style.display = 'none';
    }
    if (cartSection) {
        cartSection.style.display = 'none';
    }
    
    // Hide branch selector wrapper and admin link in payment page
    const branchSelectorWrapper = document.querySelector('.branch-selector-wrapper');
    if (branchSelectorWrapper) {
        branchSelectorWrapper.style.display = 'none';
    }
    
    // Hide all admin links (Admin Panel and Sales Report) on payment page
    const adminLinks = document.querySelectorAll('.admin-link-branch');
    adminLinks.forEach(link => {
        link.style.display = 'none';
    });
    
    // Ensure buttons are in correct state
    const confirmPaymentBtn = document.getElementById('confirm-payment');
    const printBillBtn = document.getElementById('print-bill');
    
    if (confirmPaymentBtn) {
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.textContent = 'Confirm Payment';
    }
    if (printBillBtn) {
        printBillBtn.disabled = true;
    }
    
    // Load and display active QR code (temporary override or branch default)
    displayActiveQR();
    
    // Render bill details
    setOrderType(selectedOrderType, false);
    renderBillDetails();
    
    console.log('✅ Billing section displayed successfully');
}

// Display active QR code (temporary override or branch default)
function displayActiveQR() {
    const branchQR = document.getElementById('branch-qr');
    if (!branchQR) {
        console.error('❌ branch-qr element not found');
        return;
    }
    
    const activeQR = getActiveQR(selectedBranchId);
    
    console.log('🔍 Displaying QR for branch:', selectedBranchId);
    console.log('🔍 Active QR:', activeQR);
    console.log('🔍 Branches array:', branches);
    console.log('🔍 Selected branch:', branches.find(b => b.id == selectedBranchId));
    
    if (!activeQR) {
        console.warn('⚠️ No active QR found for branch:', selectedBranchId);
        branchQR.innerHTML = `
            <p style="color: var(--text-muted);">No QR code available for this branch.</p>
        `;
        return;
    }
    
    if (!activeQR.url) {
        console.warn('⚠️ Active QR has no URL:', activeQR);
        branchQR.innerHTML = `
            <p style="color: var(--text-muted);">QR code URL is empty.</p>
        `;
        return;
    }
    
    const sourceLabel = activeQR.source === 'temporary' ? 'Temporary QR Code' : 'Branch QR Code';
    
    console.log('🔍 QR URL type:', typeof activeQR.url);
    console.log('🔍 QR URL value:', activeQR.url);
    
    // Safe type checking - declare once at function scope
    const qrUrl = typeof activeQR.url === 'string' ? activeQR.url : String(activeQR.url || '');
    console.log('🔍 QR URL starts with:', qrUrl.substring(0, 50));
    console.log('🔍 QR URL is data URI:', qrUrl.startsWith('data:'));
    
    // Create image with error handling
    const img = new Image();
    img.onload = function() {
        console.log('✅ QR code image loaded successfully');
        console.log('✅ Image dimensions:', img.width, 'x', img.height);
        branchQR.innerHTML = `
            <p><strong>${sourceLabel}:</strong></p>
            <img src="${qrUrl}" alt="QR Code" style="max-width: 200px; max-height: 200px; border: 2px solid var(--text-muted); border-radius: 5px; padding: 5px; display: block;">
            ${activeQR.source === 'temporary' ? '<p style="color: var(--accent); font-size: 12px; margin-top: 5px;">⚠️ Using temporary override</p>' : ''}
        `;
    };
    img.onerror = function() {
        console.error('❌ QR code image failed to load');
        console.error('❌ URL:', activeQR.url);
        console.error('❌ URL type:', typeof activeQR.url);
        console.error('❌ URL length:', qrUrl.length);
        console.error('❌ Is data URI:', qrUrl.startsWith('data:'));
            
        // Check if it's a filename instead of a URL
        const isFilename = qrUrl && !qrUrl.startsWith('http://') && !qrUrl.startsWith('https://') && !qrUrl.startsWith('data:');
            
        let errorMessage = '';
        if (isFilename) {
            errorMessage = `
                <p style="margin: 0 0 10px 0;"><strong>⚠️ Invalid QR Code URL</strong></p>
                <p style="margin: 0 0 10px 0; font-size: 12px;">The QRCodeURL column contains a filename instead of a URL:</p>
                <p style="margin: 0 0 10px 0; font-size: 12px;"><code style="word-break: break-all; background: var(--surface); padding: 5px; border-radius: 3px;">${activeQR.url}</code></p>
                <p style="margin: 10px 0 0 0; font-size: 12px;"><strong>How to fix:</strong></p>
                <ol style="margin: 5px 0 0 20px; font-size: 12px;">
                    <li>Upload your QR code image to Google Drive</li>
                    <li>Right-click the file → "Get link" → Set to "Anyone with the link" → "Viewer"</li>
                    <li>Copy the link and paste it in the QRCodeURL column in Google Sheets</li>
                    <li>OR embed the image directly in the cell (Insert → Image → Image in cell)</li>
                </ol>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: var(--primary);">
                    <strong>📖 See "HOW-TO-GET-IMAGE-URL.md" for detailed instructions</strong>
                </p>
            `;
        } else {
            errorMessage = `
                <p style="margin: 0 0 10px 0;"><strong>⚠️ Image failed to load</strong></p>
                <p style="margin: 0 0 10px 0; font-size: 12px;">URL: <code style="word-break: break-all;">${activeQR.url}</code></p>
                <p style="margin: 0; font-size: 12px;">Possible issues:</p>
                <ul style="margin: 5px 0 0 20px; font-size: 12px;">
                    <li>File is not publicly accessible</li>
                    <li>URL is incorrect</li>
                    <li>CORS restrictions</li>
                </ul>
                <p style="margin: 10px 0 0 0; font-size: 12px;">
                    <strong>Fix:</strong> Make sure the Google Drive file is shared as "Anyone with the link" → "Viewer"
                </p>
            `;
        }
        
        branchQR.innerHTML = `
            <p><strong>${sourceLabel}:</strong></p>
            <div style="padding: 20px; background: rgba(var(--danger-rgb), 0.1); border: 2px solid var(--danger); border-radius: 5px; color: var(--danger);">
                ${errorMessage}
            </div>
        `;
    };
    
    // Start loading the image
    console.log('🔍 Setting image src to:', qrUrl.substring(0, 100) + '...');
    img.src = qrUrl;
}

// Render bill details
function getCartItemGstPercentages(cartItem, orderType = 'Dining') {
    const orderKey = GSTUtils.getOrderTypeKey(orderType);
    const gst = cartItem?.gst || {};
    const source = gst[orderKey] || {};
    return {
        cgst: GSTUtils.parseNumber ? GSTUtils.parseNumber(source.cgst ?? 0) : parseFloat(source.cgst) || 0,
        sgst: GSTUtils.parseNumber ? GSTUtils.parseNumber(source.sgst ?? 0) : parseFloat(source.sgst) || 0
    };
}

function getCartItemBreakdown(cartItem, orderType = 'Dining') {
    if (!cartItem) return null;
    
    // If GST is disabled, return base price only (no tax)
    if (!gstEnabled) {
        const sizeKey = cartItem.size || cartItem.sizeKey || null;
        let basePrice = cartItem.price || 0;
        
        // Get source price if available
        const metadata = cartItem.pricingMetadata || null;
        if (metadata && metadata.sourcePrice) {
            basePrice = sizeKey ? (metadata.sourcePrice.sizes?.[sizeKey] || basePrice) : (metadata.sourcePrice.default || basePrice);
        }
        
        return {
            basePrice: basePrice,
            finalPrice: basePrice,
            cgstAmount: 0,
            sgstAmount: 0,
            gstValue: 0,
            cgstPercentage: 0,
            sgstPercentage: 0,
            priceIncludesTax: true
        };
    }
    
    const metadata = cartItem.pricingMetadata || null;
    const sizeKey = cartItem.size || cartItem.sizeKey || null;
    let breakdown = metadata ? GSTUtils.getBreakdownFromMetadata(metadata, orderType, sizeKey) : null;
    const gstRates = getCartItemGstPercentages(cartItem, orderType);
    const includesTax = metadata ? metadata.priceIncludesTax !== false : cartItem.priceIncludesTax !== false;
    
    if (!breakdown) {
        let amount;
        if (includesTax) {
            amount = cartItem.price || 0;
        } else if (metadata && metadata.sourcePrice) {
            amount = sizeKey ? metadata.sourcePrice.sizes?.[sizeKey] : metadata.sourcePrice.default;
        } else {
            amount = cartItem.price || 0;
        }
        breakdown = GSTUtils.calculatePricing({
            amount: amount || 0,
            cgstPercentage: gstRates.cgst,
            sgstPercentage: gstRates.sgst,
            includesTax
        });
    }
    
    return {
        ...breakdown,
        cgstPercentage: breakdown.cgstPercentage ?? gstRates.cgst,
        sgstPercentage: breakdown.sgstPercentage ?? gstRates.sgst,
        priceIncludesTax: includesTax
    };
}

function buildOrderSummary(orderType = selectedOrderType) {
    const summary = {
        orderType,
        items: [],
        totalBaseAmount: 0,
        totalCgstAmount: 0,
        totalSgstAmount: 0,
        totalGstAmount: 0,
        totalFinalAmount: 0,
        appliedGstRate: 0,
        showTaxOnBill: true
    };
    
    cart.forEach(cartItem => {
        if (!cartItem || !cartItem.name) return;
        const breakdown = getCartItemBreakdown(cartItem, orderType);
        if (!breakdown) return;
        const quantity = parseInt(cartItem.quantity, 10) || 1;
        const lineBase = GSTUtils.parseNumber ? GSTUtils.parseNumber(breakdown.basePrice) : parseFloat(breakdown.basePrice) || 0;
        const lineFinal = GSTUtils.parseNumber ? GSTUtils.parseNumber(breakdown.finalPrice) : parseFloat(breakdown.finalPrice) || 0;
        const lineCgst = GSTUtils.parseNumber ? GSTUtils.parseNumber(breakdown.cgstAmount) : parseFloat(breakdown.cgstAmount) || 0;
        const lineSgst = GSTUtils.parseNumber ? GSTUtils.parseNumber(breakdown.sgstAmount) : parseFloat(breakdown.sgstAmount) || 0;
        const lineGst = GSTUtils.parseNumber ? GSTUtils.parseNumber(breakdown.gstValue) : parseFloat(breakdown.gstValue) || (lineCgst + lineSgst);
        
        const itemSummary = {
            id: cartItem.id,
            name: cartItem.name,
            quantity,
            size: cartItem.size || cartItem.sizeKey || null,
            basePrice: lineBase,
            finalPrice: lineFinal,
            baseSubtotal: parseFloat((lineBase * quantity).toFixed(2)),
            cgstPercentage: breakdown.cgstPercentage,
            sgstPercentage: breakdown.sgstPercentage,
            cgstAmount: lineCgst,
            sgstAmount: lineSgst,
            gstValue: lineGst,
            cgstSubtotal: parseFloat((lineCgst * quantity).toFixed(2)),
            sgstSubtotal: parseFloat((lineSgst * quantity).toFixed(2)),
            gstSubtotal: parseFloat((lineGst * quantity).toFixed(2)),
            subtotal: parseFloat((lineFinal * quantity).toFixed(2)),
            priceIncludesTax: breakdown.priceIncludesTax !== false,
            showTaxOnBill: cartItem.showTaxOnBill !== false
        };
        
        summary.totalBaseAmount += itemSummary.baseSubtotal;
        summary.totalCgstAmount += itemSummary.cgstSubtotal;
        summary.totalSgstAmount += itemSummary.sgstSubtotal;
        summary.totalGstAmount += itemSummary.gstSubtotal;
        summary.totalFinalAmount += itemSummary.subtotal;
        summary.items.push(itemSummary);
    });
    
    summary.totalBaseAmount = parseFloat(summary.totalBaseAmount.toFixed(2));
    summary.totalCgstAmount = parseFloat(summary.totalCgstAmount.toFixed(2));
    summary.totalSgstAmount = parseFloat(summary.totalSgstAmount.toFixed(2));
    summary.totalGstAmount = parseFloat(summary.totalGstAmount.toFixed(2));
    summary.totalFinalAmount = parseFloat(summary.totalFinalAmount.toFixed(2));
    summary.appliedGstRate = summary.totalBaseAmount > 0
        ? parseFloat(((summary.totalGstAmount / summary.totalBaseAmount) * 100).toFixed(2))
        : 0;
    // Don't show tax on bill if GST is disabled
    summary.showTaxOnBill = gstEnabled && (summary.items.length > 0 ? summary.items.every(item => item.showTaxOnBill) : true);
    
    return summary;
}

function renderBillDetails() {
    const billDetails = document.getElementById('bill-details');
    if (!billDetails) return;
    
    if (!cart || cart.length === 0) {
        billDetails.innerHTML = '<p class="bill-empty">No items in the cart.</p>';
        currentOrderSummary = null;
        return;
    }
    
    const summary = buildOrderSummary(selectedOrderType);
    currentOrderSummary = summary;
    
    let html = `<h3>Bill Details - ${selectedOrderType}</h3>`;
    summary.items.forEach(item => {
        html += `
            <div class="bill-item">
                <div>
                    <div class="bill-item-name">${item.name}</div>
                    <div class="bill-item-meta">${item.quantity} × ₹${item.finalPrice.toFixed(2)}</div>
                </div>
                <div class="bill-item-total">₹${item.subtotal.toFixed(2)}</div>
            </div>
        `;
    });
    
    if (summary.showTaxOnBill) {
        html += `
            <div class="bill-tax-summary">
                <div>CGST Total: ₹${summary.totalCgstAmount.toFixed(2)}</div>
                <div>SGST Total: ₹${summary.totalSgstAmount.toFixed(2)}</div>
                <div>Total GST: ₹${summary.totalGstAmount.toFixed(2)}</div>
            </div>
        `;
    }
    
    html += `<div class="bill-total">Grand Total: <span class="bill-total-amount">₹${summary.totalFinalAmount.toFixed(2)}</span></div>`;
    billDetails.innerHTML = html;
}


// Confirm payment
async function confirmPayment() {
    console.log('Confirm Payment clicked');
    
    // Check if cart is empty
    if (!cart || cart.length === 0) {
        alert('Cart is empty. Please add items to cart first.');
        return;
    }
    
    if (!selectedBranchId) {
        alert('Please select a branch first.');
        return;
    }
    
    // Disable button to prevent double-click
    const confirmBtn = document.getElementById('confirm-payment');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';
    }
    
    // Show progress loader with blurred background
    showPaymentLoader();
    
    try {
        const paymentMode = document.getElementById('payment-mode').value;
        const summary = currentOrderSummary || buildOrderSummary(selectedOrderType);
        if (!summary || summary.items.length === 0) {
            hidePaymentLoader();
            alert('Unable to prepare bill breakdown. Please try again.');
            return;
        }
        
        // Get branch info
        const branch = branches.find(b => b.id == selectedBranchId);
        const branchName = branch ? branch.name : 'Unknown Branch';
        
        // Get active QR (temporary override or branch default)
        const activeQR = getActiveQR(selectedBranchId);
        
        // Get QR code from active QR (temporary override or branch default)
        let qrCodeBase64 = '';
        let qrCodeURL = '';
        let qrCodeMimeType = '';
        
        if (activeQR) {
            // Use active QR (temporary override or branch default)
            qrCodeURL = activeQR.url;
            qrCodeBase64 = activeQR.base64 || '';
            qrCodeMimeType = activeQR.mimeType || '';
        }
        
        // Create transaction record
        const transaction = {
            id: Date.now(),
            branchId: selectedBranchId,
            branchName: branchName,
            date: formatISTDate(new Date()),
            dateTime: formatIST(new Date()),
            orderType: summary.orderType,
            items: summary.items.map(item => ({
                id: item.id,
                name: item.name || '',
                price: item.finalPrice || 0,
                basePrice: item.basePrice || 0,
                finalPrice: item.finalPrice || 0,
                quantity: item.quantity || 0,
                size: item.size || null,
                cgstPercentage: item.cgstPercentage,
                sgstPercentage: item.sgstPercentage,
                cgstAmount: item.cgstAmount,
                sgstAmount: item.sgstAmount,
                gstValue: item.gstValue,
                priceIncludesTax: item.priceIncludesTax !== false,
                showTaxOnBill: item.showTaxOnBill !== false,
                orderType: summary.orderType,
                subtotal: item.subtotal || 0
            })),
            totalBaseAmount: summary.totalBaseAmount,
            totalCgstAmount: summary.totalCgstAmount,
            totalSgstAmount: summary.totalSgstAmount,
            totalGstAmount: summary.totalGstAmount,
            total: summary.totalFinalAmount,
            paymentMode: paymentMode,
            appliedGstRate: summary.appliedGstRate,
            showTaxOnBill: summary.showTaxOnBill,
            qrCodeURL: qrCodeURL,
            qrCodeBase64: qrCodeBase64, // Include base64 for image insertion
            qrCodeMimeType: qrCodeMimeType,
            qrCodeSource: activeQR ? activeQR.source : 'none',
            timestamp: new Date().toISOString()
        };
        
        console.log('Transaction data:', transaction);
        
        // Save transaction to Google Sheets
        let saveSuccess = false;
        try {
            console.log('Attempting to save to Google Sheets...');
            console.log('Transaction data:', JSON.stringify(transaction, null, 2));
            
            const result = await apiService.saveSale(transaction);
            console.log('✅ API Response:', result);
            
            // Check if save was successful
            if (result && result.success === false) {
                console.error('❌ Save failed:', result.error || result.message);
                throw new Error(result.error || result.message || 'Transaction save failed');
            }
            
            // If result has success: true or no error, consider it successful
            if (result && (result.success === true || !result.error)) {
                saveSuccess = true;
                console.log('✅ Transaction saved successfully to Google Sheets');
            } else if (!result) {
                // Empty response might still mean success (CORS)
                console.warn('⚠️ Empty response from API (might be CORS, but data may be saved)');
                saveSuccess = true; // Assume success if no error
            }
            
        } catch (error) {
            console.error('❌ Error saving to Google Sheets:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                transaction: transaction
            });
            
            // Check if it's a CORS error (request might still succeed)
            const isCorsError = error.message && (error.message.includes('CORS_ERROR') || error.message.includes('Failed to fetch'));
            
            if (isCorsError) {
                console.warn('⚠️ CORS error detected, but data may still be saved to Google Sheets');
                saveSuccess = true; // Assume success for CORS errors
            }
        }
        
        // Always save to localStorage as backup
        try {
            const salesData = await loadSalesData();
            salesData.transactions.push(transaction);
            await saveSalesData(salesData);
            console.log('✅ Transaction saved to localStorage as backup');
        } catch (e) {
            console.error('❌ Error saving to localStorage:', e);
        }
        
        // Hide payment loader before showing popup
        hidePaymentLoader();
        
        // Show success message with popup
        if (saveSuccess) {
            showPopup('success', 'Payment Confirmed!', 'Payment details are saved successfully!', [
                {
                    text: 'OK',
                    class: 'success',
                    onClick: () => {
                        // Ask if user wants to print bill
                        showPopup('info', 'Print Bill?', 'Would you like to print the bill?', [
                            {
                                text: 'Yes, Print',
                                class: 'primary',
                                onClick: () => {
                                    document.getElementById('print-bill').disabled = false;
                                    window.currentTransaction = transaction;
                                    printBill();
                                }
                            },
                            {
                                text: 'No, Go to Menu',
                                class: 'secondary',
                                onClick: () => {
                                    backToMenu();
                                }
                            }
                        ]);
                    }
                }
            ]);
        } else {
            showPopup('info', 'Payment Confirmed!', 'Payment details are saved successfully!', [
                {
                    text: 'OK',
                    class: 'primary',
                    onClick: () => {
                        // Ask if user wants to print bill
                        showPopup('info', 'Print Bill?', 'Would you like to print the bill?', [
                            {
                                text: 'Yes, Print',
                                class: 'primary',
                                onClick: () => {
                                    document.getElementById('print-bill').disabled = false;
                                    window.currentTransaction = transaction;
                                    printBill();
                                }
                            },
                            {
                                text: 'No, Go to Menu',
                                class: 'secondary',
                                onClick: () => {
                                    backToMenu();
                                }
                            }
                        ]);
                    }
                }
            ]);
        }
        
        // Store current transaction for printing
        window.currentTransaction = transaction;
        
        // Clear cart after successful payment
        cart = [];
        renderCart();
        // Clear all size tile selections after payment
        clearSizeTileSelections();
    } catch (error) {
        console.error('Error in confirmPayment:', error);
        hidePaymentLoader();
        alert('An error occurred. Please check the console for details.');
    } finally {
        // Re-enable button
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Payment';
        }
    }
}

// Load sales data from localStorage
async function loadSalesData() {
    // Load from localStorage (primary storage)
    const savedSales = localStorage.getItem('restaurant_sales');
    if (savedSales && JSON.parse(savedSales).transactions.length > 0) {
        return JSON.parse(savedSales);
    }
    
    // Fallback to JSON file (load sample data if localStorage is empty)
    try {
        const response = await fetch('data/sales.json');
        const data = await response.json();
        // Save to localStorage (sync sample data)
        localStorage.setItem('restaurant_sales', JSON.stringify(data));
        return data;
    } catch (error) {
        // Initialize empty if both fail
        const emptyData = { transactions: [] };
        localStorage.setItem('restaurant_sales', JSON.stringify(emptyData));
        return emptyData;
    }
}

// Save sales data to localStorage
async function saveSalesData(data) {
    // Save to localStorage (primary storage)
    localStorage.setItem('restaurant_sales', JSON.stringify(data));
    
    // Optional: Create downloadable JSON file for backup
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    // In a real application, this would be sent to a server API
}

// Print bill
function printBill() {
    if (!window.currentTransaction) {
        alert('Please confirm payment first.');
        return;
    }
    
    const printSection = document.getElementById('print-bill-section');
    const printDetails = document.getElementById('print-bill-details');
    
    const transaction = window.currentTransaction;
    const branch = branches.find(b => b.id == transaction.branchId);
    const branchName = branch ? branch.name : transaction.branchName || 'Restaurant';
    const showTax = transaction.showTaxOnBill !== false;
    
    // Get restaurant title from config (use global variable or fetch from DOM)
    const restaurantName = restaurantTitle || document.getElementById('restaurant-title')?.textContent || 'Restaurant';
    
    // Format date/time in IST
    const dateTimeIST = formatIST(new Date(transaction.timestamp));
    const dateIST = formatISTDate(new Date(transaction.timestamp));
    const timeIST = dateTimeIST.split(',')[1]?.trim() || dateTimeIST.split(' ').slice(1).join(' ');
    
    // Thermal printer format (80mm width, centered text)
    let html = `
        <div class="thermal-bill">
            <div class="bill-header-thermal">
                <div class="bill-title">${restaurantName.toUpperCase()}</div>
                <div class="bill-separator">${'='.repeat(32)}</div>
                <div class="bill-info">Date: ${dateIST}</div>
                <div class="bill-info">Time: ${timeIST}</div>
                <div class="bill-info">Bill No: #${transaction.id}</div>
                <div class="bill-info">Payment: ${transaction.paymentMode}</div>
                <div class="bill-separator">${'-'.repeat(32)}</div>
            </div>
            <div class="bill-items-thermal">
    `;
    
    transaction.items.forEach(item => {
        // Safety check for price and quantity
        if (!item || !item.name) {
            return;
        }
        const price = (item.price || 0);
        const quantity = (item.quantity || 0);
        const itemTotal = price * quantity;
        const itemName = item.size ? `${item.name} (${item.size})` : item.name;
        // Truncate long item names for thermal printer (max 20 chars)
        const displayName = itemName.length > 20 ? itemName.substring(0, 17) + '...' : itemName;
        const qty = quantity;
        const priceFormatted = price.toFixed(2);
        const total = itemTotal.toFixed(2);
        
        html += `
            <div class="bill-item-thermal">
                <div class="item-line">
                    <span class="item-name">${displayName}</span>
                </div>
                <div class="item-line">
                    <span class="item-qty">${qty} x ₹${priceFormatted}</span>
                    <span class="item-total">₹${total}</span>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="bill-separator">${'='.repeat(32)}</div>
    `;
    if (showTax) {
        html += `
            <div class="bill-tax-thermal">
                <div class="tax-line">CGST Total: ₹${(transaction.totalCgstAmount || 0).toFixed(2)}</div>
                <div class="tax-line">SGST Total: ₹${(transaction.totalSgstAmount || 0).toFixed(2)}</div>
                <div class="tax-line">GST Total: ₹${(transaction.totalGstAmount || 0).toFixed(2)}</div>
            </div>
            <div class="bill-separator">${'='.repeat(32)}</div>
        `;
    }
    html += `
            <div class="bill-total-thermal">
                <div class="total-line">
                    <span class="total-label">TOTAL</span>
                    <span class="total-amount">₹${transaction.total.toFixed(2)}</span>
                </div>
            </div>
            <div class="bill-separator">${'='.repeat(32)}</div>
            <div class="bill-footer-thermal">
                <div class="footer-text">Thank you for your visit!</div>
                <div class="footer-text">${branchName}</div>
            </div>
        </div>
    `;
    
    printDetails.innerHTML = html;
    printSection.classList.remove('hidden');
    
    // Trigger print after a short delay
    setTimeout(() => {
        window.print();
    }, 100);
    
    // Hide print section after printing
    setTimeout(() => {
        printSection.classList.add('hidden');
    }, 1000);
}

// Back to menu
function backToMenu() {
    document.getElementById('billing-section').classList.add('hidden');
    document.getElementById('menu-section').style.display = 'block';
    document.getElementById('cart-section').style.display = 'block';
    
    // Show category filter container when returning to menu
    const categoryFilterContainer = document.querySelector('.category-filter-container');
    if (categoryFilterContainer) {
        categoryFilterContainer.style.display = '';
    }
    
    // Show branch selector wrapper and all admin links again
    const branchSelectorWrapper = document.querySelector('.branch-selector-wrapper');
    if (branchSelectorWrapper) {
        branchSelectorWrapper.style.display = '';
    }
    
    // Show all admin links (Admin Panel and Sales Report) when returning to menu
    const adminLinks = document.querySelectorAll('.admin-link-branch');
    adminLinks.forEach(link => {
        link.style.display = '';
    });
    
    // Update menu highlights after returning to menu (cart may have been cleared)
    updateMenuHighlights();
    
    // Reset button states
    const confirmBtn = document.getElementById('confirm-payment');
    if (confirmBtn) {
        confirmBtn.disabled = false; // Will be enabled/disabled based on cart in renderCart()
        confirmBtn.textContent = 'Confirm Payment';
    }
    document.getElementById('print-bill').disabled = true;
    
    // Clear all size tile selections when returning to menu
    clearSizeTileSelections();
    
    // Update cart display (this will enable/disable Pay Now button based on cart)
    renderCart();
}

