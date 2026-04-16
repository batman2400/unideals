import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// This is the starting point of your React app.
// It grabs the <div id="root"> from index.html and renders
// your <App /> component inside it.
// BrowserRouter enables client-side routing throughout the app.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
