const PREFIX = '[fluffytree]';

function write(method, message, context) {
  if (context === undefined) {
    console[method](`${PREFIX} ${message}`);
    return;
  }

  console[method](`${PREFIX} ${message}`, context);
}

export const logger = Object.freeze({
  info(message, context) {
    write('info', message, context);
  },
  warn(message, context) {
    write('warn', message, context);
  },
  error(message, context) {
    write('error', message, context);
  },
});
