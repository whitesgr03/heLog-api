import { Schema, model } from 'mongoose';

const tokenSchema = new Schema({
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		immutable: true,
	},
	token: { type: String, required: true },
	email: { type: String, required: true, immutable: true },
	expiresAfter: { type: Date },
});

export const Token = model('Token', tokenSchema);
