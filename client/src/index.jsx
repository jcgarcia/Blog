import React from 'react';
import ReactDOM from 'react-dom/client'; // Import the new createRoot API
import App from './App';
import './index.css'; // Ensure global styles are imported

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
