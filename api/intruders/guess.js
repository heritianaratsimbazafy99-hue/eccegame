import { allowMethods, handleApiError, readJsonBody, sendJson } from "../_lib/http.js";
import { createIntruderGuess } from "../_lib/session-service.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await createIntruderGuess(body?.cardId, body?.suspectIds);
    sendJson(res, 200, result);
  } catch (error) {
    handleApiError(error, res);
  }
}
