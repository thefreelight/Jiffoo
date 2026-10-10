CREATE TABLE callback_requests (
  "requestKey" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE,
  fact JSONB NOT NULL
);
