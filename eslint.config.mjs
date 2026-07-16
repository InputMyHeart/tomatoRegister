export default [
  {
    ignores: [
      "**/node_modules/**",
      "miniprogram/miniprogram_npm/**",
      "work/**",
      ".codegraph/**",
      ".codex/**",
      ".agents/**",
    ],
  },
  {
    files: ["miniprogram/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        App: "readonly",
        Behavior: "readonly",
        Component: "readonly",
        console: "readonly",
        Page: "readonly",
        getApp: "readonly",
        getCurrentPages: "readonly",
        setTimeout: "readonly",
        wx: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrors: "all", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
    },
  },
  {
    files: ["cloudfunctions/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrors: "all", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
    },
  },
];
