import { Schema, model } from 'mongoose';

const federatedSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			immutable: true,
		},
		provider: {
			type: String,
			required: true,
			immutable: true,
		},
		subject: { type: String, required: true, immutable: true },
	},
	{ timestamps: true },
);

export const Federated = model('Federated', federatedSchema);
