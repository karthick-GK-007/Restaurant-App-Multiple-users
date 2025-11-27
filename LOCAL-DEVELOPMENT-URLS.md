# Local Development Server - Access URLs

## Server Information
- **Port**: 8000
- **Server Type**: http-server (via npx)
- **Base URL**: http://localhost:8000

---

## Application Access Points

### 1. Main Menu Page
**URL**: http://localhost:8000/index.html  
**Description**: Main restaurant menu and ordering interface  
**Features**:
- Menu item display
- Add to cart functionality
- Checkout process
- Branch selection

---

### 2. Admin Panel
**URL**: http://localhost:8000/admin.html  
**Description**: Administrative interface for managing the restaurant  
**Features**:
- Menu management (Add/Edit/Delete items)
- Theme configuration
- Branch management
- Password protected

---

### 3. Premium Dashboard
**URL**: http://localhost:8000/premium-dashboard.html  
**Description**: Analytics and insights dashboard  
**Features**:
- Sales analytics charts
- Date and branch filters
- Export to Excel/PDF
- Menu insights
- Branch insights
- Inventory management
- Real-time data visualization

---

### 4. Supabase Configuration
**URL**: http://localhost:8000/supabase-config.html  
**Description**: Database configuration page  
**Features**:
- Configure Supabase connection
- Enter Project URL
- Enter Anon/Public Key
- Save credentials for application use

---

## Starting the Server

### Using PowerShell (Windows):
```powershell
.\start-server.ps1
```

### Using Batch File (Windows):
```batch
.\start-server.bat
```

### Manual Start:
```powershell
npx --yes http-server -p 8000
```

---

## Stopping the Server

### Method 1: Keyboard Interrupt
- Press `Ctrl+C` in the terminal where the server is running

### Method 2: Kill Process by Port
```powershell
# Find the process ID
netstat -ano | findstr :8000

# Kill the process (replace <PID> with the actual process ID)
taskkill /PID <PID> /F
```

### Method 3: Kill All Node Processes
```powershell
taskkill /F /IM node.exe
```

---

## Testing Checklist

### Main Menu (index.html)
- [ ] Page loads without errors
- [ ] Branch selector displays and works
- [ ] Menu items load correctly
- [ ] Add to cart functionality works
- [ ] Checkout process completes successfully

### Admin Panel (admin.html)
- [ ] Password authentication works
- [ ] Menu management functions (Add/Edit/Delete)
- [ ] Theme configuration saves correctly
- [ ] Branch management works

### Premium Dashboard (premium-dashboard.html)
- [ ] Dashboard loads successfully
- [ ] Charts render correctly (Line, Pie, Bar charts)
- [ ] Date filters work
- [ ] Branch filters work
- [ ] Export to Excel works
- [ ] Export to PDF works
- [ ] Refresh button resets filters
- [ ] Sidebar navigation works (desktop & mobile)
- [ ] All pages load (Sales, Menu Insights, Branch Insights, Inventory)

### Supabase Configuration (supabase-config.html)
- [ ] Configuration page loads
- [ ] Can enter Supabase credentials
- [ ] Configuration saves to localStorage
- [ ] Redirects to index.html after save

---

## Troubleshooting

### Server Won't Start
**Problem**: Port 8000 is already in use  
**Solution**: 
1. Check what's using the port: `netstat -ano | findstr :8000`
2. Kill the process: `taskkill /PID <PID> /F`
3. Try starting the server again

### Pages Not Loading
**Problem**: 404 errors or blank pages  
**Solution**:
1. Verify you're using the correct URLs (include `.html` extension)
2. Check that all files exist in the project directory
3. Verify the server is running on port 8000
4. Clear browser cache and try again

### JavaScript Errors
**Problem**: Console shows errors  
**Solution**:
1. Open browser Developer Tools (F12)
2. Check Console tab for error messages
3. Check Network tab for failed requests
4. Verify all JavaScript files are loading correctly
5. Check Supabase configuration is set up

### Data Not Loading
**Problem**: Charts/dashboard show no data  
**Solution**:
1. Verify Supabase configuration is set up (visit supabase-config.html)
2. Check Supabase credentials are correct
3. Verify database connection in browser console
4. Check that data exists in Supabase tables

---

## Important Files

### Core Application Files:
- `index.html` - Main menu page
- `admin.html` - Admin panel
- `premium-dashboard.html` - Analytics dashboard
- `supabase-config.html` - Database configuration

### JavaScript Files:
- `script.js` - Main application logic
- `premium-dashboard.js` - Dashboard functionality
- `admin.js` - Admin panel logic
- `supabase-service.js` - Database service
- `api-service.js` - API service layer
- `gst-theme-utils.js` - Theme utilities

### CSS Files:
- `styles.css` - Main styles
- `premium-dashboard.css` - Dashboard styles
- `admin.css` - Admin panel styles

### Server Scripts:
- `start-server.ps1` - PowerShell server start script
- `start-server.bat` - Batch server start script

---

## Notes

- The server runs on port 8000 by default
- All pages use relative paths, so they work from any server root
- Supabase configuration must be set up before using dashboard/report features
- The server will continue running until stopped or the terminal is closed

---

**Last Updated**: Production-ready version  
**Version**: 1.0

