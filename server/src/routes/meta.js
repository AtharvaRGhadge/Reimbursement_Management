import { Router } from 'express';
import { Company } from '../models/Company.js';
import { fetchCountries } from '../services/currencyService.js';

const router = Router();
let cached;
let cachedAt = 0;
const CACHE_MS = 1000 * 60 * 60 * 6;

router.get('/countries', async (_req, res) => {
  try {
    const now = Date.now();
    if (!cached || now - cachedAt > CACHE_MS) {
      cached = await fetchCountries();
      cachedAt = now;
    }
    res.json(cached.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Could not load countries' });
  }
});

router.get('/company-preview/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    if (!code) return res.status(400).json({ error: 'Code required' });
    const c = await Company.findOne({ joinCode: code }).select('name').lean();
    if (!c) return res.status(404).json({ error: 'Invalid company code' });
    res.json({ companyName: c.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

export default router;
