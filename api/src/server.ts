import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import Fastify from "fastify";
import amqp from "amqplib";
import { videoRoutes } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const app = Fastify({ logger: true });

const RABBIT_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "pedidos_video";

async function bootstrap() {
  try {
    const connection = await amqp.connect(RABBIT_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });

    await app.register(videoRoutes, { channel });

    await app.listen({ port: 3000 });
    console.log("API and RabbitMQ connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
