import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const federatedSchema = {
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
};

export type FederatedDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof federatedSchema>;

export const Federated = mongoose.model(
	'Federated',
	new Schema<FederatedDocument>(federatedSchema, { timestamps: true }),
);
