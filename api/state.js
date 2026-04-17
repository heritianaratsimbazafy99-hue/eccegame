import { allowMethods, handleApiError, sendJson } from "./_lib/http.js";
import { getSessionState } from "./_lib/session-service.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    const state = await getSessionState();
    sendJson(res, 200, state);
  } catch (error) {
    handleApiError(error, res);
  }
}
