import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const codeSchema = {
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		immutable: true,
	},
	code: { type: String, required: true, immutable: true },
	email: { type: String, required: true, immutable: true },
	expiresAfter: {
		type: Date,
		required: true,
		immutable: true,
	},
};

export type CodeDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof codeSchema>;

export const Code = mongoose.model(
	'Code',
	new Schema<CodeDocument>(codeSchema),
);
