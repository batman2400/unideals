import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { RoleProvider } from "./lib/RoleContext";
import App from "./App";
import "./index.css";

// This is the starting point of your React app.
// It grabs the <div id="root"> from index.html and renders
// your <App /> component inside it.
// BrowserRouter enables client-side routing throughout the app.
// RoleProvider shares a single useRole() instance across the entire tree.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <RoleProvider>
        <App />
      </RoleProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
