# 🎯 Quick Performance Patterns - Cheat Sheet

## Common Performance Issues & Solutions

### 1. **Search Input Lag**
❌ **Problem:** App freezes when typing in search box
```javascript
// BAD - Searches on every keystroke
<input onChange={(e) => searchFiles(e.target.value)} />
```

✅ **Solution:** Use debouncing
```javascript
import { useDebouncedCallback } from './utils/hooks';

const debouncedSearch = useDebouncedCallback((value) => {
  searchFiles(value);
}, 300);

<input onChange={(e) => debouncedSearch(e.target.value)} />
```

---

### 2. **Scroll Performance**
❌ **Problem:** App lags when scrolling through large lists
```javascript
// BAD - Handler runs hundreds of times per second
<div onScroll={(e) => handleScroll(e)}>
```

✅ **Solution:** Use throttling
```javascript
import { useThrottledCallback } from './utils/hooks';

const throttledScroll = useThrottledCallback((e) => {
  handleScroll(e);
}, 100);

<div onScroll={throttledScroll}>
```

---

### 3. **Large Lists (1000+ items)**
❌ **Problem:** Rendering 1000+ items causes lag
```javascript
// BAD - Renders ALL items
{files.map(file => <FileItem key={file.id} file={file} />)}
```

✅ **Solution:** Virtual scrolling
```javascript
import { calculateVisibleRange } from './utils/performance';
import { useThrottledCallback } from './utils/hooks';

const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 20 });

const handleScroll = useThrottledCallback(() => {
  const range = calculateVisibleRange(
    containerRef.current.scrollTop,
    60, // item height in pixels
    containerRef.current.clientHeight,
    files.length
  );
  setVisibleRange(range);
}, 100);

const visibleFiles = files.slice(visibleRange.startIndex, visibleRange.endIndex + 1);

return (
  <div ref={containerRef} onScroll={handleScroll} style={{ height: '600px', overflow: 'auto' }}>
    <div style={{ height: files.length * 60 }}>
      <div style={{ transform: `translateY(${visibleRange.offsetY}px)` }}>
        {visibleFiles.map(file => (
          <FileItem key={file.id} file={file} style={{ height: 60 }} />
        ))}
      </div>
    </div>
  </div>
);
```

---

### 4. **Unnecessary Re-renders**
❌ **Problem:** Component re-renders even when props haven't changed
```javascript
// BAD - Re-renders on every parent update
function FileItem({ file }) {
  return <div>{file.name}</div>;
}
```

✅ **Solution:** Use React.memo
```javascript
import { memo } from 'react';

const FileItem = memo(function FileItem({ file }) {
  return <div>{file.name}</div>;
});

export default FileItem;
```

---

### 5. **Expensive Calculations**
❌ **Problem:** Recalculating on every render
```javascript
// BAD - Runs expensive calculation on every render
function FileList({ files }) {
  const sortedFiles = files.sort((a, b) => a.size - b.size); // Runs every render!
  return <div>{sortedFiles.map(...)}</div>;
}
```

✅ **Solution:** Use useMemo
```javascript
import { useMemo } from 'react';

function FileList({ files }) {
  const sortedFiles = useMemo(() => {
    return files.sort((a, b) => a.size - b.size);
  }, [files]); // Only recalculates when files change
  
  return <div>{sortedFiles.map(...)}</div>;
}
```

---

### 6. **Event Handler Re-creation**
❌ **Problem:** Creating new function on every render
```javascript
// BAD - New function created every render
function FileList({ onSelect }) {
  return (
    <div>
      {files.map(file => (
        <button onClick={() => onSelect(file.id)}>Select</button>
      ))}
    </div>
  );
}
```

✅ **Solution:** Use useCallback
```javascript
import { useCallback } from 'react';

function FileList({ onSelect }) {
  const handleSelect = useCallback((fileId) => {
    onSelect(fileId);
  }, [onSelect]);
  
  return (
    <div>
      {files.map(file => (
        <button onClick={() => handleSelect(file.id)}>Select</button>
      ))}
    </div>
  );
}
```

---

### 7. **Memory Leaks from Async Operations**
❌ **Problem:** Updating state after component unmounts
```javascript
// BAD - Can cause memory leak
useEffect(() => {
  fetchData().then(data => {
    setData(data); // Component might be unmounted!
  });
}, []);
```

