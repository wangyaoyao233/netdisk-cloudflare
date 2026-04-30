type LogLevel = "INFO" | "WARN" | "ERROR";

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  const line = `[${timestamp}] [${level}] ${message}${suffix}`;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    write("INFO", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    write("WARN", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    write("ERROR", message, context);
  },
};
