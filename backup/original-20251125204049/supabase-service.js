// Supabase API Service
// This service handles all communication with Supabase database

class SupabaseAPI {
    constructor() {
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.supabaseClient = null;
        this.configLoaded = false;
        this.configCache = new Map();
    }

    // Initialize - Load config from localStorage or environment
    async initialize() {
        try {
            // Try to load from localStorage first
            const storedConfig = localStorage.getItem('supabase_config');
            if (storedConfig) {
                const config = JSON.parse(storedConfig);
                this.supabaseUrl = config.supabaseUrl;
                this.supabaseKey = config.supabaseKey;
                
                if (this.supabaseUrl && this.supabaseKey) {
                    // Initialize Supabase client
                    this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseKey);
                    this.configLoaded = true;
                    console.log('✅ Supabase initialized from localStorage');
                    return true;
                }
            }

            // If not in localStorage, check for config in HTML or environment
            // You can set these in your HTML: <script>window.SUPABASE_URL = '...'; window.SUPABASE_KEY = '...';</script>
            if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
                this.supabaseUrl = window.SUPABASE_URL;
                this.supabaseKey = window.SUPABASE_ANON_KEY;
                this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseKey);
                this.configLoaded = true;
                console.log('✅ Supabase initialized from window variables');
                return true;
            }

            console.warn('⚠️ Supabase credentials not found. Please configure them.');
            return false;
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            return false;
        }
    }

    // Set Supabase credentials
    setCredentials(url, key) {
        this.supabaseUrl = url;
        this.supabaseKey = key;
        this.supabaseClient = supabase.createClient(url, key);
        localStorage.setItem('supabase_config', JSON.stringify({ supabaseUrl: url, supabaseKey: key }));
        this.configLoaded = true;
        console.log('✅ Supabase credentials set');
    }

    // Get all branches
    async getBranches(useCache = true) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            // Check cache first (5 minute cache)
            if (useCache) {
                const cacheKey = 'supabase_branches_cache';
                const cacheTime = 5 * 60 * 1000; // 5 minutes
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const cacheData = JSON.parse(cached);
                        const now = Date.now();
                        if (cacheData.timestamp && (now - cacheData.timestamp) < cacheTime && cacheData.data && cacheData.data.branches && cacheData.data.branches.length > 0) {
                            console.log('✅ Using cached branches data');
                            return cacheData.data;
                        }
                    } catch (e) {
                        console.warn('Cache data corrupted, fetching fresh data');
                        localStorage.removeItem(cacheKey);
                    }
                }
            }

            console.log('📡 Fetching branches from Supabase...');
            const { data, error } = await this.supabaseClient
                .from('branches')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                throw new Error(`Supabase error: ${error.message}`);
            }

            // Transform data to match expected format
            const branches = (data || []).map(branch => ({
                id: branch.id,
                name: branch.name,
                qrCodeURL: branch.qr_code_url || ''
            }));

            const response = { branches };

            // Cache the response
            if (useCache && branches.length > 0) {
                const cacheKey = 'supabase_branches_cache';
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: response,
                    timestamp: Date.now()
                }));
            }

            console.log(`✅ Fetched ${branches.length} branches from Supabase`);
            return response;
        } catch (error) {
            console.error('Error fetching branches:', error);
            // Try to return cached data even if expired
            const cacheKey = 'supabase_branches_cache';
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const cacheData = JSON.parse(cached);
                    if (cacheData.data && cacheData.data.branches && cacheData.data.branches.length > 0) {
                        console.log('⚠️ Using expired cache due to error');
                        return cacheData.data;
                    }
                } catch (e) {
                    console.warn('Failed to parse cache:', e);
                }
            }
            return { branches: [] };
        }
    }

    // Get menu for a specific branch
    async getMenu(branchId, useCache = true) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            if (!branchId) {
                return { items: [] };
            }

            // Check cache first (3 minute cache)
            if (useCache && branchId) {
                const cacheKey = `supabase_menu_cache_${branchId}`;
                const cacheTime = 3 * 60 * 1000; // 3 minutes
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const cacheData = JSON.parse(cached);
                    const now = Date.now();
                    if (cacheData.timestamp && (now - cacheData.timestamp) < cacheTime) {
                        console.log(`✅ Using cached menu data for branch ${branchId}`);
                        return cacheData.data;
                    }
                }
            }

            console.log(`📡 Fetching menu for branch ${branchId} from Supabase...`);
            const { data, error } = await this.supabaseClient
                .from('menu_items')
                .select('*')
                .eq('branch_id', branchId)
                .order('name', { ascending: true });

            if (error) {
                throw new Error(`Supabase error: ${error.message}`);
            }

            // Transform data to match expected format
            const items = (data || []).map(item => this.normalizeMenuItem(item));

            const response = { items };

            // Cache the response
            if (useCache && branchId && items.length > 0) {
                const cacheKey = `supabase_menu_cache_${branchId}`;
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: response,
                    timestamp: Date.now()
                }));
            }

            console.log(`✅ Fetched ${items.length} menu items for branch ${branchId}`);
            return response;
        } catch (error) {
            console.error('Error fetching menu:', error);
            // Try to return cached data even if expired
            if (branchId) {
                const cacheKey = `supabase_menu_cache_${branchId}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const cacheData = JSON.parse(cached);
                    console.log('⚠️ Using expired cache due to error');
                    return cacheData.data;
                }
            }
            return { items: [] };
        }
    }

    // Add or update menu item
    async saveMenuItem(item) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            // Get branch name if not provided
            let branchName = item.branchName;
            if (!branchName && item.branchId) {
                const { data: branch } = await this.supabaseClient
                    .from('branches')
                    .select('name')
                    .eq('id', item.branchId)
                    .single();
                branchName = branch?.name || '';
            }

            // Transform item to match database schema
            const menuItemData = this.prepareMenuItemPayload({
                ...item,
                branchName
            });

            // Check if item exists
            const { data: existingItem } = await this.supabaseClient
                .from('menu_items')
                .select('id')
                .eq('id', item.id)
                .eq('branch_id', item.branchId)
                .single();

            let result;
            if (existingItem) {
                // Update existing item
                const { data, error } = await this.supabaseClient
                    .from('menu_items')
                    .update(menuItemData)
                    .eq('id', item.id)
                    .eq('branch_id', item.branchId)
                    .select()
                    .single();

                if (error) throw error;
                result = { success: true, data };
            } else {
                // Insert new item
                const { data, error } = await this.supabaseClient
                    .from('menu_items')
                    .insert(menuItemData)
                    .select()
                    .single();

                if (error) throw error;
                result = { success: true, data };
            }

            // Invalidate menu cache for this branch
            if (item.branchId) {
                const cacheKey = `supabase_menu_cache_${item.branchId}`;
                localStorage.removeItem(cacheKey);
            }

            return result;
        } catch (error) {
            console.error('Error saving menu item:', error);
            throw error;
        }
    }

    // Delete menu item
    async deleteMenuItem(itemId, branchId) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            const { error } = await this.supabaseClient
                .from('menu_items')
                .delete()
                .eq('id', itemId)
                .eq('branch_id', branchId);

            if (error) throw error;

            // Invalidate menu cache for this branch
            if (branchId) {
                const cacheKey = `supabase_menu_cache_${branchId}`;
                localStorage.removeItem(cacheKey);
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting menu item:', error);
            throw error;
        }
    }

    // Save sale transaction
    async saveSale(transaction) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            let transactionId = transaction.id;
            if (!transactionId) {
                const { data: idData, error: idError } = await this.supabaseClient
                    .rpc('get_next_transaction_id');

                if (idError) {
                    console.error('Error getting transaction ID:', idError);
                    throw idError;
                }

                transactionId = idData || '0001';
            }

            // Transform transaction to match database schema
            const transactionData = {
                id: transactionId,
                branch_id: transaction.branchId,
                branch_name: transaction.branchName || null,
                date: transaction.date,
                date_time: transaction.dateTime,
                order_type: transaction.orderType || 'Dining',
                total_base_amount: this.parseDecimal(transaction.totalBaseAmount),
                total_cgst_amount: this.parseDecimal(transaction.totalCgstAmount),
                total_sgst_amount: this.parseDecimal(transaction.totalSgstAmount),
                total_gst_amount: this.parseDecimal(transaction.totalGstAmount),
                total: this.parseDecimal(transaction.total),
                payment_mode: transaction.paymentMode || 'Cash',
                applied_gst_rate: this.parseDecimal(transaction.appliedGstRate),
                show_tax_on_bill: transaction.showTaxOnBill !== false,
                qr_code_url: transaction.qrCodeURL || null
            };

            console.log('Sending transaction to Supabase:', transactionData);
            
            // Insert transaction
            const { data: transData, error: transError } = await this.supabaseClient
                .from('transactions')
                .insert(transactionData)
                .select()
                .single();

            if (transError) throw transError;

            // Insert transaction items separately
            const items = transaction.items || [];
            if (items.length > 0) {
                const transactionItems = items.map(item => ({
                    transaction_id: transactionId,
                    item_id: item.id || null,
                    item_name: item.name || '',
                    order_type: item.orderType || transaction.orderType || 'Dining',
                    price: this.parseDecimal(item.price),
                    base_price: this.parseDecimal(item.basePrice),
                    final_price: this.parseDecimal(item.finalPrice ?? item.price),
                    cgst_percentage: this.parseDecimal(item.cgstPercentage),
                    sgst_percentage: this.parseDecimal(item.sgstPercentage),
                    cgst_amount: this.parseDecimal(item.cgstAmount),
                    sgst_amount: this.parseDecimal(item.sgstAmount),
                    gst_value: this.parseDecimal(item.gstValue),
                    price_includes_tax: item.priceIncludesTax !== false,
                    quantity: parseInt(item.quantity) || 1,
                    size: item.size || null,
                    subtotal: this.parseDecimal(item.subtotal ?? ((item.finalPrice ?? (item.price || 0)) * (parseInt(item.quantity) || 1)))
                }));

                const { error: itemsError } = await this.supabaseClient
                    .from('transaction_items')
                    .insert(transactionItems);

                if (itemsError) {
                    console.error('Error saving transaction items:', itemsError);
                    // Don't throw - transaction is already saved
                }
            }

            console.log('Transaction saved successfully:', transData);
            return { success: true, data: { ...transData, items } };
        } catch (error) {
            console.error('Error saving sale:', error);
            // Store in queue for retry
            this.queueOfflineTransaction(transaction);
            throw error;
        }
    }

    // Get sales data
    async getSales(branchId = null, fromDate = null, toDate = null) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            let query = this.supabaseClient
                .from('transactions')
                .select(`
                    *,
                    transaction_items (
                        id,
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
                .order('date_time', { ascending: false });

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (fromDate) {
                query = query.gte('date', fromDate);
            }

            if (toDate) {
                query = query.lte('date', toDate);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Supabase error: ${error.message}`);
            }

            // Transform data to match expected format
            const transactions = (data || []).map(trans => {
                // Convert transaction_items to items array format
                const items = (trans.transaction_items || []).map(item => ({
                    id: item.item_id,
                    name: item.item_name,
                    price: this.parseDecimal(item.price) || 0,
                    basePrice: this.parseDecimal(item.base_price),
                    finalPrice: this.parseDecimal(item.final_price),
                    quantity: parseInt(item.quantity) || 1,
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
                    items: items, // Items from transaction_items table
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

            return { transactions };
        } catch (error) {
            console.error('Error fetching sales:', error);
            return { transactions: [] };
        }
    }

    // Get single config value
    async getConfig(key) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }
            if (this.configCache.has(key)) {
                return this.configCache.get(key);
            }
            const { data, error } = await this.supabaseClient
                .from('config')
                .select('value')
                .eq('key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return null;
                }
                throw error;
            }

            const value = data ? data.value : null;
            this.configCache.set(key, value);
            return value;
        } catch (error) {
            console.error('Error fetching config:', error);
            return null;
        }
    }

    // Get multiple config values at once
    async getConfigs(keys = []) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            let query = this.supabaseClient.from('config').select('key, value');
            if (keys.length > 0) {
                query = query.in('key', keys);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            const result = {};
            (data || []).forEach(row => {
                result[row.key] = row.value;
                this.configCache.set(row.key, row.value);
            });

            return result;
        } catch (error) {
            console.error('Error fetching configs:', error);
            return {};
        }
    }

    async setConfig(key, value) {
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }

            const { error } = await this.supabaseClient
                .from('config')
                .upsert({ key, value }, { onConflict: 'key' });

            if (error) throw error;
            this.configCache.set(key, value);
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    async setConfigs(configObj = {}) {
        const entries = Object.entries(configObj);
        if (entries.length === 0) return true;
        try {
            if (!this.configLoaded || !this.supabaseClient) {
                await this.initialize();
            }
            const payload = entries.map(([key, value]) => ({ key, value }));
            const { error } = await this.supabaseClient
                .from('config')
                .upsert(payload, { onConflict: 'key' });

            if (error) throw error;
            entries.forEach(([key, value]) => this.configCache.set(key, value));
            return true;
        } catch (error) {
            console.error('Error saving configs:', error);
            return false;
        }
    }

    // Helpers -------------------------------------------------------
    parseDecimal(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parseFloat(parsed.toFixed(2));
    }

    normalizeMenuItem(item) {
        return {
            id: item.id,
            branchId: item.branch_id,
            branchName: item.branch_name || '',
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
                    sgst: this.parseDecimal(item.takeaway_sgst_percentage) || 0
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

    // Queue offline transaction for retry
    queueOfflineTransaction(transaction) {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        queue.push({
            transaction,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('offline_queue', JSON.stringify(queue));
    }

    // Retry offline transactions
    async retryOfflineTransactions() {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        if (queue.length === 0) return;

        const successful = [];
        for (const item of queue) {
            try {
                await this.saveSale(item.transaction);
                successful.push(item);
            } catch (error) {
                console.error('Failed to retry transaction:', error);
            }
        }

        // Remove successful transactions from queue
        const remaining = queue.filter(item => !successful.includes(item));
        localStorage.setItem('offline_queue', JSON.stringify(remaining));
    }
}

// Create global instance
const apiService = new SupabaseAPI();

// Make apiService globally accessible
window.apiService = apiService;
