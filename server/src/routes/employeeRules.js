import { Router } from 'express';
import mongoose from 'mongoose';
import { authRequired, loadUser, requireRoles } from '../middleware/auth.js';
import { EmployeeApprovalRule } from '../models/EmployeeApprovalRule.js';
import { ApprovalWorkflow } from '../models/ApprovalWorkflow.js';
import { User } from '../models/User.js';
import { compileEmployeeRuleToSteps } from '../services/compileEmployeeRule.js';

const router = Router();
router.use(authRequired, loadUser);

async function syncWorkflowFromRule(ruleDoc) {
  const steps = compileEmployeeRuleToSteps(ruleDoc);
  if (steps.length === 0) {
    throw new Error('Add at least one approver or enable manager as approver');
  }

  const employee = await User.findById(ruleDoc.employeeId).lean();
  const wfName = `Employee rule · ${employee?.email || ruleDoc.employeeId}`;

  if (ruleDoc.workflowId) {
    const existing = await ApprovalWorkflow.findOne({
      _id: ruleDoc.workflowId,
      companyId: ruleDoc.companyId,
    });
    if (existing) {
      existing.name = wfName;
      existing.steps = steps;
      existing.isManagerApproverFirst = Boolean(ruleDoc.isManagerApprover);
      await existing.save();
      return existing._id;
    }
  }

  const wf = await ApprovalWorkflow.create({
    companyId: ruleDoc.companyId,
    name: wfName,
    isDefault: false,
    isManagerApproverFirst: Boolean(ruleDoc.isManagerApprover),
    steps,
  });
  return wf._id;
}

router.get('/for-me', async (req, res) => {
  const rule = await EmployeeApprovalRule.findOne({
    companyId: req.user.companyId,
    employeeId: req.user._id,
  }).lean();
  if (!rule?.workflowId) return res.json({ workflowId: null, rule: null });
  res.json({
    workflowId: rule.workflowId,
    rule: {
      description: rule.description,
      isManagerApprover: rule.isManagerApprover,
    },
  });
});

router.get('/', requireRoles('admin'), async (req, res) => {
  const list = await EmployeeApprovalRule.find({ companyId: req.user.companyId })
    .populate('employeeId', 'name email role managerId')
    .populate('ruleManagerId', 'name')
    .sort({ updatedAt: -1 })
    .lean();
  res.json(list);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  try {
    const {
      employeeId,
      description,
      ruleManagerId,
      isManagerApprover,
      approvers,
      approversSequential,
      minApprovalPercentage,
    } = req.body;

    if (!employeeId) return res.status(400).json({ error: 'employeeId required' });

    const emp = await User.findOne({
      _id: employeeId,
      companyId: req.user.companyId,
      role: 'employee',
    });
    if (!emp) return res.status(400).json({ error: 'Employee not found' });

    const lines = Array.isArray(approvers) ? approvers : [];
    if (!Boolean(isManagerApprover) && lines.length === 0) {
      return res.status(400).json({
        error: 'Enable “manager as approver” or add at least one approver',
      });
    }
    for (const line of lines) {
      const u = await User.findOne({
        _id: line.userId,
        companyId: req.user.companyId,
      });
      if (!u) return res.status(400).json({ error: 'Invalid approver user' });
    }

    if (ruleManagerId) {
      const m = await User.findOne({
        _id: ruleManagerId,
        companyId: req.user.companyId,
        role: 'manager',
      });
      if (!m) return res.status(400).json({ error: 'Manager override must be a manager in your company' });
    }

    const payload = {
      companyId: req.user.companyId,
      employeeId: new mongoose.Types.ObjectId(employeeId),
      description: description ?? '',
      ruleManagerId: ruleManagerId || null,
      isManagerApprover: Boolean(isManagerApprover),
      approvers: lines.map((l, i) => ({
        userId: l.userId,
        required: Boolean(l.required),
        order: l.order ?? i,
      })),
      approversSequential: Boolean(approversSequential),
      minApprovalPercentage: minApprovalPercentage ?? 60,
    };

    const doc = await EmployeeApprovalRule.findOneAndUpdate(
      { companyId: req.user.companyId, employeeId: payload.employeeId },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const wfId = await syncWorkflowFromRule(doc);
    doc.workflowId = wfId;
    await doc.save();

    const populated = await EmployeeApprovalRule.findById(doc._id)
      .populate('employeeId', 'name email')
      .populate('ruleManagerId', 'name')
      .lean();

    res.status(201).json(populated);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Could not save rule' });
  }
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const rule = await EmployeeApprovalRule.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
  });
  if (!rule) return res.status(404).json({ error: 'Not found' });
  if (rule.workflowId) {
    await ApprovalWorkflow.deleteOne({ _id: rule.workflowId, companyId: req.user.companyId });
  }
  await rule.deleteOne();
  res.json({ ok: true });
});

export default router;
