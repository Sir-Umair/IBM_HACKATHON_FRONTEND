import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Investigation from './pages/Investigation';
import InvestigationResult from './pages/InvestigationResult';
import Transactions from './pages/Transactions';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <span className="brand-icon">🔍</span>
            <span className="brand-name">AI Financial Investigator</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" end className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📊</span> Dashboard
            </NavLink>
            <NavLink to="/investigate" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">🔍</span> Investigate
            </NavLink>
            <NavLink to="/transactions" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📋</span> Transactions
            </NavLink>
          </div>
          <div className="sidebar-footer">
            <span className="powered-by">Powered by IBM Bob + LangGraph</span>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/investigate" element={<Investigation />} />
            <Route path="/investigations/:id" element={<InvestigationResult />} />
            <Route path="/transactions" element={<Transactions />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
