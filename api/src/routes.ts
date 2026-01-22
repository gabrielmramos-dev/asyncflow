import { FastifyInstance } from "fastify";
import { Channel } from "amqplib";
import { v4 as uuidv4 } from 'uuid'

export async function videoRoutes(
  app: FastifyInstance,
  { channel }: { channel: Channel },
) {
  const QUEUE_NAME = "pedidos_video";
  app.post("/convert", async (request, reply) => {
    const { videoName } = request.body as any;

    if (!videoName) {
      return reply.status(400).send({ error: "videoName is required" });
    }

    const message = {
      id: uuidv4(),
      videoName,
      status: "PENDING",
    };

    // publish the message to the queue

    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });

    return reply
      .status(200)
      .send({ message: "Task add to queue", id: message.id });
  });
}
