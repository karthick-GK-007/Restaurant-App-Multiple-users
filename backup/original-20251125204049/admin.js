// Admin Panel JavaScript
let ADMIN_PASSWORD = 'admin123'; // Will be loaded from Config
let menuItems = [];
let salesData = { transactions: [] }; // Sales data for admin panel
let allBranches = [];
let adminViewMode = localStorage.getItem('adminViewMode') || 'grid';
let selectedAdminBranchId = '';
const ORDER_TYPE_LABELS = {
    dining: 'Dining',
    takeaway: 'Takeaway',
    onlineorder: 'Online Order'
};
const GST_ORDER_TYPES = [
    { key: 'dining', label: 'Dining', config: { cgst: 'gst_dining_cgst_percentage', sgst: 'gst_dining_sgst_percentage' } },
    { key: 'takeaway', label: 'Takeaway', config: { cgst: 'gst_takeaway_cgst_percentage', sgst: 'gst_takeaway_sgst_percentage' } },
    { key: 'onlineorder', label: 'Online Order', config: { cgst: 'gst_onlineorder_cgst_percentage', sgst: 'gst_onlineorder_sgst_percentage' } }
];
const DEFAULT_GST_SETTINGS = {
    dining: { cgst: 2.5, sgst: 2.5 },
    takeaway: { cgst: 2.5, sgst: 2.5 },
    onlineorder: { cgst: 2.5, sgst: 2.5 },
    gstEnabled: true,
    showTaxOnBill: true
};
let gstSettings = { ...DEFAULT_GST_SETTINGS };

// Collapsible sections state
let exportSectionsState = {
    menu: false,
    sales: false
};
let gstSectionOpen = false;

// Toggle export section
function toggleExportSection(section) {
    exportSectionsState[section] = !exportSectionsState[section];
    const content = document.getElementById(`${section}-content`);
    const icon = document.getElementById(`${section}-icon`);
    const header = content?.closest('.admin-collapsible-section-item')?.querySelector('.admin-collapsible-section-header');
    
    if (content && icon) {
        if (exportSectionsState[section]) {
            content.style.display = 'block';
            icon.textContent = '⌄';
            if (header) header.classList.add('active');
        } else {
            content.style.display = 'none';
            icon.textContent = '›';
            if (header) header.classList.remove('active');
        }
    }
}

// Toggle GST section
function toggleGSTSection() {
    gstSectionOpen = !gstSectionOpen;
    const content = document.getElementById('gst-content');
    const icon = document.getElementById('gst-icon');
    const header = content?.closest('.admin-collapsible-section-item')?.querySelector('.admin-collapsible-section-header');
    
    if (content && icon) {
        if (gstSectionOpen) {
            content.style.display = 'block';
            icon.textContent = '⌄';
            if (header) header.classList.add('active');
        } else {
            content.style.display = 'none';
            icon.textContent = '›';
            if (header) header.classList.remove('active');
        }
    }
}

// Make functions globally accessible
window.toggleExportSection = toggleExportSection;
window.toggleGSTSection = toggleGSTSection;

// Show popup function (similar to script.js)
function showAdminPopup(type, title, message, buttons = []) {
    // Remove existing popup if any
    const existingPopup = document.querySelector('.admin-popup-overlay');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'admin-popup-overlay';
    
    const content = document.createElement('div');
    content.className = 'admin-popup-content';
    
    const icon = document.createElement('div');
    icon.className = `admin-popup-icon ${type}`;
    
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
    buttonsEl.className = 'admin-popup-buttons';
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `admin-popup-btn ${btn.class || 'primary'}`;
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

// Initialize admin panel
// Load restaurant title from config
async function loadRestaurantTitle() {
    try {
        if (typeof apiService !== 'undefined') {
            await apiService.initialize();
            const restaurantTitle = await apiService.getConfig('restaurant_title');
            if (restaurantTitle) {
                const titleElement = document.getElementById('restaurant-title-admin-header');
                if (titleElement) {
                    titleElement.textContent = restaurantTitle;
                }
            }
        }
        
        // Apply theme colors to banner
        updateBannerTheme();
    } catch (error) {
        console.warn('Failed to load restaurant title:', error);
    }
}

function updateBannerTheme() {
    try {
        // Get theme colors from ThemeManager
        const theme = ThemeManager && ThemeManager.colors ? ThemeManager.colors : {
            primary: '#C6A667',
            surface: '#FFFFFF'
        };
        
        const bannerBlock = document.getElementById('admin-banner-block');
        if (bannerBlock) {
            bannerBlock.style.background = 'var(--primary)';
            bannerBlock.style.color = 'var(--surface)';
        }
    } catch (error) {
        console.warn('Failed to update banner theme:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize ThemeManager first (loads theme from Supabase)
    if (typeof ThemeManager !== 'undefined') {
        await ThemeManager.init();
        console.log('✅ Theme loaded from Supabase');
    }
    
    // ALWAYS show login modal - require password every time
    // Clear any previous authentication to force fresh login
    sessionStorage.removeItem('adminAuthenticated');
    
    // Immediately hide any existing loader - do this first
    hideAdminLoader();
    
    // Also use setTimeout to ensure loader is removed even if something blocks
    setTimeout(() => {
        hideAdminLoader();
    }, 100);
    
    const passwordModal = document.getElementById('password-modal');
    const adminPanel = document.getElementById('admin-panel');
    
    // Always show login modal and hide admin panel on page load
    if (passwordModal) passwordModal.classList.remove('hidden');
    if (adminPanel) adminPanel.classList.add('hidden');
    
    // Setup password authentication immediately (don't wait for API)
    setupPasswordAuth();
    
    // Initialize API in background (non-blocking)
    (async () => {
        try {
            // Initialize Supabase API service with timeout
            const initPromise = apiService.initialize();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('API initialization timeout')), 5000)
            );
            
            await Promise.race([initPromise, timeoutPromise]);
            
            // Load admin password from Config (don't block if it fails)
            await loadAdminPassword();
        } catch (error) {
            console.error('❌ Error initializing admin panel:', error);
            // Use default password if API fails
            if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
                ADMIN_PASSWORD = 'admin123';
                console.log('✅ Using default admin password: admin123');
            }
        } finally {
            // Ensure loader is hidden
            hideAdminLoader();
            setTimeout(() => {
                hideAdminLoader();
            }, 200);
        }
    })();
});

// Load admin password from Config
async function loadAdminPassword() {
    try {
        // Ensure API service is initialized
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        
        const password = await apiService.getConfig('admin_password');
        
        if (password) {
            ADMIN_PASSWORD = password;
        } else {
            console.warn('⚠️ Admin password not found in config, using default');
            if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
                ADMIN_PASSWORD = 'admin123';
                console.log('✅ Using default admin password: admin123');
            }
        }
    } catch (error) {
        console.warn('Could not load admin password from Supabase config:', error);
        if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
            ADMIN_PASSWORD = 'admin123';
            console.log('✅ Using default admin password: admin123');
        }
    }
}

function getGstConfigKeys() {
    const keys = [];
    GST_ORDER_TYPES.forEach(type => {
        keys.push(type.config.cgst);
        keys.push(type.config.sgst);
    });
    keys.push('gst_enabled');
    keys.push('gst_show_tax_on_bill');
    return keys;
}

function parseGstNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parseFloat(parsed.toFixed(2));
}

function getGstConfigPayload(settings) {
    const payload = {};
    GST_ORDER_TYPES.forEach(type => {
        payload[type.config.cgst] = String(parseGstNumber(settings[type.key].cgst));
        payload[type.config.sgst] = String(parseGstNumber(settings[type.key].sgst));
    });
    payload['gst_enabled'] = settings.gstEnabled !== false ? 'true' : 'false';
    payload['gst_show_tax_on_bill'] = settings.showTaxOnBill ? 'true' : 'false';
    return payload;
}

function getGstConfigForMatrix() {
    const config = {};
    GST_ORDER_TYPES.forEach(type => {
        config[type.key] = {
            cgst: parseGstNumber(gstSettings[type.key]?.cgst, DEFAULT_GST_SETTINGS[type.key].cgst),
            sgst: parseGstNumber(gstSettings[type.key]?.sgst, DEFAULT_GST_SETTINGS[type.key].sgst)
        };
    });
    return config;
}

async function loadGstSettings(showLoader = true) {
    try {
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        const keys = getGstConfigKeys();
        const configValues = await apiService.getConfigs(keys);
        GST_ORDER_TYPES.forEach(type => {
            const cgst = parseGstNumber(configValues[type.config.cgst], DEFAULT_GST_SETTINGS[type.key].cgst);
            const sgst = parseGstNumber(configValues[type.config.sgst], DEFAULT_GST_SETTINGS[type.key].sgst);
            gstSettings[type.key] = { cgst, sgst };
        });
        gstSettings.gstEnabled = (configValues['gst_enabled'] ?? 'true').toString() !== 'false';
        gstSettings.showTaxOnBill = (configValues['gst_show_tax_on_bill'] ?? 'true').toString() !== 'false';
        renderGstSettingsForm();
    } catch (error) {
        console.warn('Failed to load GST settings, using defaults:', error);
        gstSettings = { ...DEFAULT_GST_SETTINGS };
        renderGstSettingsForm();
    } finally {
        if (showLoader) {
            const status = document.getElementById('gst-settings-status');
            if (status) {
                status.textContent = '';
                status.className = 'gst-settings-status';
            }
        }
    }
}

