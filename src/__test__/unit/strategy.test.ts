import { describe, it, vi, expect } from 'vitest';
import { federatedStrategyCallback } from '../../config/passport.js';

import { User } from '../../models/user.js';
import { Federated } from '../../models/federated.js';

describe('federated strategy verify callback', () => {
	it('should throw an error if strategy has unknown error occurs', async () => {
		const mockError = 'error';
		vi.spyOn(Federated, 'findOne').mockReturnValueOnce({
			exec: vi.fn().mockRejectedValueOnce(mockError),
		} as any);

		const mockToken = '';
		const mockProfile = {
			provider: '',
			id: '',
		};
		const mockDone = vi.fn();

		await federatedStrategyCallback(
			mockToken,
			mockToken,
			mockProfile as any,
			mockDone,
		);

		expect(mockDone).toHaveBeenCalledWith(mockError);
	});
	it('should create a new federated identity if the user federated identity is not associated with the Google account ', async () => {
		const mockToken = '';
		const mockProfile = {
			provider: 'google',
			id: 'id',
		};
		const mockDone = vi.fn();

		await federatedStrategyCallback(
			mockToken,
			mockToken,
			mockProfile as any,
			mockDone,
		);

		const newFederated = await Federated.findOne({
			provider: mockProfile.provider,
			subject: mockProfile.id,
		}).exec();

		expect(mockDone).toHaveBeenCalledWith(null, {
			id: newFederated?.user.toString(),
		});
	});
	it('should authenticate user if the user federated identity associated with the Google account ', async () => {
		const user = await new User({
			username: 'example',
			email: 'example@gmail.com',
			isAdmin: false,
		}).save();

		const newFederated = await new Federated({
			user: user.id,
			provider: 'google',
			subject: 'id',
		}).save();

		const mockToken = '';
		const mockProfile = {
			provider: newFederated.provider,
			id: newFederated.subject,
		};
		const mockDone = vi.fn();

		await federatedStrategyCallback(
			mockToken,
			mockToken,
			mockProfile as any,
			mockDone,
		);

		expect(mockDone).toHaveBeenCalledWith(null, { id: user.id.toString() });
	});
});
