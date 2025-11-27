// Google Apps Script Code
// Deploy this as a Web App to create REST API endpoints for Google Sheets
// 
// Setup Instructions:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Paste this code
// 4. Save the project
// 5. Deploy > New Deployment > Web App
// 6. Set "Execute as: Me" and "Who has access: Anyone"
// 7. Copy the Web App URL and add it to Config tab in your sheet

// Sheet Structure:
// - Config tab: SheetID | SheetURL | AppsScriptURL | RestaurantTitle | AdminPassword
// - Branches tab: BranchID | BranchName | QRCodeURL | Status (CreatedDate is optional)
// - Menu tab: BranchID | ItemID | ItemName | Price | Category | Availability | ImageURL | HasSizes | SizePrices
// - Sales tab: TransactionID | BranchID | BranchName | DateTime | Items | Quantities | TotalAmount | PaymentMode | QRCodeURL
//   Note: DateTime column contains payment time in format "DD/MM/YYYY, HH:MM AM/PM" (IST)

const SHEET_ID = '1GM4Nb-88OyJV16UeMwz7r3u1Flo1_UeZ4GDMQ9N-w_c';

// Get spreadsheet
function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// Get sheet by name
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // Create sheet if it doesn't exist
    sheet = ss.insertSheet(sheetName);
    // Set headers based on sheet name
    if (sheetName === 'Config') {
      sheet.getRange(1, 1, 1, 5).setValues([['SheetID', 'SheetURL', 'AppsScriptURL', 'RestaurantTitle', 'AdminPassword']]);
      sheet.getRange(2, 1).setValue(SHEET_ID);
      sheet.getRange(2, 2).setValue(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
      sheet.getRange(2, 4).setValue('Restaurant Menu');
      sheet.getRange(2, 5).setValue('admin123');
    } else if (sheetName === 'Branches') {
      sheet.getRange(1, 1, 1, 4).setValues([['BranchID', 'BranchName', 'QRCodeURL', 'Status']]);
    } else if (sheetName === 'Menu') {
      sheet.getRange(1, 1, 1, 9).setValues([['BranchID', 'ItemID', 'ItemName', 'Price', 'Category', 'Availability', 'ImageURL', 'HasSizes', 'SizePrices']]);
    } else if (sheetName === 'Sales') {
      sheet.getRange(1, 1, 1, 9).setValues([['TransactionID', 'BranchID', 'BranchName', 'DateTime', 'Items', 'Quantities', 'TotalAmount', 'PaymentMode', 'QRCodeURL']]);
    }
  }
  return sheet;
}

