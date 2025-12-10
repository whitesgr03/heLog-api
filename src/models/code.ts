import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const codeSchema = {
	newUser: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		immutable: true,
	},
	code: { type: String, required: true },
	email: { type: String, required: true, immutable: true },
	verify: { type: Boolean, default: false },
	failCount: { type: Number, default: 0 },
	expiresAfter: { type: Date },
};

export type CodeDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof codeSchema>;

export const Code = mongoose.model(
	'Code',
	new Schema<CodeDocument>(codeSchema),
);
