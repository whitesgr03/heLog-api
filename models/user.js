const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
	email: {
		type: String,
		required: true,
		immutable: true,
		lowercase: true,
	},
	password: { type: String, required: true },
	name: { type: String, required: true },
	isAdmin: { type: Boolean, immutable: true },
	lastModified: { type: Date, required: true },
	createdAt: { type: Date, required: true, immutable: true },
});

const UserModel = mongoose.model("User", UserSchema);

module.exports = UserModel;
