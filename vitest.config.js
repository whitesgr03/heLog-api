import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["__test__/integration/**.test.js"],
		exclude: ["__test__/integration/delete_**.test.js"],
		setupFiles: ["__test__/integration/setup.js"],
	},
});
