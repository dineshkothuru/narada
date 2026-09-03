import type { FastifyInstance } from "fastify";
import { badRequest } from "../../lib/http.js";
import { clearDishImage, uploadDishImage } from "../../services/storage.js";

// Port of web/app/api/admin/image/route.ts. Multipart body: `itemId` field +
// `file` field. @fastify/multipart is registered locally to this plugin so
// only this route pays for parsing multipart bodies.
export default async function imageRoutes(app: FastifyInstance): Promise<void> {
  // The 4MB cap lives in services/storage.ts (IMAGE_LIMITS); this only needs
  // enough headroom that a genuinely oversize upload is still caught here as
  // a 413 rather than being buffered in full first.
  await app.register(import("@fastify/multipart"), {
    limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  });

  app.post("/api/admin/image", async (request, reply) => {
    let itemId = "";
    let file: { contentType: string; buffer: Buffer } | null = null;

    for await (const part of request.parts()) {
      if (part.type === "file" && part.fieldname === "file") {
        const buffer = await part.toBuffer();
        file = { contentType: part.mimetype, buffer };
      } else if (part.type === "field" && part.fieldname === "itemId") {
        itemId = String(part.value ?? "");
      }
    }

    if (!itemId) throw badRequest("itemId required");
    if (!file) throw badRequest("no file");

    const result = await uploadDishImage(
      app.repos,
      {
        itemId,
        contentType: file.contentType,
        size: file.buffer.length,
        body: file.buffer,
      },
      request.staffSession!.outletId,
    );
    return reply.send(result);
  });

  app.delete("/api/admin/image", async (request, reply) => {
    const itemId = String((request.query as Record<string, unknown>)?.itemId ?? "");
    if (!itemId) throw badRequest("itemId required");
    const result = await clearDishImage(app.repos, itemId, request.staffSession!.outletId);
    return reply.send(result);
  });
}
