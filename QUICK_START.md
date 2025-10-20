# 🚀 Quick Start Guide - KMTI File Management System v2

## ⚡ Starting the Application

### Recommended Method (Safest):
```bash
npm start
# or
npm run dev:safe
```
This ensures proper startup order and waits for all servers to be ready.

### Alternative Methods:

#### Standard Development:
```bash
npm run dev
```

#### With DevTools Always Open:
```bash
npm run dev:debug
```

#### Manual Step-by-Step:
```bash
# Terminal 1 - Start Vite
cd client
npm run dev

# Terminal 2 - Start Electron (after Vite is ready)
npm run electron:dev
```

## 🔍 Troubleshooting

### Black Screen? Run diagnostics:
```bash
npm run electron:debug
```

### Database Issues:
```bash
npm run db:test      # Test connection
npm run db:init      # Initialize database
npm run health       # Health check
```

### Server Issues:
```bash
npm run server:standalone  # Test Express server separately
```

## 📊 What Should Happen

### Expected Startup Sequence:
1. 🚀 Express server starts → `http://localhost:3001`
2. ⚡ Vite dev server starts → `http://localhost:5173`
3. 🖥️ Electron window opens
4. ✅ React app loads

### Success Messages:
```
✅ Express server running on http://localhost:3001
✅ Vite dev server is ready!
✅ Page loaded successfully
🖥️ Electron window opened!
```

## 🐛 Common Issues & Fixes

### Issue: Black/Blank Electron Window
**Cause:** Electron opened before Vite was ready
**Fix:** Use `npm start` instead of `npm run dev`

### Issue: "Failed to load resource" in DevTools
**Cause:** Vite server not running
**Fix:** 
```bash
cd client && npm run dev
```

### Issue: API calls failing
**Cause:** Express server not running or database issues
**Fix:**
```bash
npm run db:test
npm run health
```

### Issue: Port already in use
**Fix:**
```bash
# Check ports
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# Kill processes or change ports in config files
```

## 📁 Key Files

- `start-dev.js` - Smart startup script (recommended)
- `debug-electron.js` - Diagnostic tool
- `main.js` - Electron main process
- `preload.js` - Electron preload script
- `server.js` - Express server entry point
- `client/` - React application

## 🔧 Development Commands

### Application:
- `npm start` - Start with smart startup (recommended)
- `npm run dev` - Standard development mode
- `npm run dev:safe` - Same as npm start
- `npm run dev:debug` - Development with DevTools always open

### Diagnostics:
- `npm run electron:debug` - Run diagnostics
- `npm run health` - Database health check
- `npm run db:test` - Test database connection

### Database:
- `npm run db:init` - Initialize database
- `npm run db:test` - Test connection
- `npm run db:check` - Check tables
- `npm run db:reset-admin` - Reset admin password

### Individual Components:
- `npm run client:dev` - Start only Vite
- `npm run electron:dev` - Start only Electron
- `npm run server:standalone` - Start only Express

## 📝 Recent Fixes Applied

### ✅ FileApproval.jsx
- Fixed "File system access not available" error
- Added web browser fallback for approval
- Now works in both Electron and browser

### ✅ main.js
- Disabled console silencing for debugging
- Added better error handling
- Improved Vite server waiting logic
- Auto-opens DevTools in development
- Better timeout handling

### ✅ preload.js
- Added error handling
- Added console logging for debugging

### ✅ New Scripts
- `start-dev.js` - Smart startup with proper timing
- `debug-electron.js` - Comprehensive diagnostics

## 🎯 Best Practices

1. **Always use `npm start` for development**
2. **Check console output for errors**
3. **Run diagnostics if issues occur**
4. **Verify database connection before starting**
5. **Wait for "ready" messages before interacting**

## 📚 Additional Resources

- `ELECTRON_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- `package.json` - All available scripts
- GitHub Issues - Report problems

## 💡 Tips

- **First time setup?** Run `npm install` in root and `cd client && npm install`
- **Database issues?** Run `npm run db:init` to reset
- **Still stuck?** Run `npm run electron:debug` for diagnostics
- **Need help?** Check `ELECTRON_TROUBLESHOOTING.md`

---

**Current Version:** 2.0.0  
**Last Updated:** $(date)  
**Status:** ✅ All critical issues fixed