function renderGstSettingsForm() {
    GST_ORDER_TYPES.forEach(type => {
        const cgstInput = document.getElementById(`gst-${type.key}-cgst`);
        const sgstInput = document.getElementById(`gst-${type.key}-sgst`);
        if (cgstInput) {
            cgstInput.value = parseGstNumber(gstSettings[type.key]?.cgst, DEFAULT_GST_SETTINGS[type.key].cgst);
        }
        if (sgstInput) {
            sgstInput.value = parseGstNumber(gstSettings[type.key]?.sgst, DEFAULT_GST_SETTINGS[type.key].sgst);
        }
    });
    const gstEnabledToggle = document.getElementById('gst-enabled');
    if (gstEnabledToggle) {
        gstEnabledToggle.checked = gstSettings.gstEnabled !== false;
    }
    const showTaxToggle = document.getElementById('gst-show-tax');
    if (showTaxToggle) {
        showTaxToggle.checked = gstSettings.showTaxOnBill !== false;
    }
}

function setupGstSettingsForm() {
    const form = document.getElementById('gst-settings-form');
    const resetBtn = document.getElementById('reset-gst-settings');
    if (form && !form.dataset.initialized) {
        form.dataset.initialized = 'true';
        form.addEventListener('submit', handleGstSettingsSubmit);
    }
    if (resetBtn && !resetBtn.dataset.initialized) {
        resetBtn.dataset.initialized = 'true';
        resetBtn.addEventListener('click', async () => {
            gstSettings = { ...DEFAULT_GST_SETTINGS };
            renderGstSettingsForm();
            await handleGstSettingsSubmit(null, true);
        });
    }
}

function collectGstSettingsFromForm() {
    const settings = {
        gstEnabled: document.getElementById('gst-enabled')?.checked !== false,
        showTaxOnBill: document.getElementById('gst-show-tax')?.checked !== false
    };
    GST_ORDER_TYPES.forEach(type => {
        const cgst = parseGstNumber(document.getElementById(`gst-${type.key}-cgst`)?.value, DEFAULT_GST_SETTINGS[type.key].cgst);
        const sgst = parseGstNumber(document.getElementById(`gst-${type.key}-sgst`)?.value, DEFAULT_GST_SETTINGS[type.key].sgst);
        settings[type.key] = { cgst, sgst };
    });
    return settings;
}

async function handleGstSettingsSubmit(event, isReset = false) {
    if (event) {
        event.preventDefault();
    }
    const status = document.getElementById('gst-settings-status');
    try {
        const settings = isReset ? { ...DEFAULT_GST_SETTINGS } : collectGstSettingsFromForm();
        const payload = getGstConfigPayload(settings);
        if (!apiService.configLoaded) {
            await apiService.initialize();
        }
        await apiService.setConfigs(payload);
        gstSettings = { ...gstSettings, ...settings };
        if (status) {
            status.textContent = 'GST settings saved successfully.';
            status.className = 'gst-settings-status success';
        }
    } catch (error) {
        console.error('Failed to save GST settings:', error);
        if (status) {
            status.textContent = `Failed to save GST settings: ${error.message || 'Unknown error'}`;
            status.className = 'gst-settings-status error';
        }
    }
}

function getItemSourcePrice(item, sizeKey = null) {
    if (!item || !item.pricingMetadata) return sizeKey ? (item?.sizes?.[sizeKey]?.price || '') : (item?.price || '');
    const metadata = item.pricingMetadata;
    if (sizeKey) {
        if (metadata.sourcePrice?.sizes && metadata.sourcePrice.sizes[sizeKey] !== undefined && metadata.sourcePrice.sizes[sizeKey] !== null) {
            return metadata.sourcePrice.sizes[sizeKey];
        }
        const sizeObj = item.sizes?.[sizeKey];
        if (sizeObj && sizeObj.price) {
            const breakdown = GSTUtils.getBreakdownFromMetadata(metadata, 'Dining', sizeKey);
            return metadata.priceIncludesTax ? (sizeObj.price || '') : (breakdown?.basePrice ?? sizeObj.price);
        }
        return '';
    }
    if (metadata.sourcePrice && metadata.sourcePrice.default !== null && metadata.sourcePrice.default !== undefined) {
        return metadata.sourcePrice.default;
    }
    const breakdown = GSTUtils.getBreakdownFromMetadata(metadata, 'Dining');
    if (!breakdown) {
        return item.price || '';
    }
    return metadata.priceIncludesTax ? (item.price || '') : (breakdown.basePrice ?? item.price);
}

