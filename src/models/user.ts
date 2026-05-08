import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const userSchema = new Schema(
	{
		username: { type: String, required: true },
		email: { type: String },
		password: { type: String },
		isAdmin: { type: Boolean, required: true, immutable: true },
		expiresAfter: { type: Date },
	},
	{ timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model('User', userSchema);
