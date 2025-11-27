(function() {
    const DEFAULT_THEME = {
        primary: '#C6A667',
        primary_dark: '#A4843D',
        secondary: '#1F1F1F',
        accent: '#FFB347',
        background: '#F8F5F0',
        surface: '#FFFFFF',
        text_primary: '#1A1A1A',
        text_muted: '#6B6B6B',
        success: '#2ECC71',
        danger: '#E74C3C',
        heading: '#1A1A1A',
        paragraph: '#1A1A1A',
        label: '#1A1A1A',
        inverse: '#FFFFFF',
        neon_text: '#FFB347',
        font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    };

    const THEME_CONFIG_KEYS = Object.keys(DEFAULT_THEME).map(key => `theme_${key}`);

    const ThemeManager = {
        colors: { ...DEFAULT_THEME },
        async init() {
            try {
                if (typeof apiService === 'undefined') {
                    console.warn('ThemeManager: apiService is not available yet.');
                    this.applyTheme();
                    return;
                }
                await apiService.initialize();
                const configValues = await apiService.getConfigs(THEME_CONFIG_KEYS);
                THEME_CONFIG_KEYS.forEach(key => {
                    const colorKey = key.replace('theme_', '');
                    const value = configValues[key];
                    if (value) {
                        this.colors[colorKey] = value;
                    }
                });
            } catch (error) {
                console.warn('ThemeManager: Failed to load theme from config, using defaults.', error);
            }
            this.applyTheme();
        },
        applyTheme() {
            const root = document.documentElement;
            Object.entries(this.colors).forEach(([key, value]) => {
                const cssKey = key === 'font' ? 'theme-font' : key.replace(/_/g, '-');
                root.style.setProperty(`--${cssKey}`, value);
                
                // Also set RGB values for rgba() usage (for colors only, not font)
                if (key !== 'font' && value && value.startsWith('#')) {
                    const rgb = this.hexToRgb(value);
                    if (rgb) {
                        root.style.setProperty(`--${cssKey}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
                    }
                }
            });
        },
        hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },
        getColor(key, fallback) {
            return this.colors[key] || fallback || DEFAULT_THEME[key];
        },
        async updateTheme(newColors = {}) {
            this.colors = { ...this.colors, ...newColors };
            this.applyTheme();
            const payload = {};
            Object.entries(newColors).forEach(([key, value]) => {
                payload[`theme_${key}`] = value;
            });
            if (Object.keys(payload).length > 0 && typeof apiService !== 'undefined') {
                await apiService.setConfigs(payload);
            }
        }
    };

    const GSTUtils = {
        ORDER_TYPE_KEYS: {
            Dining: 'dining',
            Takeaway: 'takeaway',
            'Online Order': 'onlineorder',
            Online: 'onlineorder',
            OnlineOrder: 'onlineorder'
        },

        parseNumber(value, precision = 2) {
            if (value === null || value === undefined || value === '') return 0;
            const parsed = parseFloat(value);
            if (isNaN(parsed)) return 0;
            const factor = Math.pow(10, precision);
            return Math.round(parsed * factor) / factor;
        },

        getOrderTypeKey(orderType) {
            return this.ORDER_TYPE_KEYS[orderType] || 'dining';
        },

        getGSTPercentages(item, orderType = 'Dining') {
            const key = this.getOrderTypeKey(orderType);
            const gst = item?.gst || {};
            const source = gst[key] || {};
            const cgst = this.parseNumber(
                source.cgst ??
                item?.[`${key}_cgst_percentage`] ??
                item?.[` ${key}_cgst_percentage`] ??
                0
            );
            const sgst = this.parseNumber(
                source.sgst ??
                item?.[`${key}_sgst_percentage`] ??
                item?.[` ${key}_sgst_percentage`] ??
                0
            );
            return { cgst, sgst };
        },

        calculatePricing({ amount, cgstPercentage, sgstPercentage, includesTax = true }) {
            const cgst = this.parseNumber(cgstPercentage);
            const sgst = this.parseNumber(sgstPercentage);
            const totalRate = cgst + sgst;
            let basePrice = 0;
            let finalPrice = 0;
            let cgstAmount = 0;
            let sgstAmount = 0;
            let gstValue = 0;

            if (includesTax) {
                finalPrice = this.parseNumber(amount);
                if (totalRate > 0) {
                    basePrice = this.parseNumber(finalPrice / (1 + totalRate / 100));
                } else {
                    basePrice = finalPrice;
                }
            } else {
                basePrice = this.parseNumber(amount);
                finalPrice = this.parseNumber(basePrice * (1 + totalRate / 100));
            }

            cgstAmount = this.parseNumber(basePrice * (cgst / 100));
            sgstAmount = this.parseNumber(basePrice * (sgst / 100));
            gstValue = this.parseNumber(cgstAmount + sgstAmount);
            finalPrice = includesTax ? finalPrice : this.parseNumber(basePrice + gstValue);

            return {
                basePrice,
                finalPrice,
                cgstAmount,
                sgstAmount,
                gstValue,
                cgstPercentage: cgst,
                sgstPercentage: sgst,
                priceIncludesTax: includesTax
            };
        },

        buildPricingMetadata(item, orderTypes = ['Dining', 'Takeaway', 'Online Order']) {
            const metadata = {
                priceIncludesTax: item.pricingMode !== 'exclusive',
                lastUpdated: new Date().toISOString(),
                orderTypes: {}
            };

            const sizes = item.sizes || {};
            const includesTax = metadata.priceIncludesTax;

            orderTypes.forEach(type => {
                const typeKey = this.getOrderTypeKey(type);
                const { cgst, sgst } = this.getGSTPercentages(item, type);
                metadata.orderTypes[typeKey] = {
                    cgstPercentage: cgst,
                    sgstPercentage: sgst,
                    sizes: {}
                };

                Object.entries(sizes).forEach(([sizeKey, sizeValue]) => {
                    const priceValue = this.parseNumber(sizeValue?.price ?? item.price ?? 0);
                    metadata.orderTypes[typeKey].sizes[sizeKey] = this.calculatePricing({
                        amount: priceValue,
                        cgstPercentage: cgst,
                        sgstPercentage: sgst,
                        includesTax
                    });
                });
            });

            return metadata;
        },

        calculateCartSummary(cartItems = [], orderType = 'Dining') {
            const summary = {
                orderType,
                totalBaseAmount: 0,
                totalCgstAmount: 0,
                totalSgstAmount: 0,
                totalGstAmount: 0,
                totalFinalAmount: 0,
                items: []
            };

            cartItems.forEach(item => {
                const cgst = this.parseNumber(item.cgstPercentage ?? 0);
                const sgst = this.parseNumber(item.sgstPercentage ?? 0);
                const quantity = parseInt(item.quantity, 10) || 1;
                const includesTax = item.priceIncludesTax !== false;
                const priceValue = item.price ?? item.finalPrice ?? 0;
                const breakdown = this.calculatePricing({
                    amount: priceValue,
                    cgstPercentage: cgst,
                    sgstPercentage: sgst,
                    includesTax
                });

                const lineBase = this.parseNumber(breakdown.basePrice * quantity);
                const lineCgst = this.parseNumber(breakdown.cgstAmount * quantity);
                const lineSgst = this.parseNumber(breakdown.sgstAmount * quantity);
                const lineGst = this.parseNumber(breakdown.gstValue * quantity);
                const lineFinal = this.parseNumber(breakdown.finalPrice * quantity);

                summary.totalBaseAmount += lineBase;
                summary.totalCgstAmount += lineCgst;
                summary.totalSgstAmount += lineSgst;
                summary.totalGstAmount += lineGst;
                summary.totalFinalAmount += lineFinal;

                summary.items.push({
                    ...item,
                    orderType,
                    basePrice: breakdown.basePrice,
                    finalPrice: breakdown.finalPrice,
                    cgstPercentage: cgst,
                    sgstPercentage: sgst,
                    cgstAmount: breakdown.cgstAmount,
                    sgstAmount: breakdown.sgstAmount,
                    gstValue: breakdown.gstValue,
                    priceIncludesTax: includesTax,
                    subtotal: lineFinal
                });
            });

            summary.totalBaseAmount = this.parseNumber(summary.totalBaseAmount);
            summary.totalCgstAmount = this.parseNumber(summary.totalCgstAmount);
            summary.totalSgstAmount = this.parseNumber(summary.totalSgstAmount);
            summary.totalGstAmount = this.parseNumber(summary.totalGstAmount);
            summary.totalFinalAmount = this.parseNumber(summary.totalFinalAmount);

            return summary;
        },

        buildPricingMatrix(priceDefinition = {}, gstConfig = {}, includesTax = true) {
            const hasDefaultPrice = priceDefinition.default !== undefined && priceDefinition.default !== null;
            const metadata = {
                priceIncludesTax: includesTax,
                sourcePriceType: includesTax ? 'final' : 'base',
                sourcePrice: {
                    default: hasDefaultPrice ? this.parseNumber(priceDefinition.default) : null,
                    sizes: {}
                },
                lastUpdated: new Date().toISOString(),
                orderTypes: {}
            };

            Object.entries(priceDefinition.sizes || {}).forEach(([sizeKey, value]) => {
                if (value !== undefined && value !== null) {
                    metadata.sourcePrice.sizes[sizeKey] = this.parseNumber(value);
                }
            });

            Object.entries(gstConfig).forEach(([key, value]) => {
                const cgst = this.parseNumber(value?.cgst ?? 0);
                const sgst = this.parseNumber(value?.sgst ?? 0);
                const orderMeta = {
                    cgstPercentage: cgst,
                    sgstPercentage: sgst,
                    default: null,
                    sizes: {}
                };

                if (hasDefaultPrice) {
                    orderMeta.default = this.calculatePricing({
                        amount: priceDefinition.default,
                        cgstPercentage: cgst,
                        sgstPercentage: sgst,
                        includesTax
                    });
                }

                Object.entries(priceDefinition.sizes || {}).forEach(([sizeKey, amount]) => {
                    orderMeta.sizes[sizeKey] = this.calculatePricing({
                        amount,
                        cgstPercentage: cgst,
                        sgstPercentage: sgst,
                        includesTax
                    });
                });

                metadata.orderTypes[key] = orderMeta;
            });

            return metadata;
        },

        getBreakdownFromMetadata(metadata, orderType = 'Dining', sizeKey = null) {
            if (!metadata || !metadata.orderTypes) return null;
            const key = this.getOrderTypeKey(orderType);
            const orderTypeMeta = metadata.orderTypes[key];
            if (!orderTypeMeta) return null;
            if (sizeKey && orderTypeMeta.sizes && orderTypeMeta.sizes[sizeKey]) {
                return {
                    ...orderTypeMeta.sizes[sizeKey],
                    cgstPercentage: orderTypeMeta.cgstPercentage,
                    sgstPercentage: orderTypeMeta.sgstPercentage,
                    priceIncludesTax: metadata.priceIncludesTax
                };
            }
            if (orderTypeMeta.default) {
                return {
                    ...orderTypeMeta.default,
                    cgstPercentage: orderTypeMeta.cgstPercentage,
                    sgstPercentage: orderTypeMeta.sgstPercentage,
                    priceIncludesTax: metadata.priceIncludesTax
                };
            }
            return null;
        }
    };

    window.ThemeManager = ThemeManager;
    window.GSTUtils = GSTUtils;
})();

