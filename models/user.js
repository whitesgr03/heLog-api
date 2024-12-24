import mongoose from "mongoose";

const Schema = mongoose.Schema;

const UserModel = mongoose.model(
	"User",
	new Schema(
		{
			email: {
				type: String,
				required: true,
				immutable: true,
				lowercase: true,
			},
			password: {
				type: String,
			},
			username: { type: String },
			isAdmin: { type: Boolean, immutable: true },
			provider: { type: Array, required: true },
		},
		{ timestamps: true }
	)
);

export default UserModel;