✅ **Solution:** Check if mounted
```javascript
import { useIsMounted } from './utils/hooks';

const isMounted = useIsMounted();

useEffect(() => {
  fetchData().then(data => {
    if (isMounted()) {
      setData(data);
    }
  });
}, [isMounted]);
```

---

### 8. **Loading States**
❌ **Problem:** Blocking UI while fetching data
```javascript
// BAD - No loading feedback
async function loadFiles() {
  const files = await fetchFiles();
  setFiles(files);
}
```

✅ **Solution:** Show loading spinner
```javascript
import LoadingSpinner from './components/LoadingSpinner';

const [isLoading, setIsLoading] = useState(false);

async function loadFiles() {
  setIsLoading(true);
  try {
    const files = await fetchFiles();
    setFiles(files);
  } finally {
    setIsLoading(false);
  }
}

return isLoading ? <LoadingSpinner /> : <FileList files={files} />;
```

---

### 9. **Heavy Initial Load**
❌ **Problem:** Loading everything at once
```javascript
// BAD - Loads all dashboards immediately
import UserDashboard from './UserDashboard';
import AdminDashboard from './AdminDashboard';
import TeamLeaderDashboard from './TeamLeaderDashboard';
```

✅ **Solution:** Lazy load components
```javascript
import { lazy, Suspense } from 'react';
import LoadingSpinner from './components/LoadingSpinner';

const UserDashboard = lazy(() => import('./UserDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const TeamLeaderDashboard = lazy(() => import('./TeamLeaderDashboard'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      {/* Component will load only when needed */}
      <UserDashboard />
    </Suspense>
  );
}
```

---

### 10. **Window Resize Handler**
❌ **Problem:** Handler fires hundreds of times
```javascript
// BAD - Runs on every pixel change
window.addEventListener('resize', () => {
  setWindowWidth(window.innerWidth);
});
```

✅ **Solution:** Use debounced hook
```javascript
import { useWindowSize } from './utils/hooks';

function ResponsiveComponent() {
  const { width, height } = useWindowSize(150); // Debounced by 150ms
  
  return <div>Window: {width}x{height}</div>;
}
```

---

## 🎨 Component Optimization Checklist

Before deploying a component, check:

- [ ] Large lists use virtual scrolling or pagination
- [ ] Search inputs are debounced (300ms)
- [ ] Scroll handlers are throttled (100ms)
- [ ] Event handlers use `useCallback`
- [ ] Expensive calculations use `useMemo`
- [ ] Pure components are wrapped in `React.memo`
- [ ] Async operations check `isMounted()`
- [ ] Components show loading states
- [ ] Heavy components are lazy loaded
- [ ] Images are lazy loaded
- [ ] No console.logs in production
- [ ] Error boundaries are in place

---

## 🔍 How to Find Performance Issues

### 1. Chrome DevTools Profiler
```
1. Open DevTools → Performance tab
2. Click Record
3. Interact with your app
4. Stop recording
5. Look for yellow/red bars (long tasks)
```

### 2. React DevTools Profiler
```
1. Install React DevTools extension
2. Open DevTools → Profiler tab
3. Click Record
4. Interact with your app
5. Stop and analyze which components re-render
```

### 3. Console Performance Monitor
```javascript
import { PerformanceMonitor } from './utils/performance';

function MyComponent() {
  const monitor = new PerformanceMonitor('MyComponent');
  
  useEffect(() => {
    monitor.logRender();
  });
  
  // Every 10 renders, logs performance stats
}
```

---

## 📦 Bundle Size Optimization

### Check your bundle size:
```bash
npm run client:build
# Check dist/ folder size
```

### Analyze what's in your bundle:
```bash
npm install --save-dev rollup-plugin-visualizer
```

Then add to `vite.config.js`:
```javascript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })
  ]
});
```

---

## 🚀 Quick Wins (Do These First!)

1. **Remove console.logs in production** ✅ Already done in vite.config.js
2. **Lazy load routes** ✅ Already done in App.jsx
3. **Add loading spinners** ✅ Component created
4. **Debounce search** → Add to your search components
5. **Memoize components** → Add React.memo to FileItem, UserItem, etc.
6. **Virtual scroll file lists** → Implement in dashboard file lists

---

## 💡 Pro Tips

- **Don't optimize prematurely** - Profile first, then optimize
- **Test in production mode** - Development is always slower
- **Focus on user-perceived performance** - Loading states matter!
- **Measure before and after** - Use Chrome DevTools
- **Start with architectural changes** - They have the biggest impact

---

Need help implementing any of these? Just ask!