// Password authentication
function setupPasswordAuth() {
    const passwordModal = document.getElementById('password-modal');
    const loginBtn = document.getElementById('login-btn');
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    const adminPanel = document.getElementById('admin-panel');
    
    // Check if required elements exist
    if (!loginBtn || !passwordInput || !errorMessage || !adminPanel) {
        console.error('❌ Required login elements not found:', {
            loginBtn: !!loginBtn,
            passwordInput: !!passwordInput,
            errorMessage: !!errorMessage,
            adminPanel: !!adminPanel
        });
        return;
    }
    
    // Always ensure modal is visible and panel is hidden (require fresh login)
    if (passwordModal) passwordModal.classList.remove('hidden');
    if (adminPanel) adminPanel.classList.add('hidden');
    
    // Clear password input and ensure it's focusable
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.disabled = false;
        passwordInput.readOnly = false;
        // Force focus after a short delay to ensure modal is fully rendered
        setTimeout(() => {
            passwordInput.focus();
        }, 100);
    }
    
    // Add toggle password visibility
    const togglePasswordBtn = document.getElementById('toggle-password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
            if (eyeIcon) {
                eyeIcon.textContent = type === 'password' ? '👁' : '🙈';
            }
        });
    }
    
    // Add event listener for login button
    loginBtn.addEventListener('click', async () => {
        const enteredPassword = passwordInput.value.trim();
        
        // Validate: password must not be empty
        if (!enteredPassword) {
            errorMessage.textContent = 'Please enter a password.';
            passwordInput.focus();
            return;
        }
        
        // Validate: ADMIN_PASSWORD must be loaded
        if (!ADMIN_PASSWORD || ADMIN_PASSWORD.trim() === '') {
            errorMessage.textContent = 'Password not configured. Please check Config sheet.';
            passwordInput.focus();
            return;
        }
        
        // Check password match
        if (enteredPassword === ADMIN_PASSWORD.trim()) {
            // Set authentication (but it will be cleared on next page load)
            sessionStorage.setItem('adminAuthenticated', 'true');
            passwordModal.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            errorMessage.textContent = '';
            
            // Load data after successful authentication
            // Set maximum timeout to force hide loader (15 seconds)
            const maxTimeout = setTimeout(() => {
                console.warn('⚠️ Admin data loading timeout - forcing loader removal');
                hideAdminLoader();
            }, 15000);
            
            try {
                showAdminLoader('Loading admin data...');
                
                // Ensure API service is initialized with timeout
                if (!apiService.configLoaded) {
                    console.log('🔄 Initializing API service...');
                    try {
                        const initPromise = apiService.initialize();
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('API initialization timeout')), 5000)
                        );
                        await Promise.race([initPromise, timeoutPromise]);
                    } catch (initError) {
                        console.warn('⚠️ API initialization timeout or error:', initError);
                        // Continue anyway
                    }
                }
                
                // Load data with individual timeouts
                const loadPromises = [];
                
                // Load branches with timeout
                loadPromises.push(
                    Promise.race([
                        loadBranchesForAdmin(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Branches timeout')), 10000))
                    ]).catch(err => {
                        console.warn('⚠️ Branches loading error:', err);
                    })
                );
                
                // Load menu with timeout
                loadPromises.push(
                    Promise.race([
                        loadMenu(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Menu timeout')), 10000))
                    ]).catch(err => {
                        console.warn('⚠️ Menu loading error:', err);
                    })
                );
                
                // Load sales data with timeout (non-blocking)
                loadSalesData().catch(err => {
                    console.warn('⚠️ Sales data loading error:', err);
                });
                
                // Load GST settings with timeout (non-blocking)
                loadGstSettings(false).catch(err => {
                    console.warn('⚠️ GST settings loading error:', err);
                });
                
                // Load restaurant title (non-blocking)
                loadRestaurantTitle().catch(err => {
                    console.warn('⚠️ Restaurant title loading error:', err);
                });
                
                // Wait for critical data to load
                await Promise.allSettled(loadPromises);
                
                setupEventListeners(); // Admin.js setupEventListeners
                setupAdminSearch(); // Setup search functionality
                renderAdminCategoryButtons(); // Render category buttons
                updateBannerTheme(); // Update banner with theme colors
                updateAdminViewMode(adminViewMode);
                
            } catch (error) {
                console.error('❌ Error loading admin data after login:', error);
                
                // Show user-friendly error message
                let errorMsg = 'Failed to load admin data. ';
                if (error.message) {
                    if (error.message.includes('network') || error.message.includes('fetch')) {
                        errorMsg += 'Please check your internet connection and try again.';
                    } else if (error.message.includes('timeout')) {
                        errorMsg += 'Request timed out. Please try again.';
                    } else {
                        errorMsg += error.message;
                    }
                } else {
                    errorMsg += 'Please refresh the page and try again.';
                }
                
                showAdminPopup('error', 'Loading Error', errorMsg, [
                    { text: 'Retry', class: 'primary', onClick: () => window.location.reload() },
                    { text: 'OK', class: 'secondary' }
                ]);
            } finally {
                // Clear the max timeout
                clearTimeout(maxTimeout);
                
                // Always hide loader
                hideAdminLoader();
                
                // Multiple backup timeouts
                setTimeout(() => hideAdminLoader(), 100);
                setTimeout(() => hideAdminLoader(), 500);
                setTimeout(() => hideAdminLoader(), 1000);
            }
        } else {
            errorMessage.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
}

// Load menu from Google Sheets or fallback
async function loadMenu() {
    try {
        console.log('📥 Loading menu for admin panel...');
        
        // Ensure API service is initialized
        if (!apiService.appsScriptUrl) {
            console.log('🔄 API service not initialized, initializing now...');
            await apiService.initialize();
        }
        
        // Try to load from Google Sheets (all branches)
        // For admin, we show all menu items from all branches
        let allBranches;
        try {
            allBranches = await apiService.getBranches();
        } catch (error) {
            console.error('❌ Error loading branches:', error);
            throw new Error('Failed to load branches. Please check your connection and try again.');
        }
        
        const branches = allBranches.branches || [];
        console.log(`📦 Found ${branches.length} branches`);
        
        if (branches.length === 0) {
            console.warn('⚠️ No branches found');
            menuItems = [];
            renderAdminCategoryButtons();
            renderMenuItems();
            
            // Show user-friendly message
            const menuItemsAdmin = document.getElementById('menu-items-admin');
            if (menuItemsAdmin) {
                menuItemsAdmin.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger); font-weight: 600;">No branches found. Please check your Google Sheets configuration.</p>';
            }
            return;
        }
        
        menuItems = [];
        let loadedCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // Load menu for each branch with retry logic
        for (const branch of branches) {
            try {
                console.log(`📥 Loading menu for branch ${branch.id} (${branch.name})...`);
                
                // Add timeout for mobile networks
                const menuPromise = apiService.getMenu(branch.id);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), 30000) // 30 second timeout
                );
                
                const response = await Promise.race([menuPromise, timeoutPromise]);
                const items = response.items || [];
                console.log(`✅ Loaded ${items.length} items for branch ${branch.id}`);
                menuItems.push(...items);
                loadedCount++;
            } catch (error) {
                console.error(`❌ Error loading menu for branch ${branch.id}:`, error);
                errorCount++;
                errors.push({
                    branch: branch.name || branch.id,
                    error: error.message || 'Unknown error'
                });
            }
        }
        
        console.log(`✅ Total menu items loaded: ${menuItems.length} from ${loadedCount} branches`);
        
        // Show warning if some branches failed to load
        if (errorCount > 0 && menuItems.length === 0) {
            console.error('❌ Failed to load menu from all branches');
            const errorMsg = `Failed to load menu items. Errors: ${errors.map(e => `${e.branch}: ${e.error}`).join(', ')}`;
            console.error(errorMsg);
            
            // Try localStorage fallback
            const savedMenu = localStorage.getItem('admin_menu');
            if (savedMenu) {
                try {
                    menuItems = JSON.parse(savedMenu);
                    console.log('✅ Loaded menu from localStorage cache');
                    renderMenuItems();
                    
                    // Show info popup
                    showAdminPopup('info', 'Using Cached Data', 
                        'Menu items loaded from cache. Some data may be outdated. Please check your connection.',
                        [{ text: 'OK', class: 'primary' }]
                    );
                    return;
                } catch (e) {
                    console.error('Error parsing localStorage menu:', e);
                }
            }
            
            // Show error if no cache available
            const menuItemsAdmin = document.getElementById('menu-items-admin');
            if (menuItemsAdmin) {
                menuItemsAdmin.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <p style="color: var(--danger); font-weight: 600; margin-bottom: 10px;">Failed to load menu items</p>
                        <p style="color: var(--text-muted); font-size: 0.9em; margin-bottom: 15px;">${errorMsg}</p>
                        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 10px;">Retry</button>
                    </div>
                `;
            }
            return;
        } else if (errorCount > 0 && menuItems.length > 0) {
            // Some branches loaded, show warning
            console.warn(`⚠️ Loaded menu from ${loadedCount} branches, ${errorCount} branches failed`);
            showAdminPopup('info', 'Partial Data Loaded', 
                `Menu items loaded from ${loadedCount} branch(es). ${errorCount} branch(es) failed to load.`,
                [{ text: 'OK', class: 'primary' }]
            );
        }
        
        // Save to localStorage as backup
        if (menuItems.length > 0) {
            try {
                localStorage.setItem('admin_menu', JSON.stringify(menuItems));
                console.log('✅ Menu saved to localStorage');
            } catch (storageError) {
                console.warn('⚠️ Could not save to localStorage:', storageError);
            }
        }
        
        renderAdminCategoryButtons();
        renderMenuItems();
    } catch (error) {
        console.error('❌ Error loading menu from API:', error);
        
        // Fallback to localStorage
        const savedMenu = localStorage.getItem('admin_menu');
        if (savedMenu) {
            try {
                menuItems = JSON.parse(savedMenu);
                console.log('✅ Loaded menu from localStorage cache');
                renderAdminCategoryButtons();
                renderMenuItems();
                
                // Show info popup
                showAdminPopup('info', 'Using Cached Data', 
                    'Menu items loaded from cache. Unable to fetch fresh data. Please check your connection and refresh.',
                    [
                        { text: 'Refresh', class: 'primary', onClick: () => location.reload() },
                        { text: 'Continue', class: 'secondary' }
                    ]
                );
            } catch (e) {
                console.error('Error parsing localStorage menu:', e);
                menuItems = [];
                renderAdminCategoryButtons();
                renderMenuItems();
                
                // Show error message
                const menuItemsAdmin = document.getElementById('menu-items-admin');
                if (menuItemsAdmin) {
                    menuItemsAdmin.innerHTML = `
                        <div style="padding: 20px; text-align: center;">
                            <p style="color: var(--danger); font-weight: 600; margin-bottom: 10px;">Error Loading Menu</p>
                            <p style="color: var(--text-muted); font-size: 0.9em; margin-bottom: 15px;">${error.message || 'Unknown error occurred'}</p>
                            <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 10px;">Retry</button>
                        </div>
                    `;
                }
            }
        } else {
            console.log('⚠️ No cached menu found, using empty menu');
            menuItems = [];
            renderAdminCategoryButtons();
            renderMenuItems();
            
            // Show error message
            const menuItemsAdmin = document.getElementById('menu-items-admin');
            if (menuItemsAdmin) {
                menuItemsAdmin.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <p style="color: var(--danger); font-weight: 600; margin-bottom: 10px;">No Menu Data Available</p>
                        <p style="color: var(--text-muted); font-size: 0.9em; margin-bottom: 15px;">Unable to load menu items. Please check your connection and Google Sheets configuration.</p>
                        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 10px;">Retry</button>
                    </div>
                `;
            }
        }
    }
}

// Save menu to localStorage
async function saveMenu() {
    // Save to localStorage (primary storage)
    localStorage.setItem('admin_menu', JSON.stringify(menuItems));
    
    // Create downloadable JSON file
    const menuData = { items: menuItems };
    const blob = new Blob([JSON.stringify(menuData, null, 2)], { type: 'application/json' });
    
    // Optional: auto-download the updated menu.json for backup
    // Uncomment if you want automatic download on save
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'menu.json';
    // a.click();
    // URL.revokeObjectURL(url);
}

// Load sales data from localStorage (where transactions are saved)
async function loadSalesData() {
    // Load from localStorage (primary storage)
    const savedSales = localStorage.getItem('restaurant_sales');
    if (savedSales && JSON.parse(savedSales).transactions.length > 0) {
        salesData = JSON.parse(savedSales);
        return;
    }
    
    // Fallback to JSON file (load sample data if localStorage is empty)
    try {
        const response = await fetch('data/sales.json');
        salesData = await response.json();
        // Save to localStorage (sync sample data)
        localStorage.setItem('restaurant_sales', JSON.stringify(salesData));
    } catch (error) {
        // Initialize empty if both fail
        salesData = { transactions: [] };
        localStorage.setItem('restaurant_sales', JSON.stringify(salesData));
    }
}

// Render menu items in admin panel
// Global variables for admin filtering
let selectedAdminCategory = '';
let adminSearchTerm = '';

// Render category buttons for admin
function renderAdminCategoryButtons() {
    const categoryButtonsContainer = document.getElementById('admin-category-buttons');
    if (!categoryButtonsContainer) return;
    
    // Get all unique categories from menu items
    const categories = new Set();
    menuItems.forEach(item => {
        if (item.category && item.category.trim() !== '') {
            categories.add(item.category.trim());
        }
    });
    
    const categoryArray = Array.from(categories).sort();
    
    // Clear existing buttons
    categoryButtonsContainer.innerHTML = '';
    
    // Get theme colors from ThemeManager
    const theme = ThemeManager && ThemeManager.colors ? ThemeManager.colors : {
        primary: '#C6A667',
        surface: '#FFFFFF',
        text_primary: '#1A1A1A'
    };
    
    // Preserve the admin-category-buttons class and add flex layout
    categoryButtonsContainer.className = 'admin-category-buttons';
    
    // Add "All" button
    const allButton = document.createElement('button');
    const isAllActive = selectedAdminCategory === '';
    allButton.className = 'filter-btn';
    if (isAllActive) {
        allButton.classList.add('active');
    }
    allButton.textContent = 'All';
    allButton.addEventListener('click', () => {
        selectedAdminCategory = '';
        renderAdminCategoryButtons();
        renderMenuItems();
    });
    categoryButtonsContainer.appendChild(allButton);
    
    // Add category buttons
    categoryArray.forEach(category => {
        const categoryButton = document.createElement('button');
        const isCategoryActive = selectedAdminCategory === category;
        categoryButton.className = 'filter-btn';
        if (isCategoryActive) {
            categoryButton.classList.add('active');
        }
        categoryButton.textContent = category;
        categoryButton.addEventListener('click', () => {
            selectedAdminCategory = category;
            renderAdminCategoryButtons();
            renderMenuItems();
        });
        categoryButtonsContainer.appendChild(categoryButton);
    });
}

// Setup search functionality for admin
function setupAdminSearch() {
    const searchInput = document.getElementById('admin-menu-search');
    const clearSearchBtn = document.getElementById('admin-clear-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            adminSearchTerm = e.target.value.trim().toLowerCase();
            if (clearSearchBtn) {
                clearSearchBtn.style.display = adminSearchTerm ? 'block' : 'none';
            }
            renderMenuItems();
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            adminSearchTerm = '';
            if (searchInput) {
                searchInput.value = '';
            }
            clearSearchBtn.style.display = 'none';
            renderMenuItems();
        });
    }
}

