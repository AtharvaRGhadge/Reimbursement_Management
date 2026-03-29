import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    mode: { type: String, enum: ['single', 'group'], required: true },
    useManager: { type: Boolean, default: false },
    managerResolver: { type: Boolean, default: false },
    ruleManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approverUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rule: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const workflowSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    isManagerApproverFirst: { type: Boolean, default: true },
    steps: [stepSchema],
  },
  { timestamps: true }
);

workflowSchema.index({ companyId: 1, name: 1 });

export const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', workflowSchema);
