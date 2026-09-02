import { invokeAuthedFunction } from "./authSession";

export async function notifyVerificationRejected(requestId) {
  const { error } = await invokeAuthedFunction("send-verification-rejected", {
    request_id: requestId,
  });
  if (error) {
    console.error("Could not send verification reject email:", error);
  }
}