// Helper function to get image URL from Supabase storage
function getImageUrl(imagePath) {
    if (!imagePath) return '';
    
    // If already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    // Get Supabase URL from config
    try {
        const storedConfig = localStorage.getItem('supabase_config');
        if (storedConfig) {
            const config = JSON.parse(storedConfig);
            const supabaseUrl = config.supabaseUrl;
            if (supabaseUrl) {
                // Extract project ID from URL (e.g., https://xxxxx.supabase.co)
                const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
                if (urlMatch) {
                    const projectId = urlMatch[1];
                    // Default bucket name - adjust if your bucket is different
                    const bucketName = 'menu-images'; // Change this to your actual bucket name
                    return `https://${projectId}.supabase.co/storage/v1/object/public/${bucketName}/${imagePath}`;
                }
            }
        }
    } catch (error) {
        console.warn('Error getting Supabase image URL:', error);
    }
    
    // Fallback: return original path
    return imagePath;
}

function renderMenuItems() {
    const menuItemsAdmin = document.getElementById('menu-items-admin');
    if (!menuItemsAdmin) return;
    
    menuItemsAdmin.innerHTML = '';
    
    // Set base class and add list-view if needed
    menuItemsAdmin.className = 'menu-items-admin';
    if (adminViewMode === 'list') {
        menuItemsAdmin.classList.add('list-view', 'space-y-4');
    } else {
        menuItemsAdmin.classList.remove('list-view', 'space-y-4');
    }
    
    // Filter by branch if selected and validate item structure
    let filteredItems = menuItems.filter(item => {
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
        return true;
    });
    
    if (selectedAdminBranchId) {
        filteredItems = filteredItems.filter(item => item.branchId == selectedAdminBranchId);
    }
    
    // Filter by category
    if (selectedAdminCategory) {
        filteredItems = filteredItems.filter(item => 
            item.category && item.category.trim() === selectedAdminCategory
        );
    }
    
    // Filter by search term
    if (adminSearchTerm) {
        filteredItems = filteredItems.filter(item => 
            item.name && item.name.toLowerCase().includes(adminSearchTerm)
        );
    }
    
    if (!filteredItems || filteredItems.length === 0) {
        menuItemsAdmin.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted);">No menu items found. Click "Add New Item" to get started.</p>';
        return;
    }
    
    filteredItems.forEach(item => {
        // Additional safety check
        if (!item || !item.name) {
            console.warn('⚠️ Skipping invalid item:', item);
            return;
        }
        const itemCard = document.createElement('div');
        itemCard.className = 'menu-item-admin';
        
        let priceDisplay = '';
        if (item.hasSizes && item.sizes && typeof item.sizes === 'object') {
            // Build size prices dynamically from available sizes in the data
            const sizePrices = [];
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
                        sizePrices.push(`<p>${label}: ₹${price}</p>`);
                    }
                }
            });
            
            // Only show size prices if there are valid sizes
            if (sizePrices.length > 0) {
                priceDisplay = sizePrices.join('');
            } else {
                // If no valid sizes, show regular price
                const price = item.price || 0;
                priceDisplay = `<p>Price: ₹${price}</p>`;
            }
        } else {
            const price = item.price || 0;
            priceDisplay = `<p>Price: ₹${price}</p>`;
        }
        
        const branchName = allBranches.find(b => b.id == item.branchId)?.name || `Branch ${item.branchId}`;
        const imageUrl = getImageUrl(item.image);
        
        // Separate rendering for Grid View and List View
        if (adminViewMode === 'grid') {
            // GRID VIEW - Image on top, then horizontal row with content and buttons
            itemCard.innerHTML = `
                <div class="bg-white rounded-xl shadow-sm p-4 flex flex-col">
                    ${imageUrl ? `
                        <img 
                            src="${imageUrl}" 
                            alt="${item.name}" 
                            onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'150\'%3E%3Crect fill=\'%23f3f4f6\' width=\'300\' height=\'150\'/%3E%3Ctext fill=\'%23999\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-family=\'Arial\' font-size=\'14\'%3ENo Image%3C/text%3E%3C/svg%3E';"
                            class="w-full h-40 object-cover rounded-lg mb-3"
                        />
                    ` : `
                        <div class="w-full h-40 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                            <span class="text-gray-400 text-sm">No Image</span>
                        </div>
                    `}
                    <div class="flex justify-between items-start w-full">
                        <div class="flex-1 min-w-0">
                            <h2 class="font-semibold text-[clamp(0.9rem,2vw,1.1rem)] leading-tight truncate">${item.name}</h2>
                            <p class="text-sm text-gray-500">${branchName}</p>
                            <div class="text-sm mt-2">${priceDisplay}</div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <button class="btn btn-primary-compact-card" onclick="editItem(${item.id}, '${item.branchId}')">Edit</button>
                            <button class="btn btn-danger-compact-card" onclick="deleteItem(${item.id}, '${item.branchId}')">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // LIST VIEW - Compact, no images
            itemCard.innerHTML = `
                <div class="menu-item-admin w-full bg-white rounded-xl shadow-sm p-4 flex justify-between items-start gap-4">
                    <div class="left flex-1 min-w-0">
                        <h2 class="font-semibold text-[clamp(0.9rem,2vw,1.1rem)] leading-tight truncate w-full">${item.name}</h2>
                        <p class="text-sm text-gray-500">${branchName}</p>
                        <div class="mt-2 text-sm">${priceDisplay}</div>
                    </div>
                    <div class="actions flex flex-col gap-2 shrink-0">
                        <button class="btn btn-primary-compact-card" onclick="editItem(${item.id}, '${item.branchId}')">Edit</button>
                        <button class="btn btn-danger-compact-card" onclick="deleteItem(${item.id}, '${item.branchId}')">Delete</button>
                    </div>
                </div>
            `;
        }
        
        menuItemsAdmin.appendChild(itemCard);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Add null checks to prevent errors if elements don't exist
    const addItemBtn = document.getElementById('add-item-btn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => openItemModal());
    }
    
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeItemModal());
    }
    
    const itemForm = document.getElementById('item-form');
    if (itemForm) {
        itemForm.addEventListener('submit', handleItemSubmit);
    }
    
    const hasSizes = document.getElementById('has-sizes');
    if (hasSizes) {
        hasSizes.addEventListener('change', toggleSizeOptions);
    }
    
    const itemImage = document.getElementById('item-image');
    if (itemImage) {
        itemImage.addEventListener('change', handleImagePreview);
    }
    
    const itemImageUrl = document.getElementById('item-image-url');
    if (itemImageUrl) {
        itemImageUrl.addEventListener('input', handleImageUrlChange);
        itemImageUrl.addEventListener('change', handleImageUrlChange);
    }
    
    // Admin branch tiles - event listeners are added in loadBranchesForAdmin()
    
    // Admin view toggle buttons
    const adminGridBtn = document.getElementById('admin-grid-view-btn');
    const adminListBtn = document.getElementById('admin-list-view-btn');
    if (adminGridBtn) {
        adminGridBtn.addEventListener('click', () => setAdminViewMode('grid'));
    }
    if (adminListBtn) {
        adminListBtn.addEventListener('click', () => setAdminViewMode('list'));
    }
    
    // Refresh branches button removed - branches load automatically on login and when needed
    // Export Excel button removed - sales report functionality removed
    
    // Setup admin search functionality
    setupAdminSearch();
    
    // Setup custom dropdowns
    setupCustomDropdowns();
    
    // Setup export buttons
    setupExportButtons();
}

// Custom Dropdown Functions
function setupCustomDropdowns() {
    setupDropdown('branch', 'item-branch-btn', 'item-branch-dropdown', 'item-branch-text', 'item-branch');
    setupDropdown('category', 'item-category-btn', 'item-category-dropdown', 'item-category-text', 'item-category');
    setupDropdown('availability', 'item-availability-btn', 'item-availability-dropdown', 'item-availability-text', 'item-availability');
}

function setupDropdown(type, btnId, menuId, textId, hiddenInputId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    const textSpan = document.getElementById(textId);
    const hiddenInput = document.getElementById(hiddenInputId);
    
    if (!btn || !menu || !textSpan || !hiddenInput) return;
    
    // Toggle dropdown on button click
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        closeAllDropdowns();
        if (!isOpen) {
            menu.style.display = 'block';
            btn.setAttribute('aria-expanded', 'true');
        }
    });
    
    // Handle option selection using event delegation
    menu.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-dropdown-option');
        if (!option) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        const value = option.getAttribute('data-value');
        hiddenInput.value = value;
        textSpan.textContent = option.textContent.trim();
        
        // Update selected state
        menu.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        
        closeAllDropdowns();
        
        // Special handling for branch dropdown
        if (type === 'branch') {
            populateCategoryDropdown();
        }
    });
}

function closeAllDropdowns() {
    document.querySelectorAll('.custom-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    document.querySelectorAll('.custom-dropdown-btn').forEach(btn => {
        btn.setAttribute('aria-expanded', 'false');
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown-wrapper')) {
        closeAllDropdowns();
    }
});

function populateCategoryDropdown() {
    const categoryDropdown = document.getElementById('item-category-dropdown');
    if (!categoryDropdown) return;
    
    // Get unique categories from menuItems
    const categories = [...new Set(menuItems.map(item => item.category).filter(cat => cat && cat.trim()))];
    
    // Clear existing options except the first one
    categoryDropdown.innerHTML = '<div class="custom-dropdown-option" data-value="">Select Category...</div>';
    
    // Add category options
    categories.forEach(cat => {
        const option = document.createElement('div');
        option.className = 'custom-dropdown-option';
        option.setAttribute('data-value', cat);
        option.textContent = cat;
        categoryDropdown.appendChild(option);
    });
}

// Export buttons
function setupExportButtons() {
    const exportMenuExcelBtn = document.getElementById('export-menu-excel');
    if (exportMenuExcelBtn) {
        exportMenuExcelBtn.addEventListener('click', () => exportMenuItems('excel'));
    }
    const exportMenuPdfBtn = document.getElementById('export-menu-pdf');
    if (exportMenuPdfBtn) {
        exportMenuPdfBtn.addEventListener('click', () => exportMenuItems('pdf'));
    }
    const exportSalesExcelBtn = document.getElementById('export-sales-excel');
    if (exportSalesExcelBtn) {
        exportSalesExcelBtn.addEventListener('click', () => exportSales('excel'));
    }
    const exportSalesPdfBtn = document.getElementById('export-sales-pdf');
    if (exportSalesPdfBtn) {
        exportSalesPdfBtn.addEventListener('click', () => exportSales('pdf'));
    }
    
    // Setup GST settings form handlers
    setupGstSettingsForm();
}


// Set admin view mode
function setAdminViewMode(mode) {
    adminViewMode = mode;
    localStorage.setItem('adminViewMode', mode);
    updateAdminViewMode(mode);
    // renderMenuItems() is called inside updateAdminViewMode, so no need to call it again
}

// Update admin view mode UI
function updateAdminViewMode(mode) {
    const adminGridBtn = document.getElementById('admin-grid-view-btn');
    const adminListBtn = document.getElementById('admin-list-view-btn');
    const menuItemsAdmin = document.getElementById('menu-items-admin');
    
    if (mode === 'list') {
        if (adminGridBtn) adminGridBtn.classList.remove('active');
        if (adminListBtn) adminListBtn.classList.add('active');
        if (menuItemsAdmin) menuItemsAdmin.classList.add('list-view');
    } else {
        if (adminGridBtn) adminGridBtn.classList.add('active');
        if (adminListBtn) adminListBtn.classList.remove('active');
        if (menuItemsAdmin) menuItemsAdmin.classList.remove('list-view');
    }
    
    // Re-render menu items with the new view mode
    renderMenuItems();
}


// Chart instances
let cumulativeTrendChart = null;
let itemPieChart = null;
let dailySalesChart = null;
let revenueBarChart = null;

// Dashboard functionality removed - sales report is no longer available

// Close dashboard
function closeDashboard() {
    document.getElementById('dashboard-modal').classList.add('hidden');
}

// REMOVED: Sales report functionality removed
// Old function removed - sales report is no longer available
function _updateDashboard_removed() {
    // This function has been removed
    const fromDateInput = document.getElementById('dashboard-from-date');
    const toDateInput = document.getElementById('dashboard-to-date');
    const fromDate = fromDateInput ? fromDateInput.value : '';
    const toDate = toDateInput ? toDateInput.value : '';
    
    let filteredTransactions = salesData.transactions || [];
    
    // Only filter by date if dates are actually selected
    const hasDateFilters = fromDate || toDate;
    
    if (hasDateFilters) {
        if (fromDate) {
            filteredTransactions = filteredTransactions.filter(t => {
                const transDate = t.date || '';
                if (!transDate) return false;
                const compareDate = transDate.length >= 10 ? transDate.substring(0, 10) : transDate;
                const normalizedCompareDate = compareDate.split(' ')[0].split('T')[0];
                return normalizedCompareDate >= fromDate;
            });
        }
        
        if (toDate) {
            filteredTransactions = filteredTransactions.filter(t => {
                const transDate = t.date || '';
                if (!transDate) return false;
                const compareDate = transDate.length >= 10 ? transDate.substring(0, 10) : transDate;
                const normalizedCompareDate = compareDate.split(' ')[0].split('T')[0];
                return normalizedCompareDate <= toDate;
            });
        }
        
        // Only show alert if filters were applied and no results found
        if (filteredTransactions.length === 0) {
            alert('No transactions found for the selected period.');
            return;
        }
    }
    
    // Update summary cards and charts
    if (typeof updateSummaryCards === 'function') {
        updateSummaryCards(filteredTransactions);
    }
    if (typeof updateCharts === 'function') {
        updateCharts(filteredTransactions);
    }
}

// Update summary cards
function updateSummaryCards(transactions) {
    const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
    const totalTransactions = transactions.length;
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    // Calculate top item
    const itemBreakdown = {};
    transactions.forEach(transaction => {
        transaction.items.forEach(item => {
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            // Safety check for price and quantity
            const price = (item && item.price) || 0;
            const quantity = (item && item.quantity) || 0;
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
    
    document.getElementById('total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
    document.getElementById('total-transactions').textContent = totalTransactions;
    document.getElementById('avg-order-value').textContent = `₹${avgOrderValue.toFixed(2)}`;
    document.getElementById('top-item').textContent = topItem;
}

// Update all charts
function updateCharts(transactions) {
    updateCumulativeTrendChart(transactions);
    updateItemPieChart(transactions);
    updateDailySalesChart(transactions);
    updateRevenueBarChart(transactions);
}

// Cumulative Trend Chart
function updateCumulativeTrendChart(transactions) {
    const ctx = document.getElementById('cumulative-trend-chart');
    if (!ctx) return;
    
    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Group by date and calculate cumulative
    const dateMap = {};
    let cumulativeTotal = 0;
    
    sortedTransactions.forEach(transaction => {
        const date = transaction.date;
        cumulativeTotal += transaction.total;
        if (!dateMap[date]) {
            dateMap[date] = { date, cumulative: 0, daily: 0 };
        }
        dateMap[date].cumulative = cumulativeTotal;
        dateMap[date].daily += transaction.total;
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
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 3,
                pointHoverBackgroundColor: '#5568d3',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: '#667eea',
                    borderWidth: 2,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ₹' + context.parsed.y.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// Item Pie Chart
function updateItemPieChart(transactions) {
    const ctx = document.getElementById('item-pie-chart');
    if (!ctx) return;
    
    const itemBreakdown = {};
    transactions.forEach(transaction => {
        transaction.items.forEach(item => {
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            // Safety check for price and quantity
            const price = (item && item.price) || 0;
            const quantity = (item && item.quantity) || 0;
            itemBreakdown[key].quantity += quantity;
            itemBreakdown[key].revenue += price * quantity;
        });
    });
    
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .slice(0, 8); // Top 8 items
    
    const labels = sortedItems.map(([name]) => name);
    const quantities = sortedItems.map(([, data]) => data.quantity);
    
    const pastelColors = [
        '#a8e6cf', '#ffd3b6', '#ffaaa5', '#d4a5f5',
        '#b8f2e6', '#ffb3ba', '#e0bbf5', '#ffeaa7'
    ];
    
    if (itemPieChart) {
        itemPieChart.destroy();
    }
    
    // Modern PowerBI-like color palette
    const modernColors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#330867',
        '#a8edea', '#fed6e3', '#ffecd2', '#fcb69f', '#ff9a9e'
    ];
    
    itemPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: quantities,
                backgroundColor: modernColors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 12,
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return {
                                        text: `${label} (${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: '#667eea',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} units (${percentage}%)`;
                        }
                    }
                }
            }
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
        dailyBreakdown[date] += transaction.total;
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
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: 'rgba(102, 126, 234, 1)',
                hoverBorderColor: '#5568d3',
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: '#667eea',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ₹' + context.parsed.y.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// Revenue Bar Chart
function updateRevenueBarChart(transactions) {
    const ctx = document.getElementById('revenue-bar-chart');
    if (!ctx) return;
    
    const itemBreakdown = {};
    transactions.forEach(transaction => {
        transaction.items.forEach(item => {
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            // Safety check for price and quantity
            const price = (item && item.price) || 0;
            const quantity = (item && item.quantity) || 0;
            itemBreakdown[key].quantity += quantity;
            itemBreakdown[key].revenue += price * quantity;
        });
    });
    
    const sortedItems = Object.entries(itemBreakdown)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10); // Top 10 items
    
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
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: 'rgba(118, 75, 162, 1)',
                hoverBorderColor: '#5a3a7a',
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: '#764ba2',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ₹' + context.parsed.x.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// Load branches for admin panel
// Show loading overlay
function showAdminLoader(message = 'Loading...') {
    const existingLoader = document.getElementById('admin-loading-overlay');
    if (existingLoader) {
        existingLoader.remove();
    }
    
    const loader = document.createElement('div');
    loader.id = 'admin-loading-overlay';
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
function hideAdminLoader() {
    // Remove by ID
    const loader = document.getElementById('admin-loading-overlay');
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
    
    // Also remove any loading-overlay elements (from script.js)
    const genericLoader = document.getElementById('loading-overlay');
    if (genericLoader) {
        genericLoader.style.display = 'none';
        genericLoader.style.visibility = 'hidden';
        genericLoader.style.opacity = '0';
        genericLoader.style.pointerEvents = 'none';
        genericLoader.classList.add('hidden');
        try {
            genericLoader.remove();
        } catch(e) {
            // Ignore errors
        }
    }
    
    // Remove all elements with loading-overlay class
    const allLoaders = document.querySelectorAll('.loading-overlay, #admin-loading-overlay, #loading-overlay, [id*="loading"], [class*="loading-overlay"]');
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
    
    // Also check body for any inline styles that might be blocking
    if (document.body) {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
    }
}

async function loadBranchesForAdmin() {
    const statusDiv = document.getElementById('api-status');
    
    try {
        showAdminLoader('Loading branches...');
        
        // Add timeout for mobile networks
        let response;
        try {
            const branchesPromise = apiService.getBranches();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout - branches loading took too long')), 30000) // 30 second timeout
            );
            response = await Promise.race([branchesPromise, timeoutPromise]);
        } catch (error) {
            hideAdminLoader();
            console.error('❌ Error loading branches:', error);
            throw new Error(`Failed to load branches: ${error.message || 'Unknown error'}`);
        }
        
        allBranches = response.branches || [];
        
        // Populate branch selector in form
        const branchSelect = document.getElementById('item-branch');
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">Select Branch...</option>';
            
            if (allBranches.length === 0) {
                const statusMsg = '⚠️ No branches found in Supabase. Please add branches first.';
                if (statusDiv) {
                    statusDiv.textContent = statusMsg;
                    statusDiv.style.display = 'block';
                    statusDiv.style.background = 'rgba(var(--accent-rgb), 0.2)';
                    statusDiv.style.color = 'var(--text-primary)';
                }
                console.warn(statusMsg);
                return addDefaultBranch();
            } else {
                allBranches.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.id;
                    option.textContent = branch.name;
                    branchSelect.appendChild(option);
                });
                
                if (statusDiv) {
                    statusDiv.textContent = `✅ Loaded ${allBranches.length} branch(es) from Supabase`;
                    statusDiv.style.display = 'block';
                    statusDiv.style.background = 'rgba(var(--success-rgb), 0.2)';
                    statusDiv.style.color = 'var(--success)';
                    setTimeout(() => {
                        statusDiv.style.display = 'none';
                    }, 3000);
                }
                
                // Cache branches for offline use
                try {
                    localStorage.setItem('admin_branches', JSON.stringify(allBranches));
                } catch (e) {
                    console.warn('Could not cache branches:', e);
                }
            }
        }
        
        // Populate admin branch tiles
        const adminBranchTiles = document.getElementById('admin-branch-tiles');
        if (adminBranchTiles) {
            adminBranchTiles.innerHTML = '<button class="branch-tile active" data-branch-id="">All Branches</button>';
            allBranches.forEach(branch => {
                const tile = document.createElement('button');
                tile.className = 'branch-tile';
                tile.setAttribute('data-branch-id', branch.id);
                tile.textContent = branch.name;
                tile.addEventListener('click', () => {
                    // Remove active class from all tiles
                    adminBranchTiles.querySelectorAll('.branch-tile').forEach(t => t.classList.remove('active'));
                    // Add active class to clicked tile
                    tile.classList.add('active');
                    // Update selected branch
                    selectedAdminBranchId = branch.id;
                    renderAdminCategoryButtons();
                    renderMenuItems();
                });
                adminBranchTiles.appendChild(tile);
            });
            
            // Add click handler for "All Branches" tile
            const allBranchesTile = adminBranchTiles.querySelector('[data-branch-id=""]');
            if (allBranchesTile) {
                allBranchesTile.addEventListener('click', () => {
                    adminBranchTiles.querySelectorAll('.branch-tile').forEach(t => t.classList.remove('active'));
                    allBranchesTile.classList.add('active');
                    selectedAdminBranchId = '';
                    renderAdminCategoryButtons();
                    renderMenuItems();
                });
            }
            
            console.log(`✅ Populated admin branch tiles with ${allBranches.length} branches`);
        } else {
            console.warn('⚠️ Admin branch tiles not found');
        }
        
        hideAdminLoader();
        return allBranches;
    } catch (error) {
        console.error('Error loading branches:', error);
        hideAdminLoader();
        const statusMsg = `❌ Failed to load branches: ${error.message}. Please check Supabase credentials and network connection.`;
        if (statusDiv) {
            statusDiv.textContent = statusMsg;
            statusDiv.style.display = 'block';
            statusDiv.style.background = 'rgba(var(--danger-rgb), 0.2)';
            statusDiv.style.color = 'var(--danger)';
        }
        return addDefaultBranch();
    }
}

// Add default branch option
function addDefaultBranch() {
    const branchSelect = document.getElementById('item-branch');
    if (branchSelect) {
        branchSelect.innerHTML = '<option value="">Select Branch...</option>';
        const defaultOption = document.createElement('option');
        defaultOption.value = '1';
        defaultOption.textContent = 'Main Branch (Default)';
        branchSelect.appendChild(defaultOption);
    }
    return [];
}

// Refresh branches function removed - branches load automatically when needed

// Open item modal for add/edit
async function openItemModal(item = null) {
    const modal = document.getElementById('item-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('item-form');
    
    // Load branches
    await loadBranchesForAdmin();
    
    form.reset();
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('item-image').value = '';
    document.getElementById('item-image-url').value = '';
    
    
    if (item) {
        modalTitle.textContent = 'Edit Menu Item';
        document.getElementById('item-id').value = item.id;
        
        // Set custom dropdown values
        const branchId = item.branchId || '';
        const branchText = allBranches.find(b => b.id === branchId)?.name || 'Select Branch...';
        document.getElementById('item-branch').value = branchId;
        document.getElementById('item-branch-text').textContent = branchText;
        
        const categoryValue = item.category || '';
        document.getElementById('item-category').value = categoryValue;
        document.getElementById('item-category-text').textContent = categoryValue || 'Select Category...';
        
        const availabilityValue = item.availability || 'Available';
        document.getElementById('item-availability').value = availabilityValue;
        document.getElementById('item-availability-text').textContent = availabilityValue;
        
        document.getElementById('item-name').value = item.name;
        document.getElementById('has-sizes').checked = item.hasSizes || false;
        
        
        if (item.hasSizes) {
            toggleSizeOptions();
            // Only populate sizes that exist in the item data
            if (item.sizes && typeof item.sizes === 'object') {
                document.getElementById('price-quarter').value = getItemSourcePrice(item, 'quarter') || '';
                document.getElementById('price-half').value = getItemSourcePrice(item, 'half') || '';
                document.getElementById('price-full').value = getItemSourcePrice(item, 'full') || '';
            } else {
                // Clear all size inputs if no sizes data
                document.getElementById('price-quarter').value = '';
                document.getElementById('price-half').value = '';
                document.getElementById('price-full').value = '';
            }
        } else {
            document.getElementById('item-price').value = getItemSourcePrice(item) || '';
        }
        
        // Set image URL if it's a URL
        if (item.image && (item.image.startsWith('http://') || item.image.startsWith('https://'))) {
            document.getElementById('item-image-url').value = item.image;
            document.getElementById('image-preview').innerHTML = `<img src="${item.image}" alt="Preview">`;
        } else if (item.image) {
            document.getElementById('image-preview').innerHTML = `<img src="${item.image}" alt="Preview" onerror="this.src='https://via.placeholder.com/200x150?text=${encodeURIComponent(item.name)}'">`;
        }
    } else {
        modalTitle.textContent = 'Add Menu Item';
        document.getElementById('item-id').value = '';
        document.getElementById('has-sizes').checked = false;
        
        // Reset custom dropdowns
        document.getElementById('item-branch').value = '';
        document.getElementById('item-branch-text').textContent = 'Select Branch...';
        document.getElementById('item-category').value = '';
        document.getElementById('item-category-text').textContent = 'Select Category...';
        document.getElementById('item-availability').value = 'Available';
        document.getElementById('item-availability-text').textContent = 'Available';
        
        toggleSizeOptions();
    }
    
    // Populate branch dropdown
    const branchDropdown = document.getElementById('item-branch-dropdown');
    if (branchDropdown) {
        branchDropdown.innerHTML = '<div class="custom-dropdown-option" data-value="">Select Branch...</div>';
        allBranches.forEach(branch => {
            const option = document.createElement('div');
            option.className = 'custom-dropdown-option';
            option.setAttribute('data-value', branch.id);
            option.textContent = branch.name;
            branchDropdown.appendChild(option);
        });
    }
    
    // Populate category dropdown
    populateCategoryDropdown();
    
    modal.classList.remove('hidden');
}

// Close item modal
function closeItemModal() {
    document.getElementById('item-modal').classList.add('hidden');
    closeAllDropdowns();
}

// Make closeItemModal globally accessible
window.closeItemModal = closeItemModal;

// Toggle size options
function toggleSizeOptions() {
    const hasSizes = document.getElementById('has-sizes').checked;
    const priceSingle = document.getElementById('price-single');
    const priceSizes = document.getElementById('price-sizes');
    
    if (hasSizes) {
        priceSingle.classList.add('hidden');
        priceSizes.classList.remove('hidden');
    } else {
        priceSingle.classList.remove('hidden');
        priceSizes.classList.add('hidden');
    }
}

// Handle image preview
function handleImagePreview(e) {
    const file = e.target.files[0];
    const imageUrl = document.getElementById('item-image-url').value;
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('image-preview');
            preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    } else if (imageUrl) {
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${imageUrl}" alt="Preview" onerror="this.style.display='none'">`;
    }
}

