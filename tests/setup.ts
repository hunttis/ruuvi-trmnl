// Test setup file

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch globally to prevent any real network calls
global.fetch = jest.fn().mockImplementation(() => {
  throw new Error(
    "Real fetch() call detected in tests! All HTTP requests must be mocked."
  );
});

// Mock process.exit to prevent tests from exiting
const mockExit = jest
  .spyOn(process, "exit")
  .mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`Process.exit(${code}) called`);
  });

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset fetch mock to throw by default
  (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() => {
    throw new Error(
      "Real fetch() call detected in tests! All HTTP requests must be mocked."
    );
  });
});

export { mockExit };
