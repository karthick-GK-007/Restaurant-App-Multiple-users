// Google Sheets API Service
// This service handles all communication with Google Sheets via Google Apps Script

class GoogleSheetsAPI {
    constructor() {
        // This will be loaded from Config tab in Google Sheets
        this.sheetId = null;
        this.appsScriptUrl = null;
        this.configLoaded = false;
    }

    // Initialize - Load config from Google Sheets Config tab
    async initialize() {
        try {
            const tempSheetId = '1GM4Nb-88OyJV16UeMwz7r3u1Flo1_UeZ4GDMQ9N-w_c';
            // Default Apps Script URL from Config tab
            const defaultAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbxOyVW3boDBkhPw6QnnyL1x7x1w4bOglUG4VplpURJINogKLlEAquu2LoOfo1uLlz9h/exec';
            
            // Try to load config from sessionStorage first (for performance)
            const cachedConfig = sessionStorage.getItem('gs_config');
            if (cachedConfig) {
                const config = JSON.parse(cachedConfig);
                this.sheetId = config.sheetId;
                this.appsScriptUrl = config.appsScriptUrl;
                if (this.sheetId && this.appsScriptUrl) {
                    this.configLoaded = true;
                    return true;
                }
            }

            // Try to get Apps Script URL from localStorage (manual setup)
            const storedAppsScriptUrl = localStorage.getItem('apps_script_url');
            if (storedAppsScriptUrl) {
                this.appsScriptUrl = storedAppsScriptUrl;
                this.sheetId = tempSheetId;
                this.configLoaded = true;
                
                // Try to fetch config from Apps Script
                // Don't block initialization if this fails (CORS issues, etc.)
                try {
                    const configResponse = await this.makeRequest('?action=config');
                    if (configResponse && configResponse.appsScriptURL) {
                        this.appsScriptUrl = configResponse.appsScriptURL;
                        this.sheetId = configResponse.sheetId || tempSheetId;
                        sessionStorage.setItem('gs_config', JSON.stringify({
                            sheetId: this.sheetId,
                            appsScriptUrl: this.appsScriptUrl
                        }));
                    }
                } catch (e) {
                    // Don't log CORS errors as warnings - they're expected in local development
                    if (e.message && e.message.includes('CORS')) {
                        console.log('ℹ️ CORS issue with Apps Script (expected in local dev). Using stored URL.');
                    } else {
                        console.log('Could not fetch config from Apps Script, using stored URL');
                    }
                }
                
                return true;
            }

            // Try default Apps Script URL from Config tab
            if (defaultAppsScriptUrl) {
                this.appsScriptUrl = defaultAppsScriptUrl;
                this.sheetId = tempSheetId;
                this.configLoaded = true;
                
                // Try to fetch config from Apps Script to verify it works
                // Don't block initialization if this fails (CORS issues, etc.)
                try {
                    const configResponse = await this.makeRequest('?action=config');
                    if (configResponse) {
                        // Use config from Google Sheets if available
                        if (configResponse.appsScriptURL) {
                            this.appsScriptUrl = configResponse.appsScriptURL;
                        }
                        if (configResponse.sheetId) {
                            this.sheetId = configResponse.sheetId;
                        }
                        sessionStorage.setItem('gs_config', JSON.stringify({
                            sheetId: this.sheetId,
                            appsScriptUrl: this.appsScriptUrl
                        }));
                        console.log('✅ Successfully loaded config from Google Sheets Config tab');
                    }
                } catch (e) {
                    // Don't log CORS errors as warnings - they're expected in local development
                    if (e.message && e.message.includes('CORS')) {
                        console.log('ℹ️ CORS issue with Apps Script (expected in local dev). Using default URL.');
                    } else {
                        console.warn('Could not fetch config from Apps Script. Using default URL.');
                    }
                    // Still use the default URL even if config fetch fails
                    localStorage.setItem('apps_script_url', defaultAppsScriptUrl);
                }
                
                return true;
            }

            // Fallback: Set sheet ID and wait for Apps Script URL to be configured
            this.sheetId = tempSheetId;
            this.configLoaded = true;
            console.warn('Apps Script URL not configured. Please set it manually or update Config tab.');
            return true;
        } catch (error) {
            console.error('Error initializing API service:', error);
            return false;
        }
    }

