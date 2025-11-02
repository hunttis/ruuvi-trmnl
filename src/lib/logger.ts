export class Logger {
  private static suppressConsole = false;

  public static setSuppressConsole(suppress: boolean): void {
    Logger.suppressConsole = suppress;
  }

  public static log(message: string): void {
    if (!Logger.suppressConsole) {
      console.log(message);
    }
  }

  public static warn(message: string): void {
    if (!Logger.suppressConsole) {
      console.warn(message);
    }
  }

  public static error(message: string): void {
    if (!Logger.suppressConsole) {
      console.error(message);
    }
  }
}
