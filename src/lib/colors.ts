// ANSI color codes for terminal output
export const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
};

// Helper functions for colored text
export const green = (text: string) => `${colors.green}${text}${colors.reset}`;
export const red = (text: string) => `${colors.red}${text}${colors.reset}`;
export const yellow = (text: string) => `${colors.yellow}${text}${colors.reset}`;
export const blue = (text: string) => `${colors.blue}${text}${colors.reset}`;
export const gray = (text: string) => `${colors.gray}${text}${colors.reset}`;