    // Set Apps Script URL (called after Apps Script deployment)
    setAppsScriptUrl(url) {
        this.appsScriptUrl = url;
        localStorage.setItem('apps_script_url', url);
        sessionStorage.setItem('gs_config', JSON.stringify({
            sheetId: this.sheetId,
            appsScriptUrl: url
        }));
    }

    // Make API call to Google Apps Script
    async makeRequest(endpoint, method = 'GET', data = null) {
        if (!this.appsScriptUrl) {
            throw new Error('Apps Script URL not configured. Please deploy Google Apps Script first.');
        }

        // Ensure URL ends with /exec
        if (!this.appsScriptUrl.endsWith('/exec')) {
            throw new Error('Apps Script URL must end with /exec. Current URL: ' + this.appsScriptUrl);
        }

        // Remove leading slash from endpoint if present
        endpoint = endpoint.replace(/^\//, '');
        
        // Construct URL - properly handle query parameters
        let url;
        if (endpoint.startsWith('?')) {
            // If endpoint starts with '?', append directly
            url = `${this.appsScriptUrl}${endpoint}`;
        } else if (endpoint.includes('?')) {
            // If endpoint contains '?', split it and reconstruct properly
            const [actionPart, queryPart] = endpoint.split('?');
            url = `${this.appsScriptUrl}?action=${actionPart}&${queryPart}`;
        } else {
            // Normal endpoint - add action parameter
            url = `${this.appsScriptUrl}?action=${endpoint}`;
        }

        try {
            // For Google Apps Script, we need to use a different approach
            // Apps Script doesn't support CORS properly, so we'll use GET with query params
            if (method === 'GET') {
                // For GET requests, add data as query parameters
                if (data) {
                    const params = new URLSearchParams();
                    Object.keys(data).forEach(key => {
                        if (data[key] !== null && data[key] !== undefined) {
                            params.append(key, data[key]);
                        }
                    });
                    url += (url.includes('?') ? '&' : '?') + params.toString();
                }
                
                // Google Apps Script Web Apps work with CORS when deployed correctly
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache',
                    redirect: 'follow'
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorText}`);
                }

                // Try to parse as JSON, but handle text responses too
                const contentType = response.headers.get('content-type');
                let jsonData;
                if (contentType && contentType.includes('application/json')) {
                    jsonData = await response.json();
                } else {
                    // Try to parse as JSON even if content-type is text
                    const text = await response.text();
                    try {
                        jsonData = JSON.parse(text);
                    } catch (e) {
                        // If parsing fails, try to extract JSON from text
                        const jsonMatch = text.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            jsonData = JSON.parse(jsonMatch[0]);
                        } else {
                            throw new Error('Invalid JSON response: ' + text.substring(0, 100));
                        }
                    }
                }
                return jsonData;
            } else {
                // For POST requests, use text/plain Content-Type to avoid CORS preflight
                // This is a workaround for Google Apps Script CORS limitations
                // The Apps Script will still parse the JSON from the body
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        mode: 'cors',
                        headers: {
                            'Content-Type': 'text/plain;charset=utf-8',
                        },
                        body: JSON.stringify(data || {}),
                        redirect: 'follow'
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorText}`);
                    }

                    const jsonData = await response.json();
                    return jsonData;
                } catch (corsError) {
                    // If CORS error still occurs, log it but don't fail completely
                    console.warn('CORS error on POST request (request may still succeed):', corsError);
                    // Throw a specific error that the caller can detect
                    throw new Error('CORS_ERROR: Request sent but response not readable. Transaction may still be saved.');
                }
            }
        } catch (error) {
            console.error('API Request Error:', error);
            console.error('Request URL:', url || 'N/A');
            console.error('Apps Script URL:', this.appsScriptUrl);
            throw error;
        }
    }

    // Get all branches (with caching)
    async getBranches(useCache = true) {
        try {
            // Check cache first (5 minute cache)
            if (useCache) {
                const cacheKey = 'gs_branches_cache';
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
            
            // Fetch from API with skipImages parameter
            console.log('📡 Fetching branches from API...');
            const response = await this.makeRequest('branches', 'GET', { skipImages: 'true' });
            
            // Validate response
            if (!response) {
                throw new Error('Empty response from API');
            }
            
            if (!response.branches) {
                console.warn('⚠️ Response missing branches array:', response);
                // Try to return cached data even if expired
                const cacheKey = 'gs_branches_cache';
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const cacheData = JSON.parse(cached);
                    if (cacheData.data && cacheData.data.branches) {
                        console.log('⚠️ Using expired cache due to invalid response');
                        return cacheData.data;
                    }
                }
                return { branches: [] };
            }
            
            console.log(`✅ Fetched ${response.branches.length} branches from API`);
            
            // Cache the response
            if (useCache && response && response.branches && response.branches.length > 0) {
                const cacheKey = 'gs_branches_cache';
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: response,
                    timestamp: Date.now()
                }));
            }
            
            return response;
        } catch (error) {
            console.error('Error fetching branches:', error);
            // Try to return cached data even if expired
            const cacheKey = 'gs_branches_cache';
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
            // Return fallback data
            return { branches: [] };
        }
    }

    // Get menu for a specific branch (with caching)
    async getMenu(branchId, useCache = true) {
        try {
            // Check cache first (3 minute cache)
            if (useCache && branchId) {
                const cacheKey = `gs_menu_cache_${branchId}`;
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
            
            // Fetch from API
            const response = await this.makeRequest(`menu`, 'GET', { branchId: branchId });
            
            // Cache the response
            if (useCache && branchId && response && response.items) {
                const cacheKey = `gs_menu_cache_${branchId}`;
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: response,
                    timestamp: Date.now()
                }));
            }
            
            return response;
        } catch (error) {
            console.error('Error fetching menu:', error);
            // Try to return cached data even if expired
            if (branchId) {
                const cacheKey = `gs_menu_cache_${branchId}`;
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
            const result = await this.makeRequest('menu', 'POST', { action: 'menu', ...item });
            // Invalidate menu cache for this branch
            if (item.branchId) {
                const cacheKey = `gs_menu_cache_${item.branchId}`;
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
            const result = await this.makeRequest('menu', 'DELETE', { action: 'menu', id: itemId, branchId: branchId });
            // Invalidate menu cache for this branch
            if (branchId) {
                const cacheKey = `gs_menu_cache_${branchId}`;
                localStorage.removeItem(cacheKey);
            }
            return result;
        } catch (error) {
            console.error('Error deleting menu item:', error);
            throw error;
        }
    }

    // Save sale transaction
    async saveSale(transaction) {
        try {
            // Ensure action is included in the data
            const dataToSend = {
                action: 'sales',
                ...transaction
            };
            console.log('Sending transaction to Google Sheets:', dataToSend);
            const result = await this.makeRequest('sales', 'POST', dataToSend);
            console.log('Transaction saved successfully:', result);
            return result;
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
            const params = { action: 'sales' };
            if (branchId) params.branchId = branchId;
            if (fromDate) params.fromDate = fromDate;
            if (toDate) params.toDate = toDate;
            return await this.makeRequest('sales', 'GET', params);
        } catch (error) {
            console.error('Error fetching sales:', error);
            return { transactions: [] };
        }
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
const apiService = new GoogleSheetsAPI();

