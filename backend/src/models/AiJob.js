import mongoose from 'mongoose';

const AiJobSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => `job_${Math.random().toString(36).slice(2, 10)}`,
    },
    docId: {
      type: String,
      ref: 'Document',
      required: true,
      index: true,
    },
    branchId: {
      type: String,
      ref: 'Branch',
      required: true,
    },
    requestedBy: {
      type: String,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['rewrite', 'expand', 'summarize', 'translate'],
      required: true,
    },
    paragraphIds: {
      type: [String],
      required: true,
    },
    language: {
      type: String,
      default: null,
    },
    instructions: {
      type: String,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'done', 'failed'],
      default: 'queued',
      index: true,
    },
    prId: {
      type: String,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
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

export const AiJob = mongoose.model('AiJob', AiJobSchema);
