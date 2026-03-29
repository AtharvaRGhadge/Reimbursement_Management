import { Router } from 'express';
import { authRequired, loadUser, requireRoles } from '../middleware/auth.js';
import { Expense } from '../models/Expense.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { ApprovalWorkflow } from '../models/ApprovalWorkflow.js';
import { convertToCurrency } from '../services/currencyService.js';
import {
  resolveStepApprovers,
  canUserActOnStep,
  evaluateGroupStep,
} from '../services/approvalEngine.js';

const router = Router();
router.use(authRequired, loadUser);

function sortedSteps(workflow) {
  return [...workflow.steps].sort((a, b) => a.order - b.order);
}

async function computeCanActOnExpense(exp, userId, role) {
  if (exp.status !== 'pending') return false;
  const wf = exp.workflowId;
  if (!wf?.steps?.length) return false;
  const steps = sortedSteps(wf);
  const idx = exp.currentStepIndex ?? 0;
  if (idx >= steps.length) return false;
  const step = steps[idx];
  const submitter = await User.findById(exp.employeeId?._id || exp.employeeId).lean();
  if (!submitter) return false;
  let approverIds;
  try {
    approverIds = resolveStepApprovers(step, submitter);
  } catch {
    return false;
  }
  if (role === 'admin') return true;
  return canUserActOnStep(step, userId, approverIds);
}

router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Only employees can create expense claims' });
    }
    const {
      workflowId,
      amountOriginal,
      currencyOriginal,
      category,
      description,
      detailNotes,
      remarks,
      paidBy,
      expenseDate,
      receiptImage,
      ocrPayload,
    } = req.body;
    if (!workflowId || amountOriginal == null || !currencyOriginal || !category || !expenseDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const wf = await ApprovalWorkflow.findOne({
      _id: workflowId,
      companyId: req.user.companyId,
    });
    if (!wf) return res.status(400).json({ error: 'Invalid workflow' });

    const company = await Company.findById(req.user.companyId);
    const { amount, rate } = await convertToCurrency(
      Number(amountOriginal),
      String(currencyOriginal).toUpperCase(),
      company.currencyCode
    );

    const exp = await Expense.create({
      companyId: req.user.companyId,
      employeeId: req.user._id,
      workflowId: wf._id,
      amountOriginal: Number(amountOriginal),
      currencyOriginal: String(currencyOriginal).toUpperCase(),
      amountCompany: amount,
      exchangeRateUsed: rate,
      category,
      description: description || '',
      detailNotes: detailNotes || '',
      remarks: remarks || '',
      paidBy: ['employee', 'company_card', 'company'].includes(paidBy) ? paidBy : 'employee',
      expenseDate: new Date(expenseDate),
      receiptImage: receiptImage || undefined,
      ocrPayload: ocrPayload || undefined,
      status: 'draft',
    });
    res.status(201).json(exp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Could not create expense' });
  }
});

