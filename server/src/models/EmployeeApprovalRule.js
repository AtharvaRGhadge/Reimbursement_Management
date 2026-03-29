import mongoose from 'mongoose';

const approverLineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const employeeApprovalRuleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, default: '', trim: true },
    ruleManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isManagerApprover: { type: Boolean, default: true },
    approvers: [approverLineSchema],
    approversSequential: { type: Boolean, default: true },
    minApprovalPercentage: { type: Number, default: 60, min: 0, max: 100 },
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalWorkflow', default: null },
  },
  { timestamps: true }
);

employeeApprovalRuleSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

export const EmployeeApprovalRule = mongoose.model('EmployeeApprovalRule', employeeApprovalRuleSchema);
