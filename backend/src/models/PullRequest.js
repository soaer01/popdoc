import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `cm_${Math.random().toString(36).slice(2, 10)}`,
    },
    authorId: { type: String, required: true },
    paragraphId: { type: String, default: null },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PullRequestSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => `pr_${Math.random().toString(36).slice(2, 10)}`,
    },
    number: {
      type: Number,
      required: true,
      index: true,
    },
    docId: {
      type: String,
      ref: 'Document',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['member', 'ai'],
      default: 'member',
    },
    sourceBranchId: {
      type: String,
      ref: 'Branch',
      required: true,
    },
    targetBranchId: {
      type: String,
      ref: 'Branch',
      required: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    aiRequestedBy: {
      type: String,
      default: null,
    },
    aiAction: {
      type: String,
      enum: ['rewrite', 'expand', 'summarize', 'translate', null],
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      default: '',
      maxlength: 4000,
    },
    contributionType: {
      type: String,
      enum: ['idea', 'evidence', 'structure', 'wording'],
      required: true,
    },
    confirmedType: {
      type: String,
      enum: ['idea', 'evidence', 'structure', 'wording', null],
      default: null,
    },
    aiInvolved: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['open', 'merged', 'closed'],
      default: 'open',
      index: true,
    },
    baseId: {
      type: String,
      default: null,
    },
    headId: {
      type: String,
      default: null,
    },
    approvals: {
      type: [String],
      default: [],
    },
    comments: {
      type: [CommentSchema],
      default: [],
    },
    mergedAt: {
      type: Date,
      default: null,
    },
    mergedBy: {
      type: String,
      default: null,
    },
    mergeMode: {
      type: String,
      enum: ['fast-forward', 'three-way', 'reviewed AI proposal', null],
      default: null,
    },
    mergeCommitId: {
      type: String,
      default: null,
    },
    acceptedCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const PullRequest = mongoose.model('PullRequest', PullRequestSchema);
