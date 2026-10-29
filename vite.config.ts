/// <reference types="vitest" />
import type { PluginOption, UserConfig } from "vite";

declare const process: { env: Record<string, string | undefined> };

// plugin-react 는 vitest 밖에서만 불러온다 (테스트는 esbuild 가 tsx 를 직접 변환한다).
const plugins: PluginOption[] = [];
if (!process.env.VITEST) {
  const { default: react } = await import("@vitejs/plugin-react");
  plugins.push(react());
}

const config: UserConfig & { test: Record<string, unknown> } = {
  plugins,
  server: {
    proxy: {
      "/api": process.env.VITE_API_TARGET ?? "http://localhost:5000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    css: false,
  },
};

export default config;
