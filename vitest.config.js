import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
	test: {
		include: ["__test__/integration/**.test.js"],
		exclude: ["__test__/integration/delete_**.test.js"],
		setupFiles: ["__test__/integration/setup.js"],
		env: loadEnv("", process.cwd(), ""),
	},
});
