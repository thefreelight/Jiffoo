import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET ||= "test-email-verification-secret";
});

const { prismaMock, sendMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  sendMock: vi.fn(),
}));

vi.mock("@/config/database", () => ({ prisma: prismaMock }));
vi.mock("@/services/transactional-email.service", () => ({
  TransactionalEmailService: { send: sendMock },
}));

import { EmailVerificationService } from "@/services/email-verification.service";

describe("EmailVerificationService code flow", () => {
  const user = {
    id: "user-1",
    email: "buyer@example.com",
    username: "buyer",
    emailVerified: false,
    verificationToken: null as string | null,
    verificationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue(user);
    sendMock.mockResolvedValue({ messageId: "message-1" });
  });

  it("generates six-digit codes", () => {
    expect(EmailVerificationService.generateCode()).toMatch(/^\d{6}$/);
  });

  it("stores a code digest and sends the code in the verification email", async () => {
    const result = await EmailVerificationService.sendVerificationEmail(
      user.id,
      user.email,
      user.username
    );

    expect(result).toEqual({ success: true });
    const update = prismaMock.user.update.mock.calls[0][0];
    expect(update.data.verificationToken).toMatch(/^v1:[^:]+:[a-f0-9]{64}:0$/);
    expect(update.data.verificationToken).not.toMatch(/:\d{6}:/);
    const email = sendMock.mock.calls[0][0];
    const code = email.html.match(/letter-spacing: 8px[^>]*>(\d{6})</)?.[1];
    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifies the emailed code and clears the token", async () => {
    await EmailVerificationService.sendVerificationEmail(
      user.id,
      user.email,
      user.username
    );
    const update = prismaMock.user.update.mock.calls[0][0];
    user.verificationToken = update.data.verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
    prismaMock.user.findUnique.mockResolvedValue(user);
    const code = sendMock.mock.calls[0][0].html.match(
      /letter-spacing: 8px[^>]*>(\d{6})</
    )?.[1];

    const result = await EmailVerificationService.verifyCode(user.email, code);

    expect(result).toEqual({ success: true });
    const verificationUpdate = prismaMock.user.update.mock.calls.at(-1)?.[0];
    expect(verificationUpdate.data).toEqual({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    });
  });

  it("invalidates the code after five failed attempts", async () => {
    await EmailVerificationService.sendVerificationEmail(
      user.id,
      user.email,
      user.username
    );
    user.verificationToken =
      prismaMock.user.update.mock.calls[0][0].data.verificationToken;
    prismaMock.user.findUnique.mockResolvedValue(user);
    const sentCode = sendMock.mock.calls[0][0].html.match(
      /letter-spacing: 8px[^>]*>(\d{6})</
    )?.[1];
    const wrongCode = sentCode === "000000" ? "999999" : "000000";

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await EmailVerificationService.verifyCode(
        user.email,
        wrongCode
      );
      expect(result.success).toBe(false);
      if (attempt < 5) {
        user.verificationToken =
          prismaMock.user.update.mock.calls.at(-1)?.[0].data.verificationToken;
      }
    }

    expect(prismaMock.user.update.mock.calls.at(-1)?.[0].data).toEqual({
      verificationToken: null,
      verificationTokenExpiry: null,
    });
    expect(
      prismaMock.user.update.mock.calls.at(-1)?.[0].data
    ).not.toHaveProperty("emailVerified");
  });

  it("rejects an expired code before checking the digest", async () => {
    user.verificationToken = "v1:token:00".padEnd(71, "0");
    user.verificationTokenExpiry = new Date(Date.now() - 1);
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await EmailVerificationService.verifyCode(
      user.email,
      "123456"
    );

    expect(result).toEqual({
      success: false,
      error: "Verification code has expired",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
