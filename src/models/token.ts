import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const tokenSchema = {
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    immutable: true,
  },
  token: { type: String, required: true },
  email: { type: String, required: true, immutable: true },
  expiresAfter: { type: Date },
};

export type TokenDocument = mongoose.Document &
  mongoose.InferRawDocType<typeof tokenSchema>;

export const Token = mongoose.model(
  'Token',
  new Schema<TokenDocument>(tokenSchema),
);
