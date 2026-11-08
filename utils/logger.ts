const timestamp = () => new Date().toISOString().slice(11, 23);

export const logger = {
  step: (message: string) => console.log(`[${timestamp()}] ▶ ${message}`),
  info: (message: string) => console.log(`[${timestamp()}] ℹ ${message}`),
  warn: (message: string) => console.warn(`[${timestamp()}] ⚠ ${message}`),
};
