import mongoose from 'mongoose';

function countApprovals(votes) {
  const approve = votes.filter((v) => v.decision === 'approve').length;
  const reject = votes.filter((v) => v.decision === 'reject').length;
  return { approve, reject, total: votes.length };
}

function evaluateGroupRule(step, votes, approverIds) {
  const rule = step.rule || { type: 'all' };
  const { approve, reject } = countApprovals(votes);
  const n = approverIds.length;
  if (n === 0) return { done: true, outcome: 'rejected' };

  switch (rule.type) {
    case 'all': {
      if (approve === n) return { done: true, outcome: 'approved' };
      if (reject > 0) return { done: true, outcome: 'rejected' };
      return { done: false };
    }
    case 'percentage': {
      const threshold = rule.percentage ?? 100;
      const pct = (approve / n) * 100;
      if (pct >= threshold) return { done: true, outcome: 'approved' };
      const responded = new Set(votes.map((v) => v.userId.toString()));
      if (responded.size >= n && pct < threshold) {
        return { done: true, outcome: 'rejected' };
      }
      return { done: false };
    }
    case 'specific_user': {
      const sid = rule.specificUserId?.toString();
      const specificApproved = votes.some(
        (v) => v.decision === 'approve' && v.userId.toString() === sid
      );
      if (specificApproved) return { done: true, outcome: 'approved' };
      const responded = new Set(votes.map((v) => v.userId.toString()));
      if (responded.size >= n) return { done: true, outcome: 'rejected' };
      return { done: false };
    }
    case 'required_min_pct': {
      const reqIds = new Set((rule.requiredUserIds || []).map((id) => id.toString()));
      const nrList = (rule.nonRequiredUserIds || []).map((id) => id.toString());
      const minPct = rule.minPercentage ?? 60;

      for (const rid of reqIds) {
        const v = votes.find((x) => x.userId.toString() === rid);
        if (!v) return { done: false };
        if (v.decision === 'reject') return { done: true, outcome: 'rejected' };
      }

      if (nrList.length === 0) {
        return { done: true, outcome: 'approved' };
      }

      let approveNr = 0;
      let responded = 0;
      for (const id of nrList) {
        const v = votes.find((x) => x.userId.toString() === id);
        if (!v) continue;
        responded += 1;
        if (v.decision === 'approve') approveNr += 1;
      }

      const ratioPct = (approveNr / nrList.length) * 100;
      if (ratioPct >= minPct) {
        return { done: true, outcome: 'approved' };
      }

      if (responded >= nrList.length) {
        return { done: true, outcome: 'rejected' };
      }
      return { done: false };
    }
    case 'hybrid': {
      const op = rule.hybridOperator || 'OR';
      const parts = rule.hybridParts || [];
      const pctPart = parts.find((p) => p.kind === 'percentage');
      const specPart = parts.find((p) => p.kind === 'specific_user');
      const pctOk =
        pctPart && n > 0 && (approve / n) * 100 >= (pctPart.percentage ?? 0);
      const specOk =
        specPart &&
        specPart.userId &&
        votes.some(
          (v) =>
            v.decision === 'approve' && v.userId.toString() === specPart.userId.toString()
        );
      let satisfied = false;
      if (op === 'OR') satisfied = Boolean(pctOk || specOk);
      else satisfied = Boolean(pctOk && specOk);
      if (satisfied) return { done: true, outcome: 'approved' };
      const responded = new Set(votes.map((v) => v.userId.toString()));
      if (responded.size >= n && !satisfied) return { done: true, outcome: 'rejected' };
      return { done: false };
    }
    default:
      return { done: false };
  }
}

export function resolveStepApprovers(step, submitter) {
  const approverIds = [];
  if (step.mode === 'single') {
    if (step.managerResolver) {
      const mid = step.ruleManagerId || submitter.managerId;
      if (!mid) {
        throw new Error('No manager set for this approval step (assign a manager on the user or in the rule)');
      }
      approverIds.push(mid);
    } else if (step.useManager) {
      if (!submitter.managerId) {
        throw new Error('Employee has no manager assigned for this step');
      }
      approverIds.push(submitter.managerId);
    } else if (step.approverUserId) {
      approverIds.push(step.approverUserId);
    }
  } else if (step.mode === 'group') {
    for (const id of step.approverUserIds || []) {
      approverIds.push(id);
    }
  }
  return approverIds.map((id) => new mongoose.Types.ObjectId(id));
}

export function canUserActOnStep(step, userId, approverIds) {
  const uid = userId.toString();
  return approverIds.some((a) => a.toString() === uid);
}

export function evaluateGroupStep(step, stepState, approverIds) {
  return evaluateGroupRule(step, stepState.votes || [], approverIds);
}
