import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { AIClassifierService } from "../../services/AIClassifierService";

const classifySchema = z.object({
  text: z.string().min(1).max(10000),
  nodeId: z.string().uuid().nullable().optional(),
});

export function createClassifyRouter(params: {
  aiClassifier: AIClassifierService;
}): Router {
  const { aiClassifier } = params;
  const router = Router();

  router.post("/", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = classifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const tag = aiClassifier.classifyText(parsed.data.text);
    return res.json({
      tag,
      nodeId: parsed.data.nodeId ?? null,
    });
  });

  return router;
}
