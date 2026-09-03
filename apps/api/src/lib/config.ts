import "dotenv/config";

// single place that reads process.env - nothing else in the app should touch it directly
class Config {
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly port: number;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    this.databaseUrl = databaseUrl;
    this.redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  }
}

export const config = new Config();