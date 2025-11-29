import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.css";
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter as Router } from 'react-router-dom';
import 'moment/locale/th';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
 
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>

);