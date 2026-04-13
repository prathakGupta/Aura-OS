// src/main.jsx
// StrictMode MUST stay removed — it double-invokes effects in dev,
// which initialises Matter.js engine twice causing a phantom engine.
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const AmbientBackground = () => (
  <>
    <div className="ambient">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
    </div>
    <div className="grid-overlay"></div>
  </>
);

createRoot(document.getElementById('root')).render(
  <>
    <AmbientBackground />
    <App />
  </>
);