import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import amqp from "amqplib";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../../.env") });

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

const RABBIT_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "pedidos_video";

async function bootstrap() {
  try {
    const connection = await amqp.connect(RABBIT_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    channel.prefetch(1);

    console.log("Worker is running and waiting for messages...");

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg) {
        const content = msg.content.toString();
        const videoTask = JSON.parse(content);
        console.log("Received task:", videoTask);
        try {
          // Simulate video processing with a delay
          await new Promise((resolve) => setTimeout(resolve, 5000));
          // Update task status to COMPLETED in the database
          await prisma.video.update({
            where: { id: videoTask.id },
            data: { status: "COMPLETED" },
          });
          console.log(`Task ${videoTask.id} completed.`);
          channel.ack(msg);
        } catch (error) {
          console.error(`Error processing task ${videoTask.id}:`, error);
          channel.nack(msg, false, true); // requeue the message
        }
      } else {
        console.log("Received null message");
      }
    });
  } catch (error) {
    console.error("Error in worker:", error);
  }
}
bootstrap();
