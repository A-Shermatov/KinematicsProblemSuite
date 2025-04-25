import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Get the root element and ensure it exists
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element with id "root" not found in the DOM');
}

// Create the root and render the app
const root = createRoot(rootElement);
root.render(<App />);