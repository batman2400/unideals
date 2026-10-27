export const IMAGE_UPLOAD_TIMEOUT_MS = 45000;
export const SAVE_TIMEOUT_MS = 30000;
export const REQUEST_TIMEOUT_MS = 20000;

export const IMAGE_UPLOAD_TIMEOUT_MESSAGE =
  "The upload is taking too long. Your details are still here. Check your connection and try again.";

/** Stops a spinner when a request never comes back. The original request may still finish. */
export function withTimeout(promiseLike, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([Promise.resolve(promiseLike), timeout]).finally(() => {
    clearTimeout(timer);
  });
}

export function tookTooLongMessage(action, alreadyDone) {
  return `${action} is taking too long. Your details are still here. Check your connection and try again. If it keeps happening, wait a minute first: ${alreadyDone}`;
}
