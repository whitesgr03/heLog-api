import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const userSchema = {
	username: { type: String, required: true },
	isAdmin: { type: Boolean, required: true, immutable: true },
};

export type UserDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof userSchema>;

export const User = mongoose.model(
	'User',
	new Schema<UserDocument>(userSchema, { timestamps: true }),
);