// Handle image URL input
function handleImageUrlChange() {
    const imageUrl = document.getElementById('item-image-url').value;
    const fileInput = document.getElementById('item-image');
    
    if (imageUrl && !fileInput.files[0]) {
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${imageUrl}" alt="Preview" onerror="this.style.display='none'">`;
    }
}

// Handle item form submit
async function handleItemSubmit(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('item-id').value;
    const branchId = document.getElementById('item-branch').value;
    const itemName = document.getElementById('item-name').value;
    const itemCategory = document.getElementById('item-category').value.trim();
    const itemAvailability = document.getElementById('item-availability').value;
    const itemImage = document.getElementById('item-image').files[0];
    const itemImageUrl = document.getElementById('item-image-url').value.trim();
    const hasSizes = document.getElementById('has-sizes').checked;
    
    // Validate required fields
    if (!branchId) {
        alert('Please select a branch.');
        return;
    }
    
    if (!itemName || itemName.trim() === '') {
        alert('Please enter an item name.');
        return;
    }
    
    // Handle image - prioritize URL, then uploaded file, then placeholder
    let imagePath = '';
    if (itemImageUrl) {
        imagePath = itemImageUrl;
    } else if (itemImage) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            imagePath = event.target.result;
            await saveItem(itemId, branchId, itemName, itemCategory, itemAvailability, imagePath, hasSizes);
        };
        reader.readAsDataURL(itemImage);
        return;
    } else {
        imagePath = `https://source.unsplash.com/400x300/?food,${encodeURIComponent(itemName)}`;
    }
    
    await saveItem(itemId, branchId, itemName, itemCategory, itemAvailability, imagePath, hasSizes);
}

