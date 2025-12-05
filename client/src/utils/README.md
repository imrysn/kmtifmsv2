# KMTI FMS Utilities

This directory contains utility functions and React hooks used throughout the KMTI FMS application.

## 📁 Files

### taskbarFlash.js
**Purpose:** Core utility functions for taskbar/window title flashing

**Exports:**
- `flashTaskbar(message, duration)` - Flash taskbar with message
- `stopFlashing()` - Stop the flashing
- `updateOriginalTitle(newTitle)` - Update page title
- `flashForNotifications(count)` - Flash with notification count
- `isVisible()` - Check if page is visible

**Usage:**
```javascript
import { flashTaskbar, stopFlashing } from './taskbarFlash';

// Flash for 10 seconds
flashTaskbar('New Message!', 10000);

// Stop manually
stopFlashing();
```

### useTaskbarFlash.js
**Purpose:** React hooks for easy integration of taskbar flashing

**Exports:**
- `useTaskbarFlash(unreadCount, options)` - Automatic flashing hook
- `useManualTaskbarFlash(options)` - Manual flash trigger hook

**Usage:**
```javascript
import { useTaskbarFlash, useManualTaskbarFlash } from './useTaskbarFlash';

// Automatic flashing
function Component() {
  const [unreadCount, setUnreadCount] = useState(0);
  
  useTaskbarFlash(unreadCount, {
    enabled: true,
    pageTitle: 'My App'
  });
}

// Manual flashing
function ToastComponent() {
  const flash = useManualTaskbarFlash({ duration: 5000 });
  
  useEffect(() => {
    if (newNotification) {
      flash('New Notification!');
    }
  }, [newNotification]);
}
```

## 🎯 When to Use

### Use `taskbarFlash.js` directly when:
- You need low-level control over flashing
- You're not using React
- You need to integrate with vanilla JavaScript

### Use `useTaskbarFlash` hook when:
- You want automatic tracking of notification counts
- You're building notification bell components
- You want the flash to trigger on state changes

### Use `useManualTaskbarFlash` hook when:
- You want to trigger flashing manually
- You're building toast notifications
- You need precise control over when to flash

## 📚 Documentation

For detailed documentation, see:
- `docs/TASKBAR_FLASH_IMPLEMENTATION.md` - Complete guide
- `docs/TASKBAR_FLASH_QUICK_REFERENCE.md` - Quick reference
- `docs/TASKBAR_FLASH_SUMMARY.md` - Implementation summary

## 🔧 Features

- ✅ Automatic page visibility detection
- ✅ Cross-browser compatible
- ✅ No performance impact
- ✅ Automatic cleanup
- ✅ Configurable durations
- ✅ Custom messages
- ✅ Easy integration

## 🌐 Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome | ✅ |
| Firefox | ✅ |
| Edge | ✅ |
| Safari | ✅ |
| Opera | ✅ |
| Brave | ✅ |

## 💡 Tips

1. **Always clean up** - The hooks handle this automatically
2. **Check visibility** - Flashing only works when page is hidden
3. **Use appropriate durations** - 5-10 seconds is usually enough
4. **Set meaningful titles** - Help users identify the app/page
5. **Test across browsers** - Behavior may vary slightly

## 🚀 Quick Examples

### Example 1: Notification Bell
```javascript
const NotificationBell = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  
  useTaskbarFlash(unreadCount, {
    pageTitle: 'KMTI FMS - Dashboard'
  });
  
  return <button>🔔 {unreadCount}</button>;
};
```

### Example 2: Toast Notification
```javascript
const Toast = ({ notifications }) => {
  const flash = useManualTaskbarFlash({ duration: 5000 });
  
  useEffect(() => {
    if (notifications.length > 0) {
      flash(notifications[0].title);
    }
  }, [notifications]);
  
  return <div>{/* toast content */}</div>;
};
```

### Example 3: Custom Integration
```javascript
import { flashTaskbar, stopFlashing } from './taskbarFlash';

// Flash on custom event
document.addEventListener('customEvent', () => {
  flashTaskbar('Event Occurred!', 8000);
});

// Stop when user interacts
document.addEventListener('click', () => {
  stopFlashing();
});
```

## 🐛 Troubleshooting

### Flash not working?
- Verify the page is actually hidden (switch tabs)
- Check browser console for errors
- Ensure proper import paths

### Flash not stopping?
- Check component cleanup (useEffect return)
- Verify visibility change detection
- Clear browser cache

### Multiple flashes?
- Ensure only one hook per component
- Check for duplicate imports
- Verify old intervals are cleared

## 📞 Support

For issues or questions:
1. Check the documentation files
2. Review code comments
3. Check browser console
4. Test in different browsers

---

**Last Updated:** December 2024  
**Version:** 1.0.0  
**Status:** Production Ready ✅
