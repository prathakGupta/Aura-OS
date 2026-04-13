// server.js — AuraOS backend-node entry point  🌟 UPDATED (clinical routes added)
import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';

import connectDB from './src/config/db.js';
import { globalErrorHandler } from './src/middleware/errorHandler.js';

import forgeRoutes    from './src/routes/forge.js';
import shatterRoutes  from './src/routes/shatter.js';
import stateRoutes    from './src/routes/state.js';
import clinicalRoutes from './src/routes/clinical.js'; // 🌟 NEW

const app  = express();
const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_, res) => res.json({
  status: 'ok', service: 'aura-os-backend-node',
  timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()),
}));

app.use('/api/forge',    forgeRoutes);
app.use('/api/shatter',  shatterRoutes);
app.use('/api/state',    stateRoutes);
app.use('/api/clinical', clinicalRoutes); // 🌟 NEW

app.use((req, res) => res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` }));
app.use(globalErrorHandler);

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🧠 AuraOS backend-node on http://localhost:${PORT}`);
    console.log(`   Clinical API: http://localhost:${PORT}/api/clinical\n`);
  });
};

start().catch(err => { console.error('Fatal:', err); process.exit(1); });
export default app;