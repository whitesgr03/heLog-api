import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const User = mongoose.model(
	"User",
	new Schema(
		{
			email: {
				type: String,
				required: true,
				immutable: true,
				lowercase: true,
			},
			username: { type: String, required: true },
			isAdmin: { type: Boolean, immutable: true },
			provider: { type: Array, required: true },
		},
		{ timestamps: true }
	)
);
