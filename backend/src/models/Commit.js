import mongoose from 'mongoose';

const ParagraphSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, default: '', maxlength: 10000 },
    origin: {
      type: String,
      enum: ['typed', 'pasted', 'ai', 'ai-edited', 'translated'],
      default: 'typed',
    },
    authorId: { type: String, default: null },
    prNumber: { type: Number },
  },
  { _id: false }
);

const CommitSchema = new mongoose.Schema(
  {
    _id: { type: String },
    docId: { type: String, ref: 'Document', required: true, index: true },
    branchId: { type: String, ref: 'Branch', required: true, index: true },
    parents: { type: [String], default: [] },
    authorId: { type: String, required: true },
    message: { type: String, required: true, trim: true, maxlength: 200 },
    paragraphs: { type: [ParagraphSchema], default: [] },
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

export const Commit = mongoose.model('Commit', CommitSchema);