// Save item helper function
async function saveItem(itemId, branchId, itemName, itemCategory, itemAvailability, imagePath, hasSizes) {
    const newItem = {
        id: itemId ? parseInt(itemId) : Date.now(),
        branchId: branchId,
        name: itemName,
        category: itemCategory,
        availability: itemAvailability,
        image: imagePath,
        hasSizes: hasSizes
    };
    
    const pricingMode = 'inclusive';
    const includesTax = true;
    const priceDefinition = { default: null, sizes: {} };
    let hasValidPrice = false;
    
    if (hasSizes) {
        // Only save sizes that have prices entered
        const quarterPrice = parseFloat(document.getElementById('price-quarter').value);
        const halfPrice = parseFloat(document.getElementById('price-half').value);
        const fullPrice = parseFloat(document.getElementById('price-full').value);
        
        if (quarterPrice && quarterPrice > 0) {
            priceDefinition.sizes.quarter = quarterPrice;
            hasValidPrice = true;
        }
        if (halfPrice && halfPrice > 0) {
            priceDefinition.sizes.half = halfPrice;
            hasValidPrice = true;
        }
        if (fullPrice && fullPrice > 0) {
            priceDefinition.sizes.full = fullPrice;
            hasValidPrice = true;
        }
        
        // Check if at least one size has a price
        if (Object.keys(priceDefinition.sizes).length === 0) {
            alert('Please enter at least one size price.');
            return;
        }
    } else {
        const price = parseFloat(document.getElementById('item-price').value);
        if (!price || price <= 0) {
            alert('Please enter a valid price.');
            return;
        }
        priceDefinition.default = price;
        hasValidPrice = true;
    }
    
    if (!hasValidPrice) {
        alert('Please enter at least one valid price.');
        return;
    }
    
    const gstConfig = getGstConfigForMatrix();
    const pricingMetadata = GSTUtils.buildPricingMatrix(priceDefinition, gstConfig, includesTax);
    
    if (hasSizes) {
        newItem.sizes = {};
        Object.keys(priceDefinition.sizes).forEach(sizeKey => {
            const breakdown = GSTUtils.getBreakdownFromMetadata(pricingMetadata, 'Dining', sizeKey);
            newItem.sizes[sizeKey] = {
                price: breakdown ? breakdown.finalPrice : priceDefinition.sizes[sizeKey]
            };
        });
    } else {
        const breakdown = GSTUtils.getBreakdownFromMetadata(pricingMetadata, 'Dining');
        newItem.price = breakdown ? breakdown.finalPrice : priceDefinition.default;
    }
    
    newItem.pricingMode = pricingMode;
    newItem.pricingMetadata = pricingMetadata;
    newItem.showTaxOnBill = true;
    newItem.gst = gstConfig;
    
    // Save to Google Sheets
    try {
        showAdminLoader('Saving item...');
        await apiService.saveMenuItem(newItem);
        hideAdminLoader();
        
        // Show success popup
        showAdminPopup('success', 'Success!', itemId ? 'Item has been updated successfully!' : 'Item has been added successfully!', [
            {
                text: 'OK',
                class: 'primary',
                onClick: async () => {
                    // Refresh menu from Google Sheets
                    showAdminLoader('Refreshing menu...');
                    try {
                        await loadMenu();
                        renderMenuItems();
                        hideAdminLoader();
                    } catch (error) {
                        console.error('Error refreshing menu:', error);
                        hideAdminLoader();
                    }
                }
            }
        ]);
    } catch (error) {
        console.error('Error saving to Google Sheets:', error);
        hideAdminLoader();
        // Fallback to localStorage
        if (itemId) {
            const index = menuItems.findIndex(item => item.id === parseInt(itemId));
            if (index !== -1) {
                menuItems[index] = { ...menuItems[index], ...newItem };
            } else {
                showAdminPopup('error', 'Error', 'Item not found. Cannot update.', [
                    { text: 'OK', class: 'primary' }
                ]);
                return;
            }
        } else {
            menuItems.push(newItem);
        }
        await saveMenu();
        showAdminPopup('info', 'Saved Locally', itemId ? 'Item updated locally (will sync when online)!' : 'Item added locally (will sync when online)!', [
            {
                text: 'OK',
                class: 'primary',
                onClick: async () => {
                    await loadMenu();
                    renderMenuItems();
                }
            }
        ]);
    }
    
    closeItemModal();
}

