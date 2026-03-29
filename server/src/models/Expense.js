import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, enum: ['approve', 'reject'], required: true },
    comment: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const stepStateSchema = new mongoose.Schema(
  {
    stepIndex: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    votes: [voteSchema],
    resolvedAt: Date,
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    stepIndex: Number,
    action: { type: String, enum: ['approve', 'reject', 'submit', 'override_approve', 'override_reject'] },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalWorkflow', required: true },
    amountOriginal: { type: Number, required: true, min: 0 },
    currencyOriginal: { type: String, required: true, uppercase: true },
    amountCompany: { type: Number, required: true, min: 0 },
    exchangeRateUsed: Number,
    category: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    detailNotes: { type: String, default: '', trim: true },
    remarks: { type: String, default: '', trim: true },
    paidBy: {
      type: String,
      enum: ['employee', 'company_card', 'company'],
      default: 'employee',
    },
    expenseDate: { type: Date, required: true },
    receiptImage: { type: String },
    ocrPayload: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
    },
    currentStepIndex: { type: Number, default: 0 },
    stepStates: [stepStateSchema],
    history: [historySchema],
    resolvedComment: String,
  },
  { timestamps: true }
);

expenseSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });
expenseSchema.index({ companyId: 1, status: 1 });

export const Expense = mongoose.model('Expense', expenseSchema);
