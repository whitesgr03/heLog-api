import { vi, it, expect } from 'vitest';
import checkEnv from './../../utils/checkEnv';

it('should execute process.exit() if environment is missing', () => {
	vi.stubGlobal('process', {
		...process,
		exit: vi.fn(),
	});
	vi.stubEnv('test', undefined);

	const mockEnv = ['test'];

	checkEnv(mockEnv);

	expect(process.exit).toHaveBeenCalledWith(1);
});
