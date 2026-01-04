<h1 align="center">Welcome to KMTI File Management System 👋</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-2.0-blue.svg?cacheSeconds=2592000" />
</p>

> Desktop application with React, Electron, Express, and MySQL for document approval workflow

## 🚀 Quick Start for Non-Technical Users

### Step 1: Check System Compatibility
Double-click `system-check.bat` to verify your computer meets the requirements.

### Step 2: Run Setup Wizard
Double-click `setup-wizard.bat` and choose your preferred installation method.

### Step 3: Verify Installation
Double-click `setup-verifier.bat` to ensure everything is working correctly.

### Step 4: Start Using the Application
Launch "KMTI FMS" from your desktop or Start Menu!

---

## 📦 Installation Options

### 🎯 Express Install (Recommended)
- **For:** Most users, especially non-technical
- **What it does:** Installs desktop app with automatic server management
- **Requirements:** None (handled automatically)
- **Time:** 2-3 minutes

### 🔧 Advanced Install
- **For:** IT administrators, network deployments
- **What it does:** Standalone server with Windows service
- **Requirements:** Administrator privileges
- **Time:** 5-10 minutes

### ⚙️ Custom Install
- **For:** Developers, custom configurations
- **What it does:** Full development environment setup
- **Requirements:** Node.js, npm
- **Time:** 5-15 minutes

---

## 🔍 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Windows 10 64-bit | Windows 10/11 64-bit |
| **RAM** | 4GB | 8GB+ |
| **Disk Space** | 2GB free | 5GB+ free |
| **Network** | Local access | Internet for updates |

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 16+ ([Download](https://nodejs.org/))
- npm (included with Node.js)
- Git ([Download](https://git-scm.com/))

### Installation
```bash
# Clone the repository
git clone https://github.com/imrysn/kmtifmsv2.git
cd kmtifmsv2

# Install dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Start development server
npm run dev
```

### Available Scripts
```bash
# Development
npm run dev              # Start development server
npm run client:dev       # Start client only
npm run electron:dev     # Start Electron only

# Production
npm run build           # Build for production
npm run prod            # Start production build

# Database
npm run db:init         # Initialize database
npm run db:reset-admin  # Reset admin password
npm run db:test         # Test database connection

# Testing
npm run test:api        # Test API endpoints
```

---

## 📋 User Guides

- **[Complete Setup Guide](COMPLETE_SOLUTION_README.md)** - Comprehensive installation instructions
- **[Desktop App Guide](ELECTRON_INSTALLER_README.md)** - Desktop application details
- **[Server Guide](SERVER_INSTALLER_README.md)** - Server installation options

---

## 🆘 Troubleshooting

### Common Issues

**Application won't start:**
- Run `setup-verifier.bat` to diagnose issues
- Check if server is running (look for KMTI_FMS_Server.exe in Task Manager)

**Can't connect to server:**
- Verify port 3001 is not blocked by firewall
- Check if another application is using port 3001

**Installation failed:**
- Run `system-check.bat` to verify system compatibility
- Try running setup as administrator

**Database errors:**
- Run `npm run db:init` to initialize database
- Check database configuration in `.env` file

### Support Resources
- Check the `docs/` folder for detailed guides
- Run diagnostic scripts in the `database/` folder
- Review server logs for error details

---

## 🏗️ Project Structure

```
kmtifmsv2/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   └── services/      # API services
│   └── package.json
├── server/                 # Express backend
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── config/            # Server configuration
├── database/               # Database files and migrations
├── dist/                   # Built installers
├── docs/                   # Documentation
└── main.js                # Electron main process
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is proprietary software for KMTI use.

---

## 👤 Author

**OJT Team** - KMTI File Management System Development Team

---

## 🙏 Acknowledgments

- Electron for desktop app framework
- React for user interface
- Express.js for backend API
- MySQL/SQLite for database
- All contributors and testers

---

**⭐ Give this project a star if it helped you!**