router.patch('/:id/submit', async (req, res) => {
  try {
    const exp = await Expense.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      employeeId: req.user._id,
    });
    if (!exp) return res.status(404).json({ error: 'Not found' });
    if (exp.status !== 'draft') return res.status(400).json({ error: 'Already submitted' });

    const wf = await ApprovalWorkflow.findById(exp.workflowId);
    if (!wf) return res.status(400).json({ error: 'Workflow missing' });

    const steps = sortedSteps(wf);
    if (steps.length === 0) return res.status(400).json({ error: 'Workflow has no steps' });

    const submitter = await User.findById(exp.employeeId).lean();
    for (const st of steps) {
      try {
        resolveStepApprovers(st, submitter);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    exp.status = 'pending';
    exp.currentStepIndex = 0;
    exp.stepStates = steps.map((_, i) => ({
      stepIndex: i,
      status: 'pending',
      votes: [],
    }));
    exp.history.push({
      stepIndex: 0,
      action: 'submit',
      byUserId: req.user._id,
      at: new Date(),
    });
    await exp.save();
    res.json(exp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Submit failed' });
  }
});

router.get('/mine', async (req, res) => {
  const list = await Expense.find({ companyId: req.user.companyId, employeeId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('workflowId', 'name')
    .lean();
  res.json(list);
});

router.get('/team', requireRoles('manager', 'admin'), async (req, res) => {
  const q = { companyId: req.user.companyId, status: { $in: ['approved', 'rejected', 'pending'] } };
  if (req.user.role === 'manager') {
    q.employeeId = { $in: await User.find({ companyId: req.user.companyId, managerId: req.user._id }).distinct('_id') };
  }
  const list = await Expense.find(q)
    .sort({ createdAt: -1 })
    .populate('employeeId', 'name email')
    .populate('workflowId')
    .limit(200)
    .lean();
  const enriched = [];
  for (const exp of list) {
    const canAct = await computeCanActOnExpense(exp, req.user._id, req.user.role);
    enriched.push({ ...exp, canAct });
  }
  res.json(enriched);
});

router.get('/all', requireRoles('admin'), async (req, res) => {
  const list = await Expense.find({ companyId: req.user.companyId })
    .sort({ createdAt: -1 })
    .populate('employeeId', 'name email')
    .populate('workflowId', 'name')
    .limit(500)
    .lean();
  res.json(list);
});

router.get('/pending', async (req, res) => {
  const pending = await Expense.find({
    companyId: req.user.companyId,
    status: 'pending',
  })
    .populate('workflowId')
    .populate('employeeId', 'name email managerId')
    .lean();

  const mine = [];
  for (const exp of pending) {
    const wf = exp.workflowId;
    if (!wf || !wf.steps) continue;
    const steps = sortedSteps(wf);
    const idx = exp.currentStepIndex;
    if (idx >= steps.length) continue;
    const step = steps[idx];
    const submitter = await User.findById(exp.employeeId).lean();
    let approverIds;
    try {
      approverIds = resolveStepApprovers(step, submitter);
    } catch {
      continue;
    }
    const can =
      req.user.role === 'admin' ||
      canUserActOnStep(step, req.user._id, approverIds);
    if (can) {
      mine.push({
        ...exp,
        _currentApprovers: approverIds,
        _stepMode: step.mode,
      });
    }
  }
  res.json(mine);
});

router.get('/:id', async (req, res) => {
  try {
    const exp = await Expense.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    })
      .populate('workflowId', 'name')
      .populate('employeeId', 'name email')
      .lean();
    if (!exp) return res.status(404).json({ error: 'Not found' });
    const empId = exp.employeeId?._id || exp.employeeId;
    const isOwner = empId?.toString() === req.user._id.toString();
    let allowed = isOwner || req.user.role === 'admin';
    if (!allowed && req.user.role === 'manager') {
      const report = await User.findOne({
        _id: empId,
        companyId: req.user.companyId,
        managerId: req.user._id,
      }).lean();
      allowed = Boolean(report);
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const history = exp.history || [];
    const userIds = [...new Set(history.map((h) => h.byUserId).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email')
      .lean();
    const nameById = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
    const historyWithNames = history.map((h) => ({
      ...h,
      approverName: h.byUserId ? nameById[h.byUserId.toString()] || '—' : '—',
      statusLabel:
        h.action === 'submit'
          ? 'Submitted'
          : h.action === 'approve' || h.action === 'override_approve'
            ? 'Approved'
            : h.action === 'reject' || h.action === 'override_reject'
              ? 'Rejected'
              : h.action,
    }));
    res.json({ ...exp, history: historyWithNames });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load expense' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const exp = await Expense.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      employeeId: req.user._id,
      status: 'draft',
    });
    if (!exp) return res.status(404).json({ error: 'Not found or not editable' });

    const wfCheck = await ApprovalWorkflow.findOne({
      _id: exp.workflowId,
      companyId: req.user.companyId,
    });
    if (!wfCheck) return res.status(400).json({ error: 'Invalid workflow' });

    const company = await Company.findById(req.user.companyId);
    const {
      workflowId,
      amountOriginal,
      currencyOriginal,
      category,
      description,
      detailNotes,
      remarks,
      paidBy,
      expenseDate,
      receiptImage,
      ocrPayload,
    } = req.body;

    if (workflowId) {
      const wf = await ApprovalWorkflow.findOne({
        _id: workflowId,
        companyId: req.user.companyId,
      });
      if (!wf) return res.status(400).json({ error: 'Invalid workflow' });
      exp.workflowId = workflowId;
    }
    if (category != null) exp.category = category;
    if (description != null) exp.description = description;
    if (detailNotes != null) exp.detailNotes = detailNotes;
    if (remarks != null) exp.remarks = remarks;
    if (paidBy != null && ['employee', 'company_card', 'company'].includes(paidBy)) {
      exp.paidBy = paidBy;
    }
    if (expenseDate) exp.expenseDate = new Date(expenseDate);
    if (receiptImage !== undefined) exp.receiptImage = receiptImage || undefined;
    if (ocrPayload !== undefined) exp.ocrPayload = ocrPayload;

    if (amountOriginal != null && currencyOriginal) {
      const { amount, rate } = await convertToCurrency(
        Number(amountOriginal),
        String(currencyOriginal).toUpperCase(),
        company.currencyCode
      );
      exp.amountOriginal = Number(amountOriginal);
      exp.currencyOriginal = String(currencyOriginal).toUpperCase();
      exp.amountCompany = amount;
      exp.exchangeRateUsed = rate;
    }

    await exp.save();
    const lean = await Expense.findById(exp._id).populate('workflowId', 'name').lean();
    res.json(lean);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Update failed' });
  }
});

router.post('/:id/action', async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approve or reject' });
    }

    const exp = await Expense.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      status: 'pending',
    });
    if (!exp) return res.status(404).json({ error: 'Not found or not pending' });

    const wf = await ApprovalWorkflow.findById(exp.workflowId);
    if (!wf) return res.status(400).json({ error: 'Workflow missing' });

    const steps = sortedSteps(wf);
    const idx = exp.currentStepIndex;
    if (idx >= steps.length) return res.status(400).json({ error: 'No active step' });

    const step = steps[idx];
    const submitter = await User.findById(exp.employeeId).lean();
    let approverIds;
    try {
      approverIds = resolveStepApprovers(step, submitter);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const isAdmin = req.user.role === 'admin';
    const allowed = isAdmin || canUserActOnStep(step, req.user._id, approverIds);
    if (!allowed) return res.status(403).json({ error: 'Not an approver for this step' });

    if (step.mode === 'single') {
      if (decision === 'reject') {
        exp.status = 'rejected';
        exp.resolvedComment = comment || '';
        exp.history.push({
          stepIndex: idx,
          action: 'reject',
          byUserId: req.user._id,
          comment,
          at: new Date(),
        });
        if (exp.stepStates[idx]) exp.stepStates[idx].status = 'rejected';
        await exp.save();
        return res.json(exp);
      }
      exp.history.push({
        stepIndex: idx,
        action: 'approve',
        byUserId: req.user._id,
        comment,
        at: new Date(),
      });
      if (exp.stepStates[idx]) exp.stepStates[idx].status = 'approved';
      exp.currentStepIndex += 1;
      if (exp.currentStepIndex >= steps.length) {
        exp.status = 'approved';
      }
      await exp.save();
      return res.json(exp);
    }

    if (step.mode === 'group') {
      const uid = req.user._id.toString();
      const existing = (exp.stepStates[idx]?.votes || []).some((v) => v.userId.toString() === uid);
      if (existing) return res.status(400).json({ error: 'Already voted this step' });

      if (!exp.stepStates[idx]) {
        exp.stepStates[idx] = { stepIndex: idx, status: 'pending', votes: [] };
      }
      exp.stepStates[idx].votes.push({
        userId: req.user._id,
        decision,
        comment,
        at: new Date(),
      });

      const evalResult = evaluateGroupStep(step, exp.stepStates[idx], approverIds);
      if (!evalResult.done) {
        exp.history.push({
          stepIndex: idx,
          action: decision === 'approve' ? 'approve' : 'reject',
          byUserId: req.user._id,
          comment,
          at: new Date(),
        });
        await exp.save();
        return res.json(exp);
      }

      if (evalResult.outcome === 'rejected') {
        exp.status = 'rejected';
        exp.resolvedComment = comment || '';
        exp.stepStates[idx].status = 'rejected';
        exp.history.push({
          stepIndex: idx,
          action: 'reject',
          byUserId: req.user._id,
          comment,
          at: new Date(),
        });
        await exp.save();
        return res.json(exp);
      }

      exp.stepStates[idx].status = 'approved';
      exp.history.push({
        stepIndex: idx,
        action: 'approve',
        byUserId: req.user._id,
        comment: 'Step completed by rule',
        at: new Date(),
      });
      exp.currentStepIndex += 1;
      if (exp.currentStepIndex >= steps.length) {
        exp.status = 'approved';
      }
      await exp.save();
      return res.json(exp);
    }

    return res.status(400).json({ error: 'Unknown step mode' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Action failed' });
  }
});

router.post('/:id/override', requireRoles('admin'), async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approve or reject' });
    }
    const exp = await Expense.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      status: 'pending',
    });
    if (!exp) return res.status(404).json({ error: 'Not found' });
    exp.status = decision === 'approve' ? 'approved' : 'rejected';
    exp.resolvedComment = comment || '';
    exp.history.push({
      stepIndex: exp.currentStepIndex,
      action: decision === 'approve' ? 'override_approve' : 'override_reject',
      byUserId: req.user._id,
      comment,
      at: new Date(),
    });
    await exp.save();
    res.json(exp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Override failed' });
  }
});

router.delete('/:id', async (req, res) => {
  const exp = await Expense.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
    employeeId: req.user._id,
    status: 'draft',
  });
  if (!exp) return res.status(404).json({ error: 'Not found' });
  await exp.deleteOne();
  res.json({ ok: true });
});

export default router;
