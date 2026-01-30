import { FastifyInstance } from "fastify";
import { Channel } from "amqplib";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export async function videoRoutes(
  app: FastifyInstance,
  { channel }: { channel: Channel },
) {
  const QUEUE_NAME = "pedidos_video";

  // Initialize database connection using environment variables
  // Using explicit config instead of connectionString to avoid SCRAM parsing issues
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DB || "asyncflow",
    user: process.env.POSTGRES_USER || "user",
    password: process.env.POSTGRES_PASSWORD || "password",
  });

  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    adapter,
  });

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