// Handle GET requests
function doGet(e) {
  // Handle case where e might be undefined (when called from script editor)
  if (!e) {
    e = { parameter: {} };
  }
  if (!e.parameter) {
    e.parameter = {};
  }
  
  const path = e.parameter.path || '';
  const action = e.parameter.action || '';
  
  try {
    // If no action specified, return config as default
    if (!path && !action) {
      return getConfig();
    }
    
    let result;
    // Handle config endpoint - check both path and action parameters
    if (path === 'config' || action === 'config') {
      result = getConfig();
    } else if (path === 'branches' || action === 'branches') {
      result = getBranches(e);
    } else if (path === 'menu' || action === 'menu') {
      const branchId = e.parameter.branchId;
      result = getMenu(branchId);
    } else if (path === 'sales' || action === 'sales') {
      const branchId = e.parameter.branchId;
      const fromDate = e.parameter.fromDate;
      const toDate = e.parameter.toDate;
      result = getSales(branchId, fromDate, toDate);
    } else {
      result = ContentService.createTextOutput(JSON.stringify({ 
        error: 'Invalid endpoint',
        message: 'Valid endpoints: config, branches, menu, sales',
        usage: 'Add ?action=endpoint to your URL, e.g., ?action=branches'
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // CORS headers are automatically handled by Google Apps Script Web Apps
    // when deployed with "Anyone" access
    return result;
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.toString(),
      message: 'An error occurred processing the request'
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests
function doPost(e) {
  const path = e.parameter.path || '';
  const actionParam = e.parameter.action || '';
  let postData = {};
  
  try {
    // Try to parse JSON from postData.contents first
    // This works with both application/json and text/plain Content-Type
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (jsonError) {
        // If JSON parsing fails, try as form data
        postData = e.parameter || {};
      }
    } else if (e.parameter) {
      // Use parameters directly (form-encoded data)
      postData = e.parameter;
    }
    
    // Parse JSON strings in parameters if needed
    Object.keys(postData).forEach(key => {
      if (typeof postData[key] === 'string' && postData[key].startsWith('{')) {
        try {
          postData[key] = JSON.parse(postData[key]);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
    });
  } catch (parseError) {
    // If all parsing fails, use parameters as-is
    postData = e.parameter || {};
  }
  
  // Determine action from path, query parameter, or postData
  const action = path || actionParam || postData.action || '';
  
  try {
    if (action === 'menu' || postData.action === 'menu') {
      return saveMenuItem(postData);
    } else if (action === 'sales' || postData.action === 'sales') {
      return saveSale(postData);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ 
        error: 'Invalid endpoint',
        message: 'Valid endpoints: menu, sales',
        received: { 
          path: path, 
          actionParam: actionParam,
          postDataAction: postData.action,
          determinedAction: action,
          hasPostData: !!e.postData,
          postDataContents: e.postData ? e.postData.contents.substring(0, 200) : 'none'
        }
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.toString(),
      message: 'An error occurred processing the POST request',
      stack: error.stack || 'No stack trace'
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Get Config
function getConfig() {
  const sheet = getSheet('Config');
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({
      sheetId: SHEET_ID,
      sheetURL: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
      appsScriptURL: '',
      restaurantTitle: 'Restaurant Menu',
      adminPassword: 'admin123'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Read values from Config sheet (row 2, columns A-E)
  const sheetId = data[1][0] || SHEET_ID;
  const sheetURL = data[1][1] || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
  const appsScriptURL = data[1][2] || '';
  
  // Column D (index 3) = RestaurantTitle
  // Check if cell exists and has a value
  let restaurantTitle = 'Restaurant Menu';
  if (data[1].length > 3 && data[1][3] !== null && data[1][3] !== undefined && data[1][3] !== '') {
    const titleValue = data[1][3].toString().trim();
    if (titleValue) {
      restaurantTitle = titleValue;
    }
  }
  
  // Column E (index 4) = AdminPassword
  // Check if cell exists and has a value
  let adminPassword = 'admin123';
  if (data[1].length > 4 && data[1][4] !== null && data[1][4] !== undefined && data[1][4] !== '') {
    const passwordValue = data[1][4].toString().trim();
    if (passwordValue) {
      adminPassword = passwordValue;
    }
  }
  
  const config = {
    sheetId: sheetId,
    sheetURL: sheetURL,
    appsScriptURL: appsScriptURL,
    restaurantTitle: restaurantTitle,
    adminPassword: adminPassword
  };
  
  return ContentService.createTextOutput(JSON.stringify(config))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper function: Get image from Google Drive URL and convert to data URI
function getImageAsDataURI(driveURL) {
  try {
    // Check if driveURL is valid
    if (!driveURL || typeof driveURL !== 'string') {
      console.error('Invalid driveURL:', driveURL);
      return null;
    }
    
    // Extract file ID from Google Drive URL
    let fileId = null;
    
    // Try different URL formats (order matters - most specific first)
    const patterns = [
      // Direct image URL: https://drive.google.com/uc?export=view&id=FILE_ID
      /drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/,
      // Direct image URL with &: https://drive.google.com/uc?export=view&id=FILE_ID (handle &amp; encoding)
      /drive\.google\.com\/uc\?export=view&amp;id=([a-zA-Z0-9_-]+)/,
      // View link: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\//,
      // Shortened view link: https://drive.google.com/file/d/FILE_ID/view
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      // Any URL with id= parameter (must come after uc?export=view&id=)
      /[?&]id=([a-zA-Z0-9_-]+)/,
      // Last resort: look for file ID pattern anywhere in URL
      /\/d\/([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = driveURL.match(pattern);
      if (match && match[1]) {
        fileId = match[1];
        console.log('Extracted file ID:', fileId, 'from URL:', driveURL);
        break;
      }
    }
    
    if (!fileId) {
      console.error('Could not extract file ID from URL:', driveURL);
      return null;
    }
    
    // Get file from Drive
    try {
      const file = DriveApp.getFileById(fileId);
      console.log('✅ File found in Drive:', file.getName());
      
      // Get file blob
      const blob = file.getBlob();
      
      // Check file size (data URIs can be large)
      const fileSize = blob.getBytes().length;
      const maxSize = 5 * 1024 * 1024; // 5MB limit for data URI
      
      console.log('File size:', fileSize, 'bytes');
      
      if (fileSize > maxSize) {
        console.warn('⚠️ File too large for data URI conversion:', fileSize, 'bytes (max:', maxSize, ')');
        // Return original URL if file is too large
        return null;
      }
      
      // Convert to base64
      const base64 = Utilities.base64Encode(blob.getBytes());
      const mimeType = blob.getContentType() || 'image/png';
      
      // Create data URI
      const dataURI = 'data:' + mimeType + ';base64,' + base64;
      
      console.log('✅ Successfully converted Drive URL to data URI');
      console.log('   File size:', fileSize, 'bytes');
      console.log('   Data URI length:', dataURI.length, 'characters');
      console.log('   MIME type:', mimeType);
      return dataURI;
    } catch (driveError) {
      console.error('❌ Error accessing Drive file:', driveError);
      console.error('   File ID:', fileId);
      console.error('   Error message:', driveError.toString());
      console.error('   Error stack:', driveError.stack || 'No stack trace');
      
      // Check if it's a permission error
      if (driveError.toString().includes('permission') || driveError.toString().includes('access') || driveError.toString().includes('denied')) {
        console.error('⚠️ Permission error detected!');
        console.error('   Fix 1: Share file as "Anyone with the link" → "Viewer"');
        console.error('   Fix 2: Grant Drive API permissions in Apps Script');
      }
      
      return null;
    }
  } catch (e) {
    console.error('❌ Error converting Drive URL to data URI:', e);
    console.error('   URL was:', driveURL);
    console.error('   Error stack:', e.stack || 'No stack trace');
    return null;
  }
}

// Get Branches
function getBranches(e) {
  const sheet = getSheet('Branches');
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ branches: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Check if we should skip image extraction (for faster loading)
  const skipImages = e && e.parameter && e.parameter.skipImages === 'true';
  
  // Helper function to extract image from a cell (handles all formats)
  // Only called if skipImages is false
  function extractImageFromCell(rowIndex, colIndex) {
    let imageData = null;
    
    try {
      const cell = sheet.getRange(rowIndex, colIndex);
      
      // METHOD 1: Try to get embedded image from getImages()
      const allImages = sheet.getImages();
      const cellImage = allImages.find(img => {
        const imgRow = img.getAnchorCell().getRow();
        const imgCol = img.getAnchorCell().getColumn();
        return imgRow === rowIndex && imgCol === colIndex;
      });
      
      if (cellImage) {
        try {
          const blob = cellImage.getBlob();
          const base64 = Utilities.base64Encode(blob.getBytes());
          const mimeType = blob.getContentType() || 'image/png';
          imageData = 'data:' + mimeType + ';base64,' + base64;
          console.log(`   ✅ Method 1: Extracted embedded image (${imageData.length} chars)`);
          return imageData;
        } catch (e) {
          console.warn(`   ⚠️ Method 1 failed: ${e.toString()}`);
        }
      }
      
      // METHOD 2: Check if cell has IMAGE() formula
      const formula = cell.getFormula();
      if (formula && formula.startsWith('=IMAGE(')) {
        let urlMatch = formula.match(/IMAGE\("([^"]+)"/) || formula.match(/IMAGE\('([^']+)'/) || formula.match(/IMAGE\(([^)]+)\)/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1].trim();
          console.log(`   ✅ Method 2: Found IMAGE() formula with URL`);
          // Convert URL to data URI if it's a Drive URL
          if (url.includes('drive.google.com')) {
            const dataURI = getImageAsDataURI(url);
            if (dataURI) {
              imageData = dataURI;
              console.log(`   ✅ Method 2: Converted Drive URL to data URI`);
              return imageData;
            }
          }
          imageData = url;
          return imageData;
        }
      }
      
      // METHOD 3: Check cell value (string URL or object)
      const cellValue = cell.getValue();
      if (cellValue) {
        if (typeof cellValue === 'string') {
          // It's a string - could be URL or data URI
          if (cellValue.startsWith('data:')) {
            imageData = cellValue;
            console.log(`   ✅ Method 3: Found data URI in cell value`);
            return imageData;
          } else if (cellValue.startsWith('http://') || cellValue.startsWith('https://')) {
            console.log(`   ✅ Method 3: Found URL in cell value`);
            // Convert Drive URL to data URI for reliability
            if (cellValue.includes('drive.google.com')) {
              const dataURI = getImageAsDataURI(cellValue);
              if (dataURI) {
                imageData = dataURI;
                console.log(`   ✅ Method 3: Converted Drive URL to data URI`);
                return imageData;
              }
            }
            imageData = cellValue;
            return imageData;
          }
        } else if (typeof cellValue === 'object') {
          // Cell value is an object (embedded image)
          console.log(`   ✅ Method 3: Cell value is object (embedded image)`);
          // Try to find the image again (sometimes getImages() misses it)
          const cellImages = sheet.getImages();
          const foundImage = cellImages.find(img => {
            const imgRow = img.getAnchorCell().getRow();
            const imgCol = img.getAnchorCell().getColumn();
            return imgRow === rowIndex && imgCol === colIndex;
          });
          
          if (foundImage) {
            try {
              const blob = foundImage.getBlob();
              const base64 = Utilities.base64Encode(blob.getBytes());
              const mimeType = blob.getContentType() || 'image/png';
              imageData = 'data:' + mimeType + ';base64,' + base64;
              console.log(`   ✅ Method 3: Extracted from object (${imageData.length} chars)`);
              return imageData;
            } catch (e) {
              console.warn(`   ⚠️ Method 3 object extraction failed: ${e.toString()}`);
            }
          }
        }
      }
      
      // METHOD 4: Try getRichTextValue() for embedded images
      try {
        const richText = cell.getRichTextValue();
        if (richText) {
          const runs = richText.getRuns();
          for (let run of runs) {
            const image = run.getInlineImage();
            if (image) {
              const blob = image.getBlob();
              const base64 = Utilities.base64Encode(blob.getBytes());
              const mimeType = blob.getContentType() || 'image/png';
              imageData = 'data:' + mimeType + ';base64,' + base64;
              console.log(`   ✅ Method 4: Extracted from RichText (${imageData.length} chars)`);
              return imageData;
            }
          }
        }
      } catch (e) {
        // RichText might not be available, continue
      }
      
    } catch (e) {
      console.error(`   ❌ Error extracting image from cell: ${e.toString()}`);
    }
    
    return imageData;
  }
  
  const branches = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // BranchID exists
      const rowIndex = i + 1; // Sheet rows are 1-indexed
      let qrCodeURL = '';
      
      // Only extract images if not skipping (for faster loading)
      if (!skipImages) {
        // Extract image from cell using all methods
        qrCodeURL = extractImageFromCell(rowIndex, 3); // Column C (QRCodeURL)
        
        // Convert any remaining URLs to data URIs for reliability
        if (qrCodeURL && typeof qrCodeURL === 'string' && !qrCodeURL.startsWith('data:') && qrCodeURL.includes('drive.google.com')) {
          try {
            const dataURI = getImageAsDataURI(qrCodeURL);
            if (dataURI) {
              qrCodeURL = dataURI;
            } else {
              // Fallback: Convert to direct image URL
              let fileId = null;
              const patterns = [
                /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\//,
                /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
                /\/d\/([a-zA-Z0-9_-]+)/
              ];
              for (const pattern of patterns) {
                const match = qrCodeURL.match(pattern);
                if (match && match[1]) {
                  fileId = match[1];
                  break;
                }
              }
              if (fileId) {
                qrCodeURL = 'https://drive.google.com/uc?export=view&id=' + fileId;
              }
            }
          } catch (e) {
            // Silently fail - use original URL
          }
        }
        
        // Ensure qrCodeURL is always a string (not an object)
        if (qrCodeURL && typeof qrCodeURL !== 'string') {
          const str = String(qrCodeURL);
          if (str && str !== '[object Object]' && str !== '{}' && str !== 'CellImage') {
            qrCodeURL = str;
          } else {
            qrCodeURL = '';
          }
        }
      } else {
        // If skipping images, just get the cell value as string
        try {
          const cellValue = sheet.getRange(rowIndex, 3).getValue();
          if (cellValue && typeof cellValue === 'string') {
            qrCodeURL = cellValue;
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      branches.push({
        id: data[i][0],
        name: data[i][1] || '',
        qrCodeURL: qrCodeURL || '',
        status: data[i][3] || 'Active',
        // CreatedDate is optional - use column 5 if it exists, otherwise use current date
        createdDate: (data[i].length > 4 && data[i][4]) ? data[i][4] : new Date().toISOString()
      });
    }
  }
  
  // Return response (removed excessive logging for performance)
  const response = { branches: branches };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get Menu
function getMenu(branchId) {
  const sheet = getSheet('Menu');
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ items: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const items = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && (!branchId || data[i][0] == branchId)) { // BranchID matches
      const item = {
        id: data[i][1] || i,
        branchId: data[i][0],
        name: data[i][2] || '',
        price: parseFloat(data[i][3]) || 0,
        category: data[i][4] || '',
        availability: data[i][5] || 'Available',
        image: data[i][6] || '',
        hasSizes: data[i][7] === 'TRUE' || data[i][7] === true
      };
      
      if (item.hasSizes && data[i][8]) {
        try {
          item.sizes = JSON.parse(data[i][8]);
        } catch (e) {
          item.sizes = { quarter: { price: 0 }, half: { price: 0 }, full: { price: 0 } };
        }
      }
      
      items.push(item);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ items }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Save Menu Item
function saveMenuItem(itemData) {
  const sheet = getSheet('Menu');
  const data = sheet.getDataRange().getValues();
  
  // Check if item exists (by ItemID and BranchID)
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == itemData.id && data[i][0] == itemData.branchId) {
      rowIndex = i + 1; // +1 because sheet rows are 1-indexed
      break;
    }
  }
  
  const row = [
    itemData.branchId,
    itemData.id,
    itemData.name,
    itemData.price || 0,
    itemData.category || '',
    itemData.availability || 'Available',
    itemData.image || '',
    itemData.hasSizes || false,
    itemData.hasSizes ? JSON.stringify(itemData.sizes || {}) : ''
  ];
  
  if (rowIndex > 0) {
    // Update existing
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    // Add new
    sheet.appendRow(row);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, item: itemData }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Save Sale
function saveSale(transactionData) {
  try {
    // Validate transactionData
    if (!transactionData) {
      throw new Error('transactionData is required');
    }
    
    const sheet = getSheet('Sales');
    
    // Extract transaction data (handle both JSON and form-encoded)
    const transactionId = transactionData.id || Date.now();
    const branchId = transactionData.branchId || '';
    const branchName = transactionData.branchName || '';
    const dateTime = transactionData.dateTime || new Date().toISOString();
    
    // Handle items - could be array or JSON string
    let items = transactionData.items || [];
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }
    
    // Ensure items is an array
    if (!Array.isArray(items)) {
      items = [];
    }
    
    const quantities = items.map(i => i.quantity || 1);
    const total = parseFloat(transactionData.total) || 0;
    const paymentMode = transactionData.paymentMode || 'Cash';
    const qrCodeURL = transactionData.qrCodeURL || '';
    const qrCodeBase64 = transactionData.qrCodeBase64 || '';
    const qrCodeMimeType = transactionData.qrCodeMimeType || '';
    
    // Get the row number where we'll insert (before appending)
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    
    // Prepare row data
    // Format dateTime to 12-hour format: "DD/MM/YYYY, HH:MM AM/PM" (no seconds)
    let formattedDateTime = dateTime;
    if (dateTime) {
      try {
        // Check if dateTime is already in the correct format "DD/MM/YYYY, HH:MM AM/PM"
        if (typeof dateTime === 'string' && dateTime.match(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} (AM|PM)$/)) {
          // Already formatted correctly, use as-is
          formattedDateTime = dateTime;
        } else {
          // Parse the dateTime string (could be ISO format or other)
          const dateObj = new Date(dateTime);
          if (!isNaN(dateObj.getTime())) {
            // Convert to IST (UTC+5:30)
            const istOffset = 5.5 * 60 * 60 * 1000;
            const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60 * 1000);
            const istDate = new Date(utcTime + istOffset);
            
            // Format to 12-hour format: "DD/MM/YYYY, HH:MM AM/PM" (no seconds)
            const day = istDate.getUTCDate().toString().padStart(2, '0');
            const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
            const year = istDate.getUTCFullYear();
            
            let hours = istDate.getUTCHours();
            const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const hoursStr = hours.toString().padStart(2, '0');
            
            formattedDateTime = `${day}/${month}/${year}, ${hoursStr}:${minutes} ${ampm}`;
          }
        }
      } catch (e) {
        console.error('Error formatting dateTime:', e);
        // Use original dateTime if formatting fails
      }
    } else {
      // If no dateTime provided, use current time in IST
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const istDate = new Date(utcTime + istOffset);
      
      const day = istDate.getUTCDate().toString().padStart(2, '0');
      const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = istDate.getUTCFullYear();
      
      let hours = istDate.getUTCHours();
      const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = hours.toString().padStart(2, '0');
      
      formattedDateTime = `${day}/${month}/${year}, ${hoursStr}:${minutes} ${ampm}`;
    }
    
    // Row data - Removed CreatedDate column as it's redundant (DateTime already has payment time)
    const row = [
      transactionId,
      branchId,
      branchName,
      formattedDateTime, // Formatted in 12-hour format: "DD/MM/YYYY, HH:MM AM/PM"
      JSON.stringify(items),
      JSON.stringify(quantities),
      total,
      paymentMode,
      qrCodeURL // Store URL or data URI
      // Removed CreatedDate - DateTime column already contains the payment time
    ];
    
    // Append row to sheet
    sheet.appendRow(row);
    
    // Set DateTime column as text to preserve format (column 4, index 3)
    const dateTimeCell = sheet.getRange(newRow, 4);
    dateTimeCell.setNumberFormat('@'); // Set as text format
    dateTimeCell.setValue(formattedDateTime); // Set the formatted value
    
    // Insert QR code image if base64 data is provided
    if (qrCodeBase64 && qrCodeMimeType) {
      try {
        // Convert base64 to blob
        const imageBlob = Utilities.newBlob(
          Utilities.base64Decode(qrCodeBase64),
          qrCodeMimeType,
          'qr_code_' + transactionId
        );
        
        // Insert image into the QRCodeURL column (column I, which is column 9)
        // Adjust column index based on your sheet structure
        // Columns: TransactionID(1), BranchID(2), BranchName(3), DateTime(4), 
        //          Items(5), Quantities(6), Total(7), PaymentMode(8), QRCodeURL(9)
        const qrColumn = 9; // QRCodeURL column
        
        // Insert image in the cell
        sheet.insertImage(imageBlob, qrColumn, newRow);
        
        // Optionally, resize the image to fit the cell
        const images = sheet.getImages();
        if (images.length > 0) {
          const lastImage = images[images.length - 1];
          // Set image size (adjust as needed)
          lastImage.setWidth(100); // 100 pixels wide
          lastImage.setHeight(100); // 100 pixels high
        }
      } catch (imageError) {
        // If image insertion fails, just log it but don't fail the transaction
        console.error('Error inserting QR code image:', imageError);
        // Store the data URI in the cell as fallback
        sheet.getRange(newRow, 9).setValue(qrCodeURL);
      }
    } else if (qrCodeURL && qrCodeURL.startsWith('http')) {
      // If it's a URL (not base64), use IMAGE formula
      try {
        sheet.getRange(newRow, 9).setFormula('=IMAGE("' + qrCodeURL + '")');
      } catch (formulaError) {
        // Fallback to just storing the URL
        sheet.getRange(newRow, 9).setValue(qrCodeURL);
      }
    }
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      transactionId: transactionId,
      message: 'Transaction saved successfully',
      rowCount: sheet.getLastRow(),
      imageInserted: !!qrCodeBase64
    }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Return error response with details
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false,
      error: error.toString(),
      message: 'Failed to save transaction',
      stack: error.stack || 'No stack trace',
      receivedData: {
        id: transactionData.id,
        branchId: transactionData.branchId,
        itemsCount: Array.isArray(transactionData.items) ? transactionData.items.length : 'not array',
        hasQRCode: !!(transactionData.qrCodeBase64 || transactionData.qrCodeURL)
      }
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Get Sales
function getSales(branchId, fromDate, toDate) {
  const sheet = getSheet('Sales');
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({ transactions: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const transactions = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // Skip empty rows
    
    const transDate = data[i][3] || '';
    
    // Filter by branch
    if (branchId && data[i][1] != branchId) continue;
    
    // Filter by date
    if (fromDate && transDate < fromDate) continue;
    if (toDate && transDate > toDate) continue;
    
    try {
      const items = JSON.parse(data[i][4] || '[]');
      const quantities = JSON.parse(data[i][5] || '[]');
      
      // Reconstruct items with quantities
      const itemsWithQty = items.map((item, idx) => ({
        ...item,
        quantity: quantities[idx] || 1
      }));
      
      // Parse dateTime from sheet (format: "DD/MM/YYYY, HH:MM AM/PM")
      // Get the cell value as displayed text to preserve format
      let formattedDateTime = '';
      try {
        // Try to get the cell value as displayed text (preserves text format)
        const dateTimeCell = sheet.getRange(i + 1, 4); // Column 4 (DateTime)
        const displayValue = dateTimeCell.getDisplayValue();
        
        // Check if it's already in the correct format
        if (displayValue && typeof displayValue === 'string' && displayValue.match(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} (AM|PM)$/)) {
          formattedDateTime = displayValue;
        } else if (displayValue) {
          // Try to parse and reformat
          const dateObj = new Date(displayValue);
          if (!isNaN(dateObj.getTime())) {
            // Convert to IST
            const istOffset = 5.5 * 60 * 60 * 1000;
            const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60 * 1000);
            const istDate = new Date(utcTime + istOffset);
            
            const day = istDate.getUTCDate().toString().padStart(2, '0');
            const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
            const year = istDate.getUTCFullYear();
            
            let hours = istDate.getUTCHours();
            const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const hoursStr = hours.toString().padStart(2, '0');
            
            formattedDateTime = `${day}/${month}/${year}, ${hoursStr}:${minutes} ${ampm}`;
          } else {
            // Fallback to raw value
            formattedDateTime = displayValue || transDate || '';
          }
        } else {
          // Fallback to raw value
          formattedDateTime = transDate || '';
        }
      } catch (e) {
        // Use original if parsing fails
        console.error('Error formatting dateTime in getSales:', e);
        formattedDateTime = transDate || '';
      }
      
      transactions.push({
        id: data[i][0],
        branchId: data[i][1],
        branchName: data[i][2],
        date: formattedDateTime.split(',')[0] || formattedDateTime.split('T')[0],
        dateTime: formattedDateTime,
        items: itemsWithQty,
        total: parseFloat(data[i][6]) || 0,
        paymentMode: data[i][7] || 'Cash',
        qrCodeURL: data[i][8] || ''
        // Removed timestamp - DateTime already contains the payment time
      });
    } catch (e) {
      console.error('Error parsing transaction:', e);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ transactions }))
    .setMimeType(ContentService.MimeType.JSON);
}

