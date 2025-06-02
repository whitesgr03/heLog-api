import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
	test: {
		include: ["src/__test__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
		exclude: ["src/__test__/**/delete_*.{test,spec}.?(c|m)[jt]s?(x)"],
		setupFiles: "src/__test__/setup.js",
		env: loadEnv("", process.cwd(), ""),
		fileParallelism: false,
	},
});
