import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/globals.css';
import './i18n';
import { ErrorBoundary } from './components/ErrorBoundary';

// Disable all console output in production
// Keep only console.error for critical errors
if (import.meta.env.PROD) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  // Keep console.error for critical errors only
  // console.error is kept intentionally for debugging production issues
}

// Request persistent storage (modern API)
// Replaces deprecated webkitStorageInfo API
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) {
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('✅ Persistent storage granted');
      }
    } else {
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('ℹ️ Persistent storage not granted (browser may clear data)');
      }
    }
  }).catch(err => {
    // Keep console.warn for errors even in production
    console.warn('⚠️ Persistent storage request failed:', err);
  });
}

// Global error handler
window.addEventListener('error', (event) => {
  const errorInfo = event.error instanceof Error
    ? {
        message: event.error.message,
        stack: event.error.stack,
        name: event.error.name,
      }
    : { error: String(event.error) };
  console.error('Global error:', errorInfo);
});

window.addEventListener('unhandledrejection', (event) => {
  const rejectionInfo = event.reason instanceof Error
    ? {
        message: event.reason.message,
        stack: event.reason.stack,
        name: event.reason.name,
      }
    : { reason: String(event.reason) };
  console.error('Unhandled promise rejection:', rejectionInfo);
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
