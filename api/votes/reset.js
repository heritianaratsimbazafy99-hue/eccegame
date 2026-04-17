import { allowMethods, handleApiError, sendJson } from "../_lib/http.js";
import { clearVotes } from "../_lib/session-service.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const state = await clearVotes();
    sendJson(res, 200, state);
  } catch (error) {
    handleApiError(error, res);
  }
}
