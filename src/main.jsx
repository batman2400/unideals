import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { RoleProvider } from "./lib/RoleContext";
import App from "./App";
import "./index.css";

import { HelmetProvider } from 'react-helmet-async';
import { clearChunkReloadFlag, isChunkLoadError, reloadForStaleChunk } from './lib/chunkReload';

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadForStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isChunkLoadError(event.reason)) return;
  event.preventDefault();
  reloadForStaleChunk();
});

window.setTimeout(() => {
  clearChunkReloadFlag();
}, 8000);

// This is the starting point of your React app.
// It grabs the <div id="root"> from index.html and renders
// your <App /> component inside it.
// BrowserRouter enables client-side routing throughout the app.
// RoleProvider shares a single useRole() instance across the entire tree.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <RoleProvider>
          <App />
        </RoleProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
