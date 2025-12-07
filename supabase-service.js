// Supabase API Service
// Handles Supabase initialization plus tenant-aware CRUD helpers

if (!window.BranchRouter) {
    window.BranchRouter = (() => {
        const HOTEL_PARAM = 'hotel';
        const BRANCH_PARAM = 'branch';

        const normalize = (value) => {
            if (value === null || value === undefined) return null;
            const trimmed = String(value).trim();
            return trimmed ? decodeURIComponent(trimmed).toLowerCase() : null;
        };

        const normalizeHotelNameForUrl = (value) => {
            const normalized = normalize(value);
            if (!normalized) return null;
            return normalized.replace(/\s+/g, '-');
        };

        // Parse path-based URL: /kagzso/admin/{hotel_name}/{branch_slug} or /kagzso/user/{hotel_name}/{branch_slug}
        // Also supports hash-based routing: #/kagzso/admin/... (for static hosting)
        const parsePath = () => {
            try {
                // Check hash first (for static hosting compatibility)
                let pathToParse = window.location.pathname;
                if (window.location.hash && window.location.hash.startsWith('#/')) {
                    pathToParse = window.location.hash.substring(1); // Remove #
                }
                
                // Remove leading/trailing slashes and split
                const parts = pathToParse.replace(/^\/+|\/+$/g, '').split('/').filter(p => p);
                
                // Check for kagzso format: kagzso/{admin|user}/{hotel_name}/{branch_slug}
                if (parts.length >= 3 && parts[0].toLowerCase() === 'kagzso') {
                    const type = parts[1].toLowerCase(); // 'admin' or 'user'
                    const hotelName = normalize(parts[2]); // hotel name
                    const branchSlug = parts.length >= 4 ? normalize(parts[3]) : null; // branch slug (optional)
                    
                    return {
                        hotelKey: hotelName,
                        branchKey: branchSlug,
                        urlType: type, // 'admin' or 'user'
                        isKagzsoFormat: true
                    };
                }
                
                // Legacy format: /Hotel-001/madurai-branch or /Hotel-001
                if (parts.length === 0) return { hotelKey: null, branchKey: null, isKagzsoFormat: false };
                if (parts.length === 1) return { hotelKey: normalize(parts[0]), branchKey: null, isKagzsoFormat: false };
                if (parts.length >= 2) return { hotelKey: normalize(parts[0]), branchKey: normalize(parts[1]), isKagzsoFormat: false };
            } catch (error) {
                console.warn('BranchRouter: unable to parse path', error);
            }
            return { hotelKey: null, branchKey: null, isKagzsoFormat: false };
        };

        // Fallback: Parse query params (for backward compatibility)
        const getUrlParam = (key) => {
            try {
                const url = new URL(window.location.href);
                const queryValue = url.searchParams.get(key);
                if (queryValue) return normalize(queryValue);
            } catch (error) {
                console.warn('BranchRouter: unable to parse URL', error);
            }
            return null;
        };

        const matchesBranch = (branch, branchKey, hotelKey = null) => {
            if (!branch) return false;
            
            // If branchKey provided, match by branch slug/id
            if (branchKey) {
                const slug = branch.slug ? String(branch.slug).toLowerCase() : null;
                const id = branch.id !== undefined && branch.id !== null ? String(branch.id).toLowerCase() : null;
                const urlPath = branch.url_path ? String(branch.url_path).toLowerCase() : null;
                
                // Match by slug, id, or url_path segment
                const branchMatches = slug === branchKey || id === branchKey || 
                    (urlPath && urlPath.endsWith('/' + branchKey));
                
                if (!branchMatches) return false;
            }
            
            // If hotel key provided, match by hotel name or hotel_id
            if (hotelKey) {
                // Try matching by hotel name first (for kagzso format)
                if (branch.hotelName) {
                    const hotelNameForUrl = normalizeHotelNameForUrl(branch.hotelName);
                        if (hotelNameForUrl === hotelKey) return true;
                    const rawHotelName = normalize(branch.hotelName);
                    if (rawHotelName === hotelKey) return true;
                }
                // Fallback to hotel_id matching
                if (branch.hotel_id) {
                    const hotelId = String(branch.hotel_id).toLowerCase();
                    if (hotelId === hotelKey) return true;
                }
                return false;
            }
            
            // No hotel key - match any branch
            return true;
        };

        const getRawKeys = () => {
            // Try path-based first
            const pathKeys = parsePath();
            if (pathKeys.hotelKey || pathKeys.branchKey) {
                return pathKeys;
            }
            
            // Fallback to query params (backward compatibility)
            return {
                hotelKey: getUrlParam(HOTEL_PARAM),
                branchKey: getUrlParam(BRANCH_PARAM)
            };
        };

        // Determine if current page is admin or user
        const getCurrentPageType = () => {
            const pathKeys = parsePath();
            if (pathKeys.isKagzsoFormat) {
                return pathKeys.urlType; // 'admin' or 'user'
            }
            // Check if we're on admin.html
            if (window.location.pathname.includes('admin.html') || 
                window.location.pathname.includes('/admin')) {
                return 'admin';
            }
            return 'user'; // Default to user
        };

        // Construct path from branch data
        const getPathFromBranch = (hotel, branch, pageType = null) => {
            if (!hotel || !hotel.id) return null;
            
            // Determine page type if not provided
            if (!pageType) {
                pageType = getCurrentPageType();
            }
            
            // Use admin_url or user_url if available
            if (branch) {
                if (pageType === 'admin' && branch.adminUrl) {
                    return '/' + branch.adminUrl;
                }
                if (pageType === 'user' && branch.userUrl) {
                    return '/' + branch.userUrl;
                }
            }
            
            // Fallback: construct from hotel name and branch slug
            // Get hotel name from hotel object, branch object, or use hotel id
            let hotelName = null;
            if (hotel && hotel.name) {
                hotelName = String(hotel.name).toLowerCase().replace(/\s+/g, '-');
            } else if (branch && branch.hotelName) {
                hotelName = String(branch.hotelName).toLowerCase().replace(/\s+/g, '-');
            } else if (hotel && hotel.id) {
                hotelName = String(hotel.id).toLowerCase();
            }
            
            if (branch && (branch.slug || branch.id) && hotelName) {
                const branchSlug = branch.slug || branch.id;
                return `/kagzso/${pageType}/${hotelName}/${branchSlug}`;
            } else if (hotelName) {
                // Hotel only
                return `/kagzso/${pageType}/${hotelName}`;
            }
            return null;
        };

        const applyToUrl = (hotel, branch) => {
            try {
                const newPath = getPathFromBranch(hotel, branch);
                
                if (newPath) {
                    // Use hash-based routing for static hosting compatibility
                    // Format: index.html#/kagzso/admin/... or admin.html#/kagzso/admin/...
                    window.location.hash = newPath;
                    // Also try to update pathname if possible (for servers that support it)
                    try {
                        const url = new URL(window.location.href);
                        url.pathname = newPath;
                        url.search = '';
                        url.hash = '';
                        history.replaceState({}, '', url.toString());
                    } catch (e) {
                        // If pathname update fails, hash-based routing will work
                        history.replaceState({}, '', window.location.pathname + window.location.search + '#' + newPath);
                    }
                } else {
                    // Fallback to query params if path construction fails
                    const url = new URL(window.location.href);
                    if (hotel && hotel.id) {
                        url.searchParams.set(HOTEL_PARAM, hotel.slug || hotel.id);
                        sessionStorage.setItem('selectedHotelId', hotel.id);
                    }
                    if (branch && branch.id) {
                        url.searchParams.set(BRANCH_PARAM, branch.slug || branch.id);
                        sessionStorage.setItem('selectedBranchId', branch.id);
                        if (branch.slug) {
                            sessionStorage.setItem('selectedBranchSlug', branch.slug);
                        }
                    }
                    history.replaceState({}, '', url.toString());
                }
                
                // Update session storage
                if (hotel && hotel.id) {
                    sessionStorage.setItem('selectedHotelId', hotel.id);
                }
                if (branch && branch.id) {
                    sessionStorage.setItem('selectedBranchId', branch.id);
                    if (branch.slug) {
                        sessionStorage.setItem('selectedBranchSlug', branch.slug);
                    }
                }
            } catch (error) {
                console.warn('BranchRouter: unable to update URL', error);
            }
        };

        const clearParams = () => {
            try {
                const url = new URL(window.location.href);
                // Clear path and query params
                url.pathname = '/';
                url.search = '';
                history.replaceState({}, '', url.toString());
            } catch (error) {
                console.warn('BranchRouter: unable to clear params', error);
            }
        };

        const resolveSelection = (branchList = [], fallbackBranchId = '', fallbackHotelId = '') => {
            const branches = Array.isArray(branchList) ? branchList : [];
            const pathKeys = getRawKeys();
            const { hotelKey, branchKey, isKagzsoFormat } = pathKeys;
            
            // If both hotel and branch in URL, match both
            if (hotelKey && branchKey) {
                const matched = branches.find(branch => matchesBranch(branch, branchKey, hotelKey));
                if (matched) {
                    return { 
                        hotelId: matched.hotel_id || matched.hotelId, 
                        branchId: matched.id, 
                        branch: matched, 
                        matchedViaRouting: true,
                        urlType: pathKeys.urlType || null
                    };
                }
            }
            
            // If only hotel in URL (no branch), return hotel only (show all branches for that hotel)
            if (hotelKey && !branchKey) {
                // Find hotel by matching hotel name (for kagzso format) or hotel_id (for legacy)
                const hotelBranches = branches.filter(branch => {
                    if (isKagzsoFormat && branch.hotelName) {
                        const branchHotelNameSlug = normalizeHotelNameForUrl(branch.hotelName);
                        if (branchHotelNameSlug && branchHotelNameSlug === hotelKey) {
                            return true;
                        }
                        const rawBranchHotelName = normalize(branch.hotelName);
                        return rawBranchHotelName === hotelKey;
                    } else {
                        const branchHotelId = String(branch.hotel_id || branch.hotelId || '').toLowerCase();
                        return branchHotelId === hotelKey;
                    }
                });
                if (hotelBranches.length > 0) {
                    // Return hotel ID but no branch ID - this signals to show all branches
                    return {
                        hotelId: hotelBranches[0].hotel_id || hotelBranches[0].hotelId,
                        branchId: '', // Empty branchId means show all branches
                        branch: null,
                        matchedViaRouting: true,
                        urlType: pathKeys.urlType || null
                    };
                }
            }
            
            // If only branch in URL, match by branch (legacy support)
            if (branchKey && !hotelKey) {
                const matched = branches.find(branch => matchesBranch(branch, branchKey));
                if (matched) {
                    return { 
                        hotelId: matched.hotel_id || matched.hotelId, 
                        branchId: matched.id, 
                        branch: matched, 
                        matchedViaRouting: true 
                    };
                }
            }
            
            // Fallback to sessionStorage or first branch
            if (fallbackBranchId) {
                const matchedById = branches.find(branch => String(branch.id) === String(fallbackBranchId));
                if (matchedById) {
                    return { 
                        hotelId: matchedById.hotel_id || matchedById.hotelId, 
                        branchId: matchedById.id, 
                        branch: matchedById, 
                        matchedViaRouting: false 
                    };
                }
            }
            
            if (branches.length > 0) {
                return { 
                    hotelId: branches[0].hotel_id || branches[0].hotelId, 
                    branchId: branches[0].id, 
                    branch: branches[0], 
                    matchedViaRouting: false 
                };
            }
            
            return { 
                hotelId: fallbackHotelId || '', 
                branchId: fallbackBranchId || '', 
                branch: null, 
                matchedViaRouting: false 
            };
        };

        return {
            getHotelKey: () => getRawKeys().hotelKey,
            getBranchKey: () => getRawKeys().branchKey,
            resolveSelection,
            setActiveBranch: (branch, hotel = null) => applyToUrl(hotel, branch),
            clearBranchParam: clearParams
        };
    })();
}

