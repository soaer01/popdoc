import mongoose from 'mongoose';

const BranchSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => `b_${Math.random().toString(36).slice(2, 10)}`,
    },
    docId: {
      type: String,
      ref: 'Document',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ['main', 'member', 'ai'],
      default: 'member',
    },
    ownerId: {
      type: String,
      default: null,
    },
    headId: {
      type: String,
      default: null,
    },
    forkedFrom: {
      type: String,
      default: null,
    },
    invited: {
      type: [String],
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

export const Branch = mongoose.model('Branch', BranchSchema);
