// Test setup file

// Mock string-width to avoid ES module issues
jest.mock("string-width", () => ({
  default: jest.fn((str: string) => {
    // Simple approximation: count emojis as 2, regular chars as 1
    let width = 0;
    for (const char of str) {
      const code = char.codePointAt(0) || 0;
      // Emoji range and other wide characters
      if (
        code >= 0x1f300 ||
        code >= 0x2600 ||
        code === 0x2705 ||
        code === 0x274c
      ) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }),
}));

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
