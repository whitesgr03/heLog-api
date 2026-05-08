import mongoose from 'mongoose';
import { database } from '../utils/loggers.js';

const connectDB = async () => {
	mongoose.connection
		.on('connecting', () => database('connecting...'))
		.on('connected', () => database('is connected.'))
		.on('disconnected', () => database('is disconnected.'))
		.on('error', err => database('has an error occurs: ', err));

	await mongoose
		.connect(process.env.DATABASE_STRING)
		.catch((err: Error) => database('has an error occur in connecting: ', err));
};

export default connectDB;