if (window.supabaseApi) {
    // Prevent duplicate definition when HTML accidentally includes this script twice
    console.warn('supabase-service.js already loaded; skipping redefinition.');
} else {
if (!window.supabase) {
    console.error('Supabase client not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
}

class SupabaseAPI {
    constructor() {
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.supabaseClient = null;
        this.configLoaded = false;
        this.configCache = new Map();
        this.cache = new Map();
        this.cacheDurations = {
            branches: 5 * 60 * 1000,
            menu: 3 * 60 * 1000,
            sales: 60 * 1000
        };
    }

    getRuntimeConfig() {
        // Priority 1: window.SUPABASE_CONFIG (set by inline script)
        if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
            return window.SUPABASE_CONFIG;
        }
        
        // Priority 2: window environment variables
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            return { url: window.SUPABASE_URL, anonKey: window.SUPABASE_ANON_KEY };
        }
        
        // Priority 3: Load from localStorage (fallback)
        try {
            const stored = localStorage.getItem('supabase_config');
            if (stored) {
                const config = JSON.parse(stored);
                
                // Handle both formats: {url, anonKey} and {supabaseUrl, supabaseKey}
                let url, anonKey;
                if (config.url && config.anonKey) {
                    url = config.url;
                    anonKey = config.anonKey;
                } else if (config.supabaseUrl && config.supabaseKey) {
                    url = config.supabaseUrl;
                    anonKey = config.supabaseKey;
                }
                
                if (url && anonKey) {
                    // Also set window.SUPABASE_CONFIG for future use
                    window.SUPABASE_CONFIG = { url: url.trim(), anonKey: anonKey.trim() };
                    console.log('✅ Loaded Supabase config from localStorage and set window.SUPABASE_CONFIG');
                    return window.SUPABASE_CONFIG;
                }
            }
        } catch (error) {
            console.warn('Failed to parse stored Supabase config', error);
        }
        
        return null;
    }

    async initialize() {
        if (this.supabaseClient) {
            return this.supabaseClient;
        }
        const cfg = this.getRuntimeConfig();
        if (!cfg || !cfg.url || !cfg.anonKey) {
            console.warn('Supabase config missing. Provide window.SUPABASE_CONFIG before loading supabase-service.js');
            this.configLoaded = false;
            return null;
        }
        this.supabaseUrl = cfg.url;
        this.supabaseKey = cfg.anonKey;
        this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
        this.configLoaded = true;
        return this.supabaseClient;
    }

    async ensureClient() {
        const client = await this.initialize();
        if (!client) {
            throw new Error('Supabase client not initialized');
        }
        return client;
    }

    setCached(key, value, ttl) {
        this.cache.set(key, { value, expires: Date.now() + ttl });
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        if (cached.expires < Date.now()) {
            this.cache.delete(key);
            return null;
        }
        return cached.value;
    }

    async fetchBranches({ hotelId = null, useCache = true } = {}) {
        const cacheKey = hotelId ? `branches_${hotelId}` : 'branches';
        if (useCache) {
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const client = await this.ensureClient();
        let query = client
            .from('branches')
            .select(`
                id,
                name,
                slug,
                qr_code_url,
                hotel_id,
                url_path,
                admin_url,
                user_url,
                hotels!inner(name)
            `)
            .order('name', { ascending: true });
        
        // STRICT: Filter by hotel_id if provided (multi-hotel support)
        if (hotelId) {
            query = query.eq('hotel_id', hotelId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        const branches = (data || []).map(branch => ({
            id: branch.id,
            name: branch.name,
            slug: branch.slug,
            qrCodeURL: branch.qr_code_url || '',
            hotelId: branch.hotel_id || branch.hotelId || null,
            hotelName: branch.hotels?.name || null,
            urlPath: branch.url_path || null,
            adminUrl: branch.admin_url || null,
            userUrl: branch.user_url || null
        }));
        if (useCache && branches.length) {
            this.setCached(cacheKey, branches, this.cacheDurations.branches);
        }
        return branches;
    }

    async getBranches(useCache = true) {
        try {
            const branches = await this.fetchBranches({ useCache });
            return { branches };
        } catch (error) {
            console.error('Error fetching branches:', error);
            return { branches: [] };
        }
    }

    async fetchMenu(branchId, { hotelId = null, useCache = true } = {}) {
        if (!branchId) {
            console.warn('⚠️ fetchMenu called without branchId');
            return [];
        }
        const cacheKey = hotelId ? `menu_${hotelId}_${branchId}` : `menu_${branchId}`;
        if (useCache) {
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const client = await this.ensureClient();
        console.log(`📡 Fetching menu from Supabase for hotel_id: ${hotelId || 'any'}, branch_id: ${branchId}`);
        let query = client
            .from('menu_items')
            .select('*')
            .eq('branch_id', branchId)
            .order('category', { ascending: true })
            .order('name', { ascending: true });
        
        // STRICT: Filter by hotel_id if provided (multi-hotel support)
        if (hotelId) {
            query = query.eq('hotel_id', hotelId);
        }
        
        const { data, error } = await query;
        if (error) {
            console.error(`❌ Supabase error fetching menu for hotel ${hotelId}, branch ${branchId}:`, error);
            throw error;
        }
        console.log(`📦 Supabase returned ${(data || []).length} items for hotel ${hotelId || 'any'}, branch ${branchId}`);
        const items = (data || []).map(item => this.normalizeMenuItem(item));
        if (useCache && items.length) {
            this.setCached(cacheKey, items, this.cacheDurations.menu);
        }
        return items;
    }

    async getMenu(branchId, useCache = true) {
        try {
            const items = await this.fetchMenu(branchId, { useCache });
            return { items };
        } catch (error) {
            console.error('Error fetching menu:', error);
            return { items: [] };
        }
    }

    async saveMenuItem(item) {
        const client = await this.ensureClient();
        let branchName = item.branchName;
        if (!branchName && item.branchId) {
            const { data: branchData } = await client
                .from('branches')
                .select('name')
                .eq('id', item.branchId)
                .single();
            branchName = branchData?.name || '';
        }
        const payload = this.prepareMenuItemPayload({ ...item, branchName });
        const { data: existing } = await client
            .from('menu_items')
            .select('id')
            .eq('id', item.id)
            .eq('branch_id', item.branchId)
            .maybeSingle();

        let result;
        if (existing) {
            const { data, error } = await client
                .from('menu_items')
                .update(payload)
                .eq('id', item.id)
                .eq('branch_id', item.branchId)
                .select()
                .single();
            if (error) throw error;
            result = { success: true, data };
        } else {
            const { data, error } = await client
                .from('menu_items')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            result = { success: true, data };
        }

        if (item.branchId) {
            this.cache.delete(`menu_${item.branchId}`);
        }
        return result;
    }

    async deleteMenuItem(itemId, branchId) {
        const client = await this.ensureClient();
        const { error } = await client
            .from('menu_items')
            .delete()
            .eq('id', itemId)
            .eq('branch_id', branchId);
        if (error) throw error;
        if (branchId) {
            this.cache.delete(`menu_${branchId}`);
        }
        return { success: true };
    }

    async saveOrder(order) {
        const client = await this.ensureClient();
        const branchId = order.branch_id || order.branchId || sessionStorage.getItem('selectedBranchId') || 'demo-branch';
        const hotelId = order.hotel_id || order.hotelId || sessionStorage.getItem('selectedHotelId') || null;
        const branchName = order.branch_name || order.branchName || null;
        
        // Get hotel_id from branch if not provided
        let finalHotelId = hotelId;
        if (!finalHotelId && branchId) {
            try {
                const { data: branchData } = await client
                    .from('branches')
                    .select('hotel_id')
                    .eq('id', branchId)
                    .maybeSingle();
                finalHotelId = branchData?.hotel_id || null;
            } catch (e) {
                console.warn('Could not fetch hotel_id from branch', e);
            }
        }
        
        const nowIso = new Date().toISOString();
        const isoDate = order.date || nowIso.slice(0, 10);
        const isoDateTime = order.dateTime || order.date_time || nowIso;

        let transactionId = order.id;
        if (!transactionId) {
            try {
                const { data: generatedId } = await client.rpc('get_next_transaction_id');
                transactionId = generatedId || String(Date.now());
            } catch (idError) {
                console.warn('Falling back to timestamp-based transaction id', idError);
                transactionId = String(Date.now());
            }
        }

        const transactionData = {
            id: transactionId,
            hotel_id: finalHotelId,  // STRICT: Include hotel_id for multi-hotel support
            branch_id: branchId,
            branch_name: branchName,
            date: isoDate,
            date_time: isoDateTime,
            order_type: order.orderType || order.order_type || 'Dining',
            total_base_amount: this.parseDecimal(order.totalBaseAmount),
            total_cgst_amount: this.parseDecimal(order.totalCgstAmount),
            total_sgst_amount: this.parseDecimal(order.totalSgstAmount),
            total_gst_amount: this.parseDecimal(order.totalGstAmount),
            total: this.parseDecimal(order.total),
            payment_mode: order.paymentMode || order.payment_mode || 'Cash',
            applied_gst_rate: this.parseDecimal(order.appliedGstRate),
            show_tax_on_bill: order.showTaxOnBill !== false,
            qr_code_url: order.qrCodeURL || order.qr_code_url || null
        };

        const { data: savedTransaction, error: transactionError } = await client
            .from('transactions')
            .insert(transactionData)
            .select()
            .single();
        if (transactionError) {
            this.queueOfflineTransaction(order);
            throw transactionError;
        }

        const items = order.items || [];
        if (items.length) {
            const payload = items.map(item => ({
                transaction_id: transactionId,
                hotel_id: finalHotelId,  // STRICT: Include hotel_id for multi-hotel support
                branch_id: branchId,
                item_id: item.id || null,
                item_name: item.name || '',
                order_type: item.orderType || order.orderType || 'Dining',
                price: this.parseDecimal(item.price),
                base_price: this.parseDecimal(item.basePrice),
                final_price: this.parseDecimal(item.finalPrice ?? item.price),
                cgst_percentage: this.parseDecimal(item.cgstPercentage),
                sgst_percentage: this.parseDecimal(item.sgstPercentage),
                cgst_amount: this.parseDecimal(item.cgstAmount),
                sgst_amount: this.parseDecimal(item.sgstAmount),
                gst_value: this.parseDecimal(item.gstValue),
                price_includes_tax: item.priceIncludesTax !== false,
                quantity: parseInt(item.quantity, 10) || 1,
                size: item.size || null,
                subtotal: this.parseDecimal(item.subtotal ?? ((item.finalPrice ?? (item.price || 0)) * (parseInt(item.quantity, 10) || 1)))
            }));
            const { error: itemsError } = await client
                .from('transaction_items')
                .insert(payload);
            if (itemsError) {
                console.warn('Transaction saved but items failed', itemsError);
            }
        }

        return { success: true, data: { ...savedTransaction, items } };
    }

    async saveSale(transaction) {
        return this.saveOrder(transaction);
    }

    async fetchSales({ hotelId = null, branchId = null, fromDate = null, toDate = null } = {}) {
        // STRICT TENANT ISOLATION: branchId is required
        if (!branchId) {
            console.warn('⚠️ fetchSales called without branchId - returning empty array (strict isolation)');
            return [];
        }
        
        const client = await this.ensureClient();
        let query = client
            .from('transactions')
            .select(`
                *,
                transaction_items (
                    id,
                    branch_id,
                    hotel_id,
                    item_id,
                    item_name,
                    order_type,
                    price,
                    base_price,
                    final_price,
                    cgst_percentage,
                    sgst_percentage,
                    cgst_amount,
                    sgst_amount,
                    gst_value,
                    price_includes_tax,
                    quantity,
                    size,
                    subtotal
                )
            `)
            .eq('branch_id', branchId);  // STRICT: Always filter by branch_id
        
        // STRICT: Filter by hotel_id if provided (multi-hotel support)
        if (hotelId) {
            query = query.eq('hotel_id', hotelId);
        }
        
        query = query.order('date_time', { ascending: false });
        if (fromDate) {
            query = query.gte('date', fromDate);
        }
        if (toDate) {
            query = query.lte('date', toDate);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(trans => {
            const items = (trans.transaction_items || []).map(item => ({
                id: item.item_id,
                name: item.item_name,
                price: this.parseDecimal(item.price) || 0,
                basePrice: this.parseDecimal(item.base_price),
                finalPrice: this.parseDecimal(item.final_price),
                quantity: parseInt(item.quantity, 10) || 1,
                size: item.size || null,
                orderType: item.order_type || trans.order_type || 'Dining',
                cgstPercentage: this.parseDecimal(item.cgst_percentage),
                sgstPercentage: this.parseDecimal(item.sgst_percentage),
                cgstAmount: this.parseDecimal(item.cgst_amount),
                sgstAmount: this.parseDecimal(item.sgst_amount),
                gstValue: this.parseDecimal(item.gst_value),
                priceIncludesTax: item.price_includes_tax !== false,
                subtotal: this.parseDecimal(item.subtotal)
            }));
            return {
                id: trans.id,
                branchId: trans.branch_id,
                branchName: trans.branch_name,
                date: trans.date,
                dateTime: trans.date_time,
                orderType: trans.order_type,
                items,
                totalBaseAmount: this.parseDecimal(trans.total_base_amount),
                totalCgstAmount: this.parseDecimal(trans.total_cgst_amount),
                totalSgstAmount: this.parseDecimal(trans.total_sgst_amount),
                totalGstAmount: this.parseDecimal(trans.total_gst_amount),
                total: this.parseDecimal(trans.total) || 0,
                paymentMode: trans.payment_mode,
                qrCodeURL: trans.qr_code_url,
                appliedGstRate: this.parseDecimal(trans.applied_gst_rate),
                showTaxOnBill: trans.show_tax_on_bill !== false
            };
        });
    }

    async getSales(branchId = null, fromDate = null, toDate = null) {
        try {
            const transactions = await this.fetchSales({ branchId, fromDate, toDate });
            return { transactions };
        } catch (error) {
            console.error('Error fetching sales:', error);
            return { transactions: [] };
        }
    }

    async getConfig(key) {
        if (this.configCache.has(key)) {
            return this.configCache.get(key);
        }
        const client = await this.ensureClient();
        const { data, error } = await client
            .from('config')
            .select('value')
            .eq('key', key)
            .maybeSingle();
        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        const value = data ? data.value : null;
        this.configCache.set(key, value);
        return value;
    }

    async getConfigs(keys = []) {
        const client = await this.ensureClient();
        let query = client.from('config').select('key,value');
        if (keys.length) {
            query = query.in('key', keys);
        }
        const { data, error } = await query;
        if (error) throw error;
        const result = {};
        (data || []).forEach(row => {
            result[row.key] = row.value;
            this.configCache.set(row.key, row.value);
        });
        return result;
    }

    async setConfig(key, value) {
        const client = await this.ensureClient();
        const { error } = await client
            .from('config')
            .upsert({ key, value }, { onConflict: 'key' });
        if (error) throw error;
        this.configCache.set(key, value);
        return true;
    }

    async setConfigs(configObj = {}) {
        const entries = Object.entries(configObj);
        if (!entries.length) return true;
        const client = await this.ensureClient();
        const payload = entries.map(([key, value]) => ({ key, value }));
        const { error } = await client
            .from('config')
            .upsert(payload, { onConflict: 'key' });
        if (error) throw error;
        entries.forEach(([key, value]) => this.configCache.set(key, value));
        return true;
    }

    async verifyHotelAdminPassword({ hotelIdentifier, password }) {
        const trimmedIdentifier = hotelIdentifier ? String(hotelIdentifier).trim() : '';
        const trimmedPassword = password ? String(password).trim() : '';
        if (!trimmedIdentifier || !trimmedPassword) {
            throw new Error('Hotel identifier and password are required for verification');
        }
        const client = await this.ensureClient();
        
        // Try multiple identifier formats to match the database
        // The database function matches: hotel_id, slug, name, or REPLACE(name, ' ', '-')
        const identifiersToTry = [
            trimmedIdentifier,                    // Original: "suganya-hotel"
            trimmedIdentifier.replace(/-hotel$/, ''), // Remove "-hotel": "suganya"
            trimmedIdentifier.replace(/-hotel$/i, ''), // Case-insensitive: "suganya"
        ];
        
        // Remove duplicates
        const uniqueIdentifiers = [...new Set(identifiersToTry)];
        
        console.log('🔍 Trying hotel identifiers:', uniqueIdentifiers);
        
        // Try each identifier format
        for (const identifier of uniqueIdentifiers) {
            try {
                const { data, error } = await client.rpc('verify_hotel_admin_password', {
                    p_hotel_identifier: identifier,
                    p_password: trimmedPassword
                });
                
                if (error) {
                    console.warn(`⚠️ Verification failed for "${identifier}":`, error.message);
                    continue; // Try next identifier
                }
                
                if (data === true) {
                    console.log(`✅ Password verified successfully with identifier: "${identifier}"`);
                    return true;
                }
            } catch (err) {
                console.warn(`⚠️ Error verifying with "${identifier}":`, err.message);
                continue; // Try next identifier
            }
        }
        
        // If all attempts failed
        console.error('❌ Password verification failed for all identifier formats');
        return false;
    }

    parseDecimal(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? null : parseFloat(parsed.toFixed(2));
    }

    normalizeMenuItem(item) {
        return {
            id: item.id,
            branchId: item.branch_id,
            branchName: item.branch_name || '',
            hotelId: item.hotel_id || null,
            hotel_id: item.hotel_id || null, // Keep both for compatibility
            name: item.name,
            category: item.category || '',
            price: this.parseDecimal(item.price),
            hasSizes: item.has_sizes || false,
            sizes: item.sizes || null,
            image: item.image || '',
            availability: item.availability || 'Available',
            pricingMode: item.pricing_mode || 'inclusive',
            pricingMetadata: item.pricing_metadata || {},
            gst: {
                dining: {
                    cgst: this.parseDecimal(item.dining_cgst_percentage) || 0,
                    sgst: this.parseDecimal(item.dining_sgst_percentage) || 0
                },
                takeaway: {
                    cgst: this.parseDecimal(item.takeaway_cgst_percentage) || 0,
                    sgst: this.parseDecimal(item.takeaway_cgst_percentage) || 0
                },
                onlineorder: {
                    cgst: this.parseDecimal(item.onlineorder_cgst_percentage) || 0,
                    sgst: this.parseDecimal(item.onlineorder_sgst_percentage) || 0
                }
            },
            showTaxOnBill: item.show_tax_on_bill !== false
        };
    }

    prepareMenuItemPayload(item) {
        return {
            id: item.id,
            branch_id: item.branchId,
            branch_name: item.branchName || '',
            name: item.name,
            category: item.category || null,
            price: this.parseDecimal(item.price),
            has_sizes: item.hasSizes || false,
            sizes: item.sizes || null,
            image: item.image || null,
            availability: item.availability || 'Available',
            pricing_mode: item.pricingMode || 'inclusive',
            pricing_metadata: item.pricingMetadata || {},
            dining_cgst_percentage: this.parseDecimal(item.gst?.dining?.cgst),
            dining_sgst_percentage: this.parseDecimal(item.gst?.dining?.sgst),
            takeaway_cgst_percentage: this.parseDecimal(item.gst?.takeaway?.cgst),
            takeaway_sgst_percentage: this.parseDecimal(item.gst?.takeaway?.sgst),
            onlineorder_cgst_percentage: this.parseDecimal(item.gst?.onlineorder?.cgst),
            onlineorder_sgst_percentage: this.parseDecimal(item.gst?.onlineorder?.sgst),
            show_tax_on_bill: item.showTaxOnBill !== false
        };
    }

    queueOfflineTransaction(transaction) {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        queue.push({ transaction, timestamp: new Date().toISOString() });
        localStorage.setItem('offline_queue', JSON.stringify(queue));
    }

    async retryOfflineTransactions() {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        if (!queue.length) return;
        const remaining = [];
        for (const entry of queue) {
            try {
                await this.saveOrder(entry.transaction);
            } catch (error) {
                console.error('Failed to replay offline transaction', error);
                remaining.push(entry);
            }
        }
        localStorage.setItem('offline_queue', JSON.stringify(remaining));
    }
}

const supabaseApi = new SupabaseAPI();
window.supabaseApi = supabaseApi;
window.apiService = supabaseApi;
}