// Supabase Configuration
// This file loads configuration from localStorage (set via supabase-config.html)
// It MUST run synchronously before supabase-service.js loads

(function() {
    'use strict';
    
    // Load from localStorage (configured via supabase-config.html)
    try {
        const stored = localStorage.getItem('supabase_config');
        if (stored) {
            const config = JSON.parse(stored);
            
            // Support both formats: {url, anonKey} and {supabaseUrl, supabaseKey}
            let url, anonKey;
            
            if (config.url && config.anonKey) {
                url = config.url;
                anonKey = config.anonKey;
            } else if (config.supabaseUrl && config.supabaseKey) {
                url = config.supabaseUrl;
                anonKey = config.supabaseKey;
            }
            
            if (url && anonKey) {
                window.SUPABASE_CONFIG = {
                    url: url,
                    anonKey: anonKey
                };
                console.log('✅ Supabase config loaded from localStorage:', { url: url.substring(0, 30) + '...', anonKey: anonKey.substring(0, 20) + '...' });
                return;
            }
        }
    } catch (error) {
        console.error('❌ Failed to load Supabase config from localStorage:', error);
    }
    
    // If nothing is configured, log a helpful message
    console.warn('⚠️ Supabase config not found in localStorage. Please visit /supabase-config.html to configure.');
})();
