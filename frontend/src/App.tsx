import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Leaf, ArrowRight, Printer, Sun, Moon } from 'lucide-react';
import HomePage from './pages/Home';
import AnalyzePage from './pages/Analyze';
import BenchmarksPage from './pages/Benchmarks';
import TelemetryPage from './pages/Telemetry';
import AmbientBackground from './components/AmbientBackground';
import { HEADLINE } from './generated/metrics';

const API_BASE = 'http://localhost:8001/api';

const NAV_LINKS = [
  { path: '/analyze',       label: 'Pathology Studio' },
  { path: '/benchmarks',    label: 'Benchmarks' },
  { path: '/telemetry',     label: 'Trust & Telemetry' },
  { path: '/',              label: 'Overview' },
];

function Nav({
  apiOnline,
  showPrint,
  theme,
  onToggleTheme,
}: {
  apiOnline: boolean | null;
  showPrint: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="nav">
      <div className="nav-inner">
        {/* Minimalist Studio Brand Logo & Wordmark */}
        <div className="nav-brand" onClick={() => navigate('/')}>
          <div className="nav-logo">
            <Leaf size={15} strokeWidth={2.4} />
          </div>
          <div className="nav-wordmark">
            <span>PhytoShield</span>
            <span className="brand-studio-badge">AI Studio</span>
          </div>
        </div>

        {/* Clean Segmented Navigation Links */}
        <div className="nav-links">
          {NAV_LINKS.map(({ path, label }) => {
            const isActive = location.pathname === path || (path === '/benchmarks' && location.pathname === '/model');
            return (
              <button
                key={path}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right Tools: Theme Toggle, Monospace Status, Action Button */}
        <div className="nav-right">
          {/* Subtle Theme Toggle */}
          <button
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="#475569" />}
          </button>

          {/* Model Status Monospace Chip */}
          {apiOnline !== null && (
            <div className={`api-status-badge ${apiOnline ? 'on' : 'off'}`}>
              <span className="api-dot" />
              <span>{apiOnline ? `EfficientNet-B0 · ${HEADLINE.accuracy}` : 'Engine Offline'}</span>
            </div>
          )}

          {/* Action Button: Clean, Sleek, Non-screaming */}
          {showPrint ? (
            <button className="btn-try btn-export-report" onClick={() => window.print()}>
              <Printer size={13} />
              <span>Export Report</span>
            </button>
          ) : (
            <button className="btn-try" onClick={() => navigate('/analyze')}>
              <span>Launch Studio</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="nav-logo" style={{ width: 22, height: 22, borderRadius: 6 }}>
            <Leaf size={12} strokeWidth={2.4} />
          </div>
          <span className="footer-copy">
            © 2026 PhytoShield AI · High-Precision Explainable Pathology Intelligence System
          </span>
        </div>
        <div className="footer-meta">
          <span>v1.2.0-prod</span>
          <span>EfficientNet-B0</span>
          <span>15 Pathogen Classes</span>
          <span>7-Engine XAI Suite</span>
        </div>
      </div>
    </footer>
  );
}

function AppInner() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('phyto_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('phyto_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const check = () =>
      fetch(`${API_BASE}/health`)
        .then(r => r.json())
        .then(d => setApiOnline(d.status === 'healthy' && d.model_loaded))
        .catch(() => setApiOnline(false));
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const showPrint = location.pathname === '/analyze';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <AmbientBackground />
      <Nav
        apiOnline={apiOnline}
        showPrint={showPrint}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <Routes location={location}>
              <Route path="/"              element={<HomePage />} />
              <Route path="/analyze"       element={<AnalyzePage apiBase={API_BASE} />} />
              <Route path="/benchmarks"    element={<BenchmarksPage />} />
              <Route path="/model"         element={<BenchmarksPage />} />
              <Route path="/telemetry"     element={<TelemetryPage />} />
              <Route path="*"              element={<HomePage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