// Edit item
function editItem(id, branchId) {
    const item = menuItems.find(i => i.id == id && i.branchId == branchId);
    if (item) {
        openItemModal(item);
    }
}

// Delete item
async function deleteItem(id, branchId) {
    // Show confirmation popup
    showAdminPopup('info', 'Confirm Delete', 'Are you sure you want to delete this item?', [
        {
            text: 'Cancel',
            class: 'secondary',
            onClick: () => {}
        },
        {
            text: 'Delete',
            class: 'danger',
            onClick: async () => {
                try {
                    showAdminLoader('Deleting item...');
                    // Delete from Google Sheets
                    await apiService.deleteMenuItem(id, branchId);
                    hideAdminLoader();
                    
                    // Show success popup
                    showAdminPopup('success', 'Success!', 'Item has been deleted successfully!', [
                        {
                            text: 'OK',
                            class: 'primary',
                            onClick: async () => {
                                // Refresh menu from Google Sheets
                                showAdminLoader('Refreshing menu...');
                                try {
                                    await loadMenu();
                                    // loadMenu() already calls renderAdminCategoryButtons() and renderMenuItems()
                                    hideAdminLoader();
                                } catch (error) {
                                    console.error('Error refreshing menu:', error);
                                    hideAdminLoader();
                                }
                            }
                        }
                    ]);
                } catch (error) {
                    console.error('Error deleting from Google Sheets:', error);
                    hideAdminLoader();
                    // Fallback to localStorage
                    menuItems = menuItems.filter(item => !(item.id == id && item.branchId == branchId));
                    await saveMenu();
                    showAdminPopup('info', 'Deleted Locally', 'Item deleted locally (will sync when online)!', [
                        {
                            text: 'OK',
                            class: 'primary',
                            onClick: async () => {
                                await loadMenu();
                                renderMenuItems();
                            }
                        }
                    ]);
                }
            }
        }
    ]);
}

function formatSizeLabel(sizeKey) {
    if (!sizeKey) return 'Single';
    const labels = {
        quarter: 'Quarter',
        half: 'Half',
        full: 'Full',
        small: 'Small',
        medium: 'Medium',
        large: 'Large'
    };
    return labels[sizeKey] || sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1);
}

function formatExportNumber(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    return parseFloat(num.toFixed(2));
}

function buildMenuExportRows() {
    const rows = [];
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
        return rows;
    }
    menuItems.forEach(item => {
        const metadata = item.pricingMetadata || null;
        const includesTax = metadata ? metadata.priceIncludesTax !== false : (item.pricingMode || 'inclusive') !== 'exclusive';
        const hasSizes = item.hasSizes && item.sizes && Object.keys(item.sizes).length > 0;
        const sizeKeys = hasSizes ? Object.keys(item.sizes) : [null];
        sizeKeys.forEach(sizeKey => {
            Object.entries(ORDER_TYPE_LABELS).forEach(([orderKey, orderLabel]) => {
                const gstPercentages = item.gst?.[orderKey] || { cgst: 0, sgst: 0 };
                let breakdown = metadata ? GSTUtils.getBreakdownFromMetadata(metadata, orderLabel, sizeKey) : null;
                if (!breakdown) {
                    const sourcePrice = includesTax ? (sizeKey ? item.sizes?.[sizeKey]?.price : item.price) : getItemSourcePrice(item, sizeKey);
                    breakdown = GSTUtils.calculatePricing({
                        amount: sourcePrice || 0,
                        cgstPercentage: gstPercentages.cgst || 0,
                        sgstPercentage: gstPercentages.sgst || 0,
                        includesTax
                    });
                }
                rows.push({
                    itemName: item.name,
                    size: formatSizeLabel(sizeKey),
                    orderType: orderLabel,
                    basePrice: formatExportNumber(breakdown.basePrice),
                    finalPrice: formatExportNumber(breakdown.finalPrice)
                });
            });
        });
    });
    return rows;
}

function buildSalesExportRows() {
    const rows = [];
    
    // Ensure we're using salesData, not menuItems
    if (!salesData || !Array.isArray(salesData.transactions)) {
        console.warn('⚠️ salesData is not available or invalid');
        return rows;
    }
    
    const transactions = salesData.transactions;
    console.log(`📊 Building sales export rows from ${transactions.length} transactions`);
    
    transactions.forEach(transaction => {
        const orderType = transaction.orderType || 'Dining';
        (transaction.items || []).forEach(item => {
            rows.push({
                transactionId: transaction.id,
                date: transaction.date,
                orderType: item.orderType || orderType,
                itemName: item.name,
                size: formatSizeLabel(item.size),
                quantity: item.quantity || 1,
                basePrice: formatExportNumber(item.basePrice ?? 0),
                finalPrice: formatExportNumber(item.finalPrice ?? item.price ?? 0)
            });
        });
    });
    
    console.log(`✅ Built ${rows.length} sales export rows`);
    return rows;
}

function downloadExcelFromRows(rows, filename) {
    if (!rows || rows.length === 0) {
        alert('No data available for export.');
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, filename);
}

