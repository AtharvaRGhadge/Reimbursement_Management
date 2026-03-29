import { Router } from 'express';
import { authRequired, loadUser, requireRoles } from '../middleware/auth.js';
import { ApprovalWorkflow } from '../models/ApprovalWorkflow.js';

const router = Router();
router.use(authRequired, loadUser);

router.get('/available', async (req, res) => {
  const list = await ApprovalWorkflow.find({ companyId: req.user.companyId })
    .select('name isDefault')
    .sort({ name: 1 })
    .lean();
  res.json(list);
});

router.get('/', requireRoles('admin'), async (req, res) => {
  const list = await ApprovalWorkflow.find({ companyId: req.user.companyId })
    .sort({ name: 1 })
    .lean();
  res.json(list);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  try {
    const { name, isManagerApproverFirst, steps, isDefault } = req.body;
    if (!name || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'name and steps[] required' });
    }
    if (isDefault) {
      await ApprovalWorkflow.updateMany(
        { companyId: req.user.companyId },
        { $set: { isDefault: false } }
      );
    }
    const w = await ApprovalWorkflow.create({
      companyId: req.user.companyId,
      name,
      isManagerApproverFirst: Boolean(isManagerApproverFirst),
      isDefault: Boolean(isDefault),
      steps: steps.map((s, i) => ({
        order: s.order ?? i,
        mode: s.mode,
        useManager: Boolean(s.useManager),
        managerResolver: Boolean(s.managerResolver),
        ruleManagerId: s.ruleManagerId || undefined,
        approverUserId: s.approverUserId || undefined,
        approverUserIds: s.approverUserIds || [],
        rule: s.rule || { type: 'all' },
      })),
    });
    res.status(201).json(w);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save workflow' });
  }
});

router.patch('/:id', requireRoles('admin'), async (req, res) => {
  const w = await ApprovalWorkflow.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
  });
  if (!w) return res.status(404).json({ error: 'Not found' });
  const { name, isManagerApproverFirst, steps, isDefault } = req.body;
  if (name) w.name = name;
  if (typeof isManagerApproverFirst === 'boolean') w.isManagerApproverFirst = isManagerApproverFirst;
  if (isDefault === true) {
    await ApprovalWorkflow.updateMany(
      { companyId: req.user.companyId, _id: { $ne: w._id } },
      { $set: { isDefault: false } }
    );
    w.isDefault = true;
  }
  if (Array.isArray(steps)) {
    w.steps = steps.map((s, i) => ({
      order: s.order ?? i,
      mode: s.mode,
      useManager: Boolean(s.useManager),
      managerResolver: Boolean(s.managerResolver),
      ruleManagerId: s.ruleManagerId || undefined,
      approverUserId: s.approverUserId || undefined,
      approverUserIds: s.approverUserIds || [],
      rule: s.rule || { type: 'all' },
    }));
  }
  await w.save();
  res.json(w);
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const w = await ApprovalWorkflow.findOneAndDelete({
    _id: req.params.id,
    companyId: req.user.companyId,
  });
  if (!w) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
