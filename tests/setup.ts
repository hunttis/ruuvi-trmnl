// Test setup file

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.exit to prevent tests from exiting
const mockExit = jest
  .spyOn(process, "exit")
  .mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`Process.exit(${code}) called`);
  });

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

export { mockExit };
