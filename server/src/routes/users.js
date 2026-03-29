import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authRequired, loadUser, requireRoles } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';

const router = Router();

function randomPassword() {
  return crypto.randomBytes(6).toString('base64url').slice(0, 12);
}

router.use(authRequired, loadUser);

router.get('/me', async (req, res) => {
  let companyRaw = await Company.findById(req.user.companyId).lean();
  if (req.user.role === 'admin' && companyRaw && !companyRaw.joinCode) {
    for (let i = 0; i < 25; i++) {
      const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const taken = await Company.exists({ joinCode });
      if (!taken) {
        await Company.updateOne({ _id: companyRaw._id }, { $set: { joinCode } });
        companyRaw = { ...companyRaw, joinCode };
        break;
      }
    }
  }
  let company = companyRaw;
  if (company && req.user.role !== 'admin') {
    const { joinCode: _jc, ...rest } = company;
    company = rest;
  }
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      companyId: req.user.companyId,
      managerId: req.user.managerId,
    },
    company,
  });
});

router.get('/', requireRoles('admin'), async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId })
    .select('email name role managerId isActive createdAt')
    .lean();
  res.json(users);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  try {
    const { email, password, name, role, managerId } = req.body;
    if (!email || !name || !role) {
      return res.status(400).json({ error: 'email, name, role required' });
    }
    const plainPassword = password || randomPassword();
    if (!['employee', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Only employee or manager can be created here' });
    }
    const exists = await User.findOne({
      email: email.toLowerCase(),
      companyId: req.user.companyId,
    });
    if (exists) return res.status(409).json({ error: 'Email exists in company' });

    let mgr = null;
    if (managerId) {
      mgr = await User.findOne({
        _id: managerId,
        companyId: req.user.companyId,
        role: 'manager',
      });
      if (!mgr) return res.status(400).json({ error: 'Invalid manager' });
    }

    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const u = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      companyId: req.user.companyId,
      managerId: role === 'employee' && mgr ? mgr._id : null,
    });
    res.status(201).json({
      id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      managerId: u.managerId,
      temporaryPassword: password ? undefined : plainPassword,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.post('/:id/send-password', requireRoles('admin'), async (req, res) => {
  try {
    const u = await User.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (u.role === 'admin' && u._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Use a direct reset for other admins' });
    }
    const plain = randomPassword();
    u.passwordHash = await bcrypt.hash(plain, 12);
    await u.save();
    console.info(`[email stub] Password for ${u.email}: ${plain}`);
    return res.json({
      ok: true,
      message:
        'A new temporary password was generated. In production this would be emailed; copy it from the response in dev.',
      temporaryPassword: plain,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to send password' });
  }
});

router.patch('/:id', requireRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, role, managerId } = req.body;
  const u = await User.findOne({ _id: id, companyId: req.user.companyId });
  if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.role === 'admin' && req.user._id.toString() !== id) {
    return res.status(403).json({ error: 'Cannot modify another admin' });
  }
  if (name) u.name = name;
  if (role && ['employee', 'manager', 'admin'].includes(role)) {
    u.role = role;
  }
  if (managerId !== undefined) {
    if (managerId === null) u.managerId = null;
    else {
      const mgr = await User.findOne({
        _id: managerId,
        companyId: req.user.companyId,
        role: 'manager',
      });
      if (!mgr) return res.status(400).json({ error: 'Invalid manager' });
      u.managerId = mgr._id;
    }
  }
  await u.save();
  res.json({
    id: u._id,
    email: u.email,
    name: u.name,
    role: u.role,
    managerId: u.managerId,
  });
});

export default router;
