
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Read from runtime config (window.ENV) first, then fallback to build-time env
const PUBLISHABLE_KEY = window.ENV?.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
