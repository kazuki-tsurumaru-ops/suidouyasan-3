export type User = {
  id: string;
  company_id: string;
  email: string;
  name: string | null;
  picture: string | null;
};

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    FILES: R2Bucket;
    APP_URL: string;
    ENVIRONMENT: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ALLOWED_EMAILS: string;
    DEV_LOGIN_EMAIL?: string;
    ENCRYPTION_KEY: string;
    AI_GATEWAY_URL?: string;
  };
  Variables: { user: User };
};
