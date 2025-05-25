import mongoose from "mongoose";

const Schema = mongoose.Schema;

const userSchema = {
	email: {
		type: String,
		required: true,
		immutable: true,
		lowercase: true,
	},
	username: { type: String, required: true },
	isAdmin: { type: Boolean, required: true, immutable: true },
	provider: [{ type: String, required: true }],
};

export type UserDocument = mongoose.Document &
	mongoose.InferRawDocType<typeof userSchema>;

export const User = mongoose.model(
	"User",
	new Schema<UserDocument>(userSchema, { timestamps: true })
);
