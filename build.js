#!/usr/bin/env node

/**
 * Build script to inject Vercel environment variables into HTML files
 * This script runs during Vercel's build process to inject Supabase config
 * 
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

const fs = require('fs');
const path = require('path');

const HTML_FILES = ['admin.html', 'index.html'];
const PLACEHOLDER = '// PLACEHOLDER_FOR_BUILD_SCRIPT - will be replaced by build.js';

function injectEnvVars() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    // Check if env vars are available
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️  WARNING: Supabase environment variables not found!');
        console.warn('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
        console.warn('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
        console.warn('   The app will fall back to localStorage configuration.');
        console.warn('   For production, set these in Vercel dashboard: Settings → Environment Variables');
        return;
    }

    console.log('✅ Found Supabase environment variables');
    console.log('   URL:', supabaseUrl.substring(0, 30) + '...');
    console.log('   Anon Key:', supabaseAnonKey.substring(0, 20) + '...');

    // Create the injection script (replaces the placeholder comment)
    const injectionScript = `// Injected by build.js from Vercel environment variables
            window.__VERCEL_SUPABASE_URL__ = ${JSON.stringify(supabaseUrl)};
            window.__VERCEL_SUPABASE_ANON_KEY__ = ${JSON.stringify(supabaseAnonKey)};
            `;

    // Process each HTML file
    HTML_FILES.forEach(filename => {
        const filePath = path.join(__dirname, filename);
        
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found: ${filename}`);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        // Check if placeholder exists
        if (!content.includes(PLACEHOLDER)) {
            console.warn(`⚠️  Placeholder not found in ${filename}. Skipping injection.`);
            return;
        }

        // Replace placeholder comment with injection script
        // The placeholder is: "// PLACEHOLDER_FOR_BUILD_SCRIPT - will be replaced by build.js"
        // We replace it with the actual injection code
        content = content.replace(PLACEHOLDER, injectionScript.trim());
        
        // Write back to file
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Injected env vars into ${filename}`);
    });

    console.log('✅ Build script completed successfully');
}

// Run the injection
try {
    injectEnvVars();
    console.log('✅ Build script completed without errors');
    // Don't exit with error code - warnings are acceptable
    // The app will fall back to localStorage if env vars are missing
} catch (error) {
    console.error('❌ Error during build:', error);
    console.error('   Stack:', error.stack);
    // Only exit with error if it's a critical failure
    // Missing env vars are warnings, not errors
    if (error.code === 'ENOENT' || error.message.includes('Cannot find')) {
        console.warn('⚠️  Non-critical error - continuing build');
    } else {
        process.exit(1);
    }
}

