import Fastify from "fastify";
import amqp from "amqplib";

const app = Fastify({ logger: true });

const RABBIT_URL = "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "pedidos_video";

async function bootstrap() {
  try {
    const connection = await amqp.connect(RABBIT_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });

    await app.listen({ port: 3000 });
    console.log("API and RabbitMQ connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
