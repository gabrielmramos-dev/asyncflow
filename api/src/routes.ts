import { FastifyInstance } from "fastify";
import { Channel } from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

export async function videoRoutes(
  app: FastifyInstance,
  { channel }: { channel: Channel },
) {
  const QUEUE_NAME = "pedidos_video";

  const convertVideoSchema = z.object({
    videoName: z
      .string({ message: "videoName must be a string" })
      .min(1, "videoName is required and cannot be empty"),
  });
  app.post("/convert", async (request, reply) => {
    const { videoName } = convertVideoSchema.parse(request.body);

    const video = await prisma.video.create({
      data: {
        videoName,
        status: "PENDING",
      },
    });

    // publish the message to the queue
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(video)), {
      persistent: true,
    });

    return reply
      .status(202)
      .send({ message: "Task add to queue", id: video.id });
  });
}
