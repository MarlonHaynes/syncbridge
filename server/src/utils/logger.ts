type LogFields = Record<string, unknown>;

function format(level: string, msg: string, fields?: LogFields): string {
  const ts = new Date().toISOString();
  const extra = fields ? " " + JSON.stringify(fields) : "";
  return `[${ts}] [${level}] ${msg}${extra}`;
}

export const logger = {
  info(msg: string, fields?: LogFields) {
    console.log(format("INFO", msg, fields));
  },
  warn(msg: string, fields?: LogFields) {
    console.warn(format("WARN", msg, fields));
  },
  error(msg: string, fields?: LogFields) {
    console.error(format("ERROR", msg, fields));
  },
};
