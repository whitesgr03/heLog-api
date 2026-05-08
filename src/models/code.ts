import { Schema, model } from 'mongoose';

const codeSchema = {
	code: { type: String, required: true },
	email: { type: String, required: true, immutable: true },
	expiresAfter: { type: Date },
};

export const Code = model('Code', new Schema(codeSchema));
