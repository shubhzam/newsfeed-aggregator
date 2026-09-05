import "dotenv/config";

class Config {
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly port: number;
  readonly webhookSecret: string;
  readonly webOrigins: string[];

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    this.databaseUrl = databaseUrl;
    this.redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
    this.webhookSecret = process.env.WEBHOOK_SECRET ?? "dev-shared-secret-please-change";
    this.webOrigins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}

export const config = new Config();