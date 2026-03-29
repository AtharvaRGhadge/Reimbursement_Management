import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { ApprovalWorkflow } from '../models/ApprovalWorkflow.js';
import { fetchCountries } from '../services/currencyService.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function generateUniqueJoinCode() {
  for (let i = 0; i < 25; i++) {
    const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const taken = await Company.exists({ joinCode });
    if (!taken) return joinCode;
  }
  throw new Error('Could not generate company code');
}

function companyResponse(company) {
  return {
    id: company._id,
    name: company.name,
    currencyCode: company.currencyCode,
    currencySymbol: company.currencySymbol,
    countryCode: company.countryCode,
    joinCode: company.joinCode,
  };
}

router.post('/signup', async (req, res) => {
  try {
    const {
      accountType = 'admin',
      email,
      password,
      passwordConfirm,
      name,
      countryCode,
      joinCode: joinCodeInput,
    } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name required' });
    }
    if (!['admin', 'employee', 'manager'].includes(accountType)) {
      return res.status(400).json({ error: 'Invalid account type' });
    }
    if (passwordConfirm != null && password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);

    if (accountType === 'admin') {
      if (!countryCode) {
        return res.status(400).json({ error: 'countryCode required to create an organization' });
      }
      const countries = await fetchCountries();
      const c = countries.find((x) => x.countryCode === String(countryCode).toUpperCase());
      if (!c) return res.status(400).json({ error: 'Invalid country code' });

      const jc = await generateUniqueJoinCode();
      const company = await Company.create({
        name: `${name}'s Organization`,
        countryCode: c.countryCode,
        countryName: c.name,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol,
        joinCode: jc,
      });

      const admin = await User.create({
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'admin',
        companyId: company._id,
        managerId: null,
      });

      await ApprovalWorkflow.create({
        companyId: company._id,
        name: 'Default — Manager first',
        isDefault: true,
        isManagerApproverFirst: true,
        steps: [
          {
            order: 0,
            mode: 'single',
            useManager: true,
            rule: { type: 'all' },
          },
        ],
      });

      const token = signToken(admin);
      return res.status(201).json({
        token,
        user: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          companyId: admin.companyId,
        },
        company: companyResponse(company),
      });
    }

    const jc = String(joinCodeInput || '')
      .trim()
      .toUpperCase();
    if (!jc) {
      return res.status(400).json({ error: 'Company join code required' });
    }
    const company = await Company.findOne({ joinCode: jc });
    if (!company) {
      return res.status(400).json({ error: 'Invalid company code — check with your admin' });
    }

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: accountType,
      companyId: company._id,
      managerId: null,
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
      company: {
        id: company._id,
        name: company.name,
        currencyCode: company.currencyCode,
        currencySymbol: company.currencySymbol,
        countryCode: company.countryCode,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const companyRaw = await Company.findById(user.companyId).lean();
    const token = signToken(user);
    const companyPayload = companyRaw
      ? {
          id: companyRaw._id,
          name: companyRaw.name,
          currencyCode: companyRaw.currencyCode,
          currencySymbol: companyRaw.currencySymbol,
          countryCode: companyRaw.countryCode,
          ...(user.role === 'admin' && companyRaw.joinCode ? { joinCode: companyRaw.joinCode } : {}),
        }
      : null;
    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        managerId: user.managerId,
      },
      company: companyPayload,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({
        ok: true,
        message: 'If an account exists with this email, a reset link will be sent.',
      });
    }
    const token = crypto.randomBytes(24).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 1000 * 60 * 60);
    await user.save();
    console.info(`[email stub] Reset for ${user.email}: token=${token}`);
    return res.json({
      ok: true,
      message: 'If an account exists, a reset was prepared.',
      devToken: process.env.NODE_ENV !== 'production' ? token : undefined,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Request failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) {
      return res.status(400).json({ error: 'email, token, password required' });
    }
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: token,
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();
    return res.json({ ok: true, message: 'Password updated' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Reset failed' });
  }
});

export default router;
