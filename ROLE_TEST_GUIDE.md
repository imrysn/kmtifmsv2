# Role-Based Authentication Test Guide

This document provides a comprehensive test guide for the role-based authentication system.

## Test Scenarios

### ✅ Valid Access Patterns

| User Email | Role | Login Portal | Expected Dashboard | Status |
|------------|------|--------------|-------------------|---------|
| `user@example.com` | USER | 👤 User Login | User Dashboard | ✅ Allow |
| `teamleader@example.com` | TEAM LEADER | 👤 User Login | User Dashboard | ✅ Allow |
| `teamleader@example.com` | TEAM LEADER | 👨‍💼 Admin Login | Team Leader Panel | ✅ Allow |
| `admin@example.com` | ADMIN | 👨‍💼 Admin Login | Admin Panel | ✅ Allow |
| `test@example.com` | USER | 👤 User Login | User Dashboard | ✅ Allow |

### ❌ Invalid Access Patterns (Should Show Friendly Errors)

| User Email | Role | Login Portal | Expected Error | Status |
|------------|------|--------------|----------------|---------|
| `user@example.com` | USER | 👨‍💼 Admin Login | "You do not have permission to access the Admin Login. Please use the User Login instead." | ❌ Deny |
| `admin@example.com` | ADMIN | 👤 User Login | "Admin accounts must use the Admin Login. Please switch to Admin Login to continue." | ❌ Deny |
| `test@example.com` | USER | 👨‍💼 Admin Login | "You do not have permission to access the Admin Login. Please use the User Login instead." | ❌ Deny |

## Dashboard Features by Role

### 👤 User Dashboard
**Access**: USER and TEAM LEADER via User Login
- Personal Analytics
- Task Management  
- Profile Settings
- Support Center
- **Special Note for TEAM LEADER**: Shows notice about Admin Login access

### 👥 Team Leader Panel  
**Access**: TEAM LEADER via Admin Login
- Team Management
- Team Analytics
- Project Oversight
- Reports & Metrics
- Schedule Management
- Goal Setting
- **Dual Access Info**: Shows both portal access information

### 👨‍💼 Admin Panel
**Access**: ADMIN via Admin Login only
- User Management
- Security & Permissions
- System Analytics
- System Configuration
- Audit Logs
- Database Management
- Notifications
- Business Intelligence
- **Security Note**: Admin-only access restriction notice

## Test Commands

```bash
# Test the API endpoints directly
npm run test:api

# Start development server
npm run dev

# Run server standalone (for debugging)
npm run server:standalone
```

## Testing Checklist

### Basic Authentication
- [ ] USER can login to User Portal
- [ ] TEAM LEADER can login to User Portal
- [ ] TEAM LEADER can login to Admin Portal
- [ ] ADMIN can login to Admin Portal

### Access Control
- [ ] USER blocked from Admin Portal with friendly message
- [ ] ADMIN blocked from User Portal with friendly message
- [ ] Invalid credentials rejected
- [ ] Empty form validation works

### Dashboard Access
- [ ] USER sees User Dashboard
- [ ] TEAM LEADER sees User Dashboard via User Login
- [ ] TEAM LEADER sees Team Leader Panel via Admin Login
- [ ] ADMIN sees Admin Panel
- [ ] Logout works correctly from all panels

### UI/UX
- [ ] Toggle button switches between portals
- [ ] Form clears when switching portals
- [ ] Appropriate test credentials shown for each portal
- [ ] Role badges display correctly
- [ ] Different color schemes for each dashboard type

### Security
- [ ] Passwords are hashed in database
- [ ] No password returned in API responses
- [ ] Session management works correctly
- [ ] CORS properly configured

## Sample Test Flow

1. **Start Application**: `npm run dev`
2. **Test USER Role**:
   - Use User Login with `user@example.com` / `password123` → Success
   - Switch to Admin Login with same credentials → Access denied
3. **Test TEAM LEADER Role**:
   - Use User Login with `teamleader@example.com` / `password123` → User Dashboard
   - Logout and use Admin Login with same credentials → Team Leader Panel
4. **Test ADMIN Role**:
   - Use User Login with `admin@example.com` / `password123` → Access denied
   - Switch to Admin Login with same credentials → Admin Panel

All access denials should show user-friendly error messages, not technical errors.
