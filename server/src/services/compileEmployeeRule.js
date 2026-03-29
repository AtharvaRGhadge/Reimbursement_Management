/**
 * Compiles an EmployeeApprovalRule into ApprovalWorkflow.steps
 */
export function compileEmployeeRuleToSteps(rule) {
  const lines = [...(rule.approvers || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let order = 0;
  const steps = [];

  if (rule.isManagerApprover) {
    steps.push({
      order: order++,
      mode: 'single',
      useManager: false,
      managerResolver: true,
      ruleManagerId: rule.ruleManagerId || undefined,
      rule: { type: 'all' },
    });
  }

  if (rule.approversSequential) {
    for (const line of lines) {
      steps.push({
        order: order++,
        mode: 'single',
        useManager: false,
        managerResolver: false,
        approverUserId: line.userId,
        rule: { type: 'all' },
      });
    }
    return steps;
  }

  const ids = lines.map((l) => l.userId);
  if (ids.length === 0) {
    return steps;
  }

  const requiredUserIds = lines.filter((l) => l.required).map((l) => l.userId);
  const nonRequiredUserIds = lines.filter((l) => !l.required).map((l) => l.userId);

  steps.push({
    order: order++,
    mode: 'group',
    useManager: false,
    managerResolver: false,
    approverUserIds: ids,
    rule: {
      type: 'required_min_pct',
      requiredUserIds,
      nonRequiredUserIds,
      minPercentage: rule.minApprovalPercentage ?? 60,
    },
  });

  return steps;
}
