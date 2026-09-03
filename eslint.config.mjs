import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["web/**", "apps/web/**", "**/node_modules/**", "**/dist/**"],
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
  },
);
