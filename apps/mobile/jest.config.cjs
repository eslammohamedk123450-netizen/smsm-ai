module.exports = {
  preset: "jest-expo",
  testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
  // Shared infrastructure helpers live in supabase/functions/_shared, outside
  // this package. They are transformed here, so Babel helpers must resolve
  // against this package's node_modules.
  modulePaths: ["<rootDir>/node_modules"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
  coveragePathIgnorePatterns: ["/node_modules/", "/app/_layout.tsx"],
};
