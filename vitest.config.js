import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
	test: {
		include: ["__test__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
		exclude: ["__test__/**/delete_*.{test,spec}.?(c|m)[jt]s?(x)"],
		setupFiles: "./__test__/setup.js",
		env: loadEnv("", process.cwd(), ""),
		fileParallelism: false,
	},
});
