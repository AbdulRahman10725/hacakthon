import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("4000"),
  JWT_SECRET: z.string().optional(),
  DATABASE_URL: z.string().default("./data/ligma.db"),
  CLIENT_ORIGIN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema> & { JWT_SECRET: string };

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const env = parsed.data;

  if (!env.JWT_SECRET) {
    if (env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    console.warn("[env] JWT_SECRET not set — using development fallback. DO NOT use in production.");
    env.JWT_SECRET = "dev-secret-change-me-please-32chars";
  }

  if (env.NODE_ENV === "production" && env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  if (env.NODE_ENV === "production" && !env.CLIENT_ORIGIN) {
    throw new Error("CLIENT_ORIGIN is required in production");
  }

  return env as Env;
}
