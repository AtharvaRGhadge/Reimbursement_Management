import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import metaRoutes from './routes/meta.js';
import workflowRoutes from './routes/workflows.js';
import employeeRuleRoutes from './routes/employeeRules.js';
import expenseRoutes from './routes/expenses.js';
import 'dotenv/config';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/employee-rules', employeeRuleRoutes);
app.use('/api/expenses', expenseRoutes);

const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reimbursement';

connectDb(mongoUri)
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed', err);
    process.exit(1);
  });
