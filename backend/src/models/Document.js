import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: {
      type: String,
      enum: ['owner', 'member', 'reviewer', 'viewer'],
      default: 'member',
    },
    lastActiveAt: { type: Date, default: null },
  },
  { _id: false }
);

const TitleHistorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    by: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => `d_${Math.random().toString(36).slice(2, 10)}`,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    ownerId: {
      type: String,
      required: true,
    },
    members: {
      type: [MemberSchema],
      default: [],
    },
    round: {
      type: String,
      enum: ['open', 'idea', 'polish'],
      default: 'open',
    },
    ledgerShared: {
      type: Boolean,
      default: false,
    },
    mainBranchId: {
      type: String,
      default: null,
    },
    titleHistory: {
      type: [TitleHistorySchema],
      default: [],
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

export const Document = mongoose.model('Document', DocumentSchema);
