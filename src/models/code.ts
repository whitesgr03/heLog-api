import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const codeSchema = {
	code: { type: String, required: true },
	email: { type: String, required: true, immutable: true },
	expiresAfter: { type: Date },
};

export type CodeDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof codeSchema>;

export const Code = mongoose.model(
	'Code',
	new Schema<CodeDocument>(codeSchema),
);