function downloadPdfFromRows(columns, rows, title, filename) {
    if (!rows || rows.length === 0) {
        alert('No data available for export.');
        return;
    }
    const jspdf = window.jspdf;
    if (!jspdf || typeof jspdf.jsPDF !== 'function') {
        alert('PDF export library not loaded.');
        return;
    }
    const doc = new jspdf.jsPDF({ orientation: 'landscape' });
    if (typeof doc.autoTable !== 'function') {
        alert('PDF autoTable plugin not available.');
        return;
    }
    doc.setFontSize(14);
    doc.text(title, 14, 18);
    const head = [columns.map(col => col.label)];
    const body = rows.map(row => columns.map(col => {
        const value = row[col.key];
        if (typeof value === 'number') {
            return value.toFixed(2);
        }
        return value ?? '';
    }));
    doc.autoTable({
        head,
        body,
        startY: 24,
        styles: { fontSize: 8 }
    });
    doc.save(filename);
}

function exportMenuItems(format = 'excel') {
    const rows = buildMenuExportRows();
    if (!rows.length) {
        alert('No menu data available to export.');
        return;
    }
    const timestamp = new Date().toISOString().split('T')[0];
    if (format === 'pdf') {
        const columns = [
            { key: 'itemName', label: 'Item Name' },
            { key: 'size', label: 'Size' },
            { key: 'orderType', label: 'Order Type' },
            { key: 'basePrice', label: 'Base Price' },
            { key: 'finalPrice', label: 'Final Price' }
        ];
        downloadPdfFromRows(columns, rows, 'Menu Items', `menu-items-${timestamp}.pdf`);
    } else {
        downloadExcelFromRows(rows, `menu-items-${timestamp}.xlsx`);
    }
}

async function exportSales(format = 'excel') {
    console.log('📊 Export Sales called with format:', format);
    
    // Ensure salesData is loaded
    if (!salesData || !Array.isArray(salesData.transactions) || salesData.transactions.length === 0) {
        console.log('📥 Loading sales data...');
        await loadSalesData();
    }
    
    // Verify we have sales data, not menu data
    if (!salesData || !Array.isArray(salesData.transactions) || salesData.transactions.length === 0) {
        alert('No sales/billing data available to export. Please make some sales first.');
        return;
    }
    
    console.log(`📈 Found ${salesData.transactions.length} transactions`);
    
    // Build rows from sales data only
    const rows = buildSalesExportRows();
    console.log(`📋 Built ${rows.length} sales rows for export`);
    
    if (!rows.length) {
        alert('No sales data available to export.');
        return;
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    if (format === 'pdf') {
        const columns = [
            { key: 'transactionId', label: 'Txn ID' },
            { key: 'date', label: 'Date' },
            { key: 'orderType', label: 'Order Type' },
            { key: 'itemName', label: 'Item Name' },
            { key: 'size', label: 'Size' },
            { key: 'quantity', label: 'Qty' },
            { key: 'basePrice', label: 'Base Price' },
            { key: 'finalPrice', label: 'Final Price' }
        ];
        console.log('📄 Exporting PDF with sales data...');
        downloadPdfFromRows(columns, rows, 'Sales Report', `sales-${timestamp}.pdf`);
    } else {
        console.log('📊 Exporting Excel with sales data...');
        downloadExcelFromRows(rows, `sales-${timestamp}.xlsx`);
    }
}

// REMOVED: Sales report functionality removed
// Old function removed - sales report is no longer available
async function _generateSalesReport_removed() {
    await loadSalesData();
    
    const fromDate = document.getElementById('report-from-date').value;
    const toDate = document.getElementById('report-to-date').value;
    
    let filteredTransactions = salesData.transactions || [];
    
    if (fromDate) {
        filteredTransactions = filteredTransactions.filter(t => t.date >= fromDate);
    }
    
    if (toDate) {
        filteredTransactions = filteredTransactions.filter(t => t.date <= toDate);
    }
    
    if (filteredTransactions.length === 0) {
        document.getElementById('sales-report').innerHTML = '<p>No transactions found for the selected period.</p>';
        return;
    }
    
    // Calculate totals
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalTransactions = filteredTransactions.length;
    
    // Item-wise breakdown
    const itemBreakdown = {};
    filteredTransactions.forEach(transaction => {
        transaction.items.forEach(item => {
            const key = item.name;
            if (!itemBreakdown[key]) {
                itemBreakdown[key] = { quantity: 0, revenue: 0 };
            }
            // Safety check for price and quantity
            const price = (item && item.price) || 0;
            const quantity = (item && item.quantity) || 0;
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
        dailyBreakdown[date].revenue += transaction.total;
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
}

// Handle Excel upload
async function handleExcelUpload() {
    const fileInput = document.getElementById('excel-upload');
    const file = fileInput.files[0];
    const uploadStatus = document.getElementById('upload-status');
    
    if (!file) {
        uploadStatus.className = 'upload-status error';
        uploadStatus.textContent = 'Please select an Excel file first.';
        return;
    }
    
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        uploadStatus.className = 'upload-status error';
        uploadStatus.textContent = 'Please upload a valid Excel file (.xlsx or .xls)';
        return;
    }
    
    try {
        uploadStatus.className = 'upload-status';
        uploadStatus.textContent = 'Processing Excel file...';
        uploadStatus.style.display = 'block';
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // Parse and convert to transactions format
                const transactions = parseExcelToTransactions(jsonData);
                
                if (transactions.length === 0) {
                    uploadStatus.className = 'upload-status error';
                    uploadStatus.textContent = 'No valid transactions found in the Excel file. Please check the format.';
                    return;
                }
                
                // Load existing data
                await loadSalesData();
                
                // Merge with existing transactions (or replace based on transaction ID)
                const existingIds = new Set((salesData.transactions || []).map(t => t.id));
                const newTransactions = transactions.filter(t => !existingIds.has(t.id));
                const updatedTransactions = transactions.filter(t => existingIds.has(t.id));
                
                // Update existing or add new
                if (updatedTransactions.length > 0) {
                    updatedTransactions.forEach(updated => {
                        const index = salesData.transactions.findIndex(t => t.id === updated.id);
                        if (index !== -1) {
                            salesData.transactions[index] = updated;
                        }
                    });
                }
                
                // Add new transactions
                salesData.transactions.push(...newTransactions);
                
                // Save to localStorage
                localStorage.setItem('restaurant_sales', JSON.stringify(salesData));
                
                uploadStatus.className = 'upload-status success';
                uploadStatus.textContent = `Successfully uploaded ${newTransactions.length} new transactions and updated ${updatedTransactions.length} existing transactions!`;
                
                // Clear file input
                fileInput.value = '';
                
            } catch (error) {
                console.error('Error parsing Excel:', error);
                uploadStatus.className = 'upload-status error';
                uploadStatus.textContent = 'Error parsing Excel file: ' + error.message;
            }
        };
        
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('Error uploading Excel:', error);
        uploadStatus.className = 'upload-status error';
        uploadStatus.textContent = 'Error uploading file: ' + error.message;
    }
}

// Parse Excel data to transactions format
function parseExcelToTransactions(jsonData) {
    const transactions = [];
    const transactionMap = new Map();
    
    jsonData.forEach((row, index) => {
        try {
            // Expected columns: Transaction ID, Date, Item Name, Price, Quantity, Size (optional), Total
            const transactionId = row['Transaction ID'] || row['TransactionId'] || row['transaction_id'] || `auto_${Date.now()}_${index}`;
            const date = row['Date'] || row['date'];
            const itemName = row['Item Name'] || row['ItemName'] || row['item_name'];
            const price = parseFloat(row['Price'] || row['price'] || 0);
            const quantity = parseInt(row['Quantity'] || row['quantity'] || 1);
            const size = row['Size'] || row['size'] || null;
            const total = parseFloat(row['Total'] || row['total'] || price * quantity);
            
            if (!date || !itemName || !price || !quantity) {
                console.warn(`Skipping row ${index + 1}: Missing required fields`);
                return;
            }
            
            // Format date
            let formattedDate = date;
            if (date instanceof Date) {
                formattedDate = date.toISOString().split('T')[0];
            } else if (typeof date === 'string') {
                // Try to parse various date formats
                const dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toISOString().split('T')[0];
                }
            }
            
            const transId = typeof transactionId === 'number' ? transactionId : parseInt(transactionId) || Date.now() + index;
            
            // Get or create transaction
            if (!transactionMap.has(transId)) {
                transactionMap.set(transId, {
                    id: transId,
                    date: formattedDate,
                    items: [],
                    total: 0,
                    qrCode: `qr_uploaded_${transId}.jpg`,
                    timestamp: new Date(date).toISOString()
                });
            }
            
            const transaction = transactionMap.get(transId);
            
            // Add item to transaction
            transaction.items.push({
                id: null, // Will be matched by name later if needed
                name: itemName,
                price: price,
                quantity: quantity,
                size: size || null
            });
            
            transaction.total += total;
            
        } catch (error) {
            console.error(`Error parsing row ${index + 1}:`, error);
        }
    });
    
    // Convert map to array
    return Array.from(transactionMap.values());
}

// Removed: Clear sales data functionality
// This function has been removed as per requirements
async function clearAllSalesData_removed() {
    if (!confirm('Are you sure you want to clear ALL sales data? This action cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will delete all transaction records. Are you absolutely sure?')) {
        return;
    }
    
    salesData = { transactions: [] };
    localStorage.setItem('restaurant_sales', JSON.stringify(salesData));
    
    const uploadStatus = document.getElementById('upload-status');
    uploadStatus.className = 'upload-status success';
    uploadStatus.textContent = 'All sales data has been cleared.';
    
    // Sales report functionality removed - no need to clear
}

// REMOVED: Sales report functionality removed
// Old function removed - sales report is no longer available
function _exportToExcel_removed() {
    if (!window.reportData || !window.reportData.transactions.length) {
        alert('Please generate a report first.');
        return;
    }
    
    // Check if SheetJS is available
    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded. Please check the CDN link.');
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
        transaction.items.forEach(item => {
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

