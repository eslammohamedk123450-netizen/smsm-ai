module.exports = {
  preset: "jest-expo",
  testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
  coveragePathIgnorePatterns: ["/node_modules/", "/app/_layout.tsx"],
};
