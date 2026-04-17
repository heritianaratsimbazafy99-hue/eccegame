import { allowMethods, handleApiError, readJsonBody, sendJson } from "./_lib/http.js";
import { replaceSnapshot } from "./_lib/session-service.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const state = await replaceSnapshot(body?.snapshot);
    sendJson(res, 200, state);
  } catch (error) {
    handleApiError(error, res);
  }
}
