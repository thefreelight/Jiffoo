const fs = require('fs');

function patchFile(file, patches) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of patches) {
    if (!source.includes(from)) {
      throw new Error(`Patch target not found in ${file}: ${from.slice(0, 80)}`);
    }
    source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
}

patchFile('/app/apps/api/dist/core/auth/service.js', [
  [
    'const user = await (0, user_compat_1.createAuthUser)({',
    'let user = await (0, user_compat_1.createAuthUser)({',
  ],
  [
    `        if (!user.emailVerified) {
            await email_verification_service_1.EmailVerificationService.sendVerificationEmail(user.id, user.email, user.username);
        }`,
    `        if (!user.emailVerified) {
            if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
                user = await database_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        verificationToken: null,
                        verificationTokenExpiry: null,
                    },
                });
            }
            else {
                await email_verification_service_1.EmailVerificationService.sendVerificationEmail(user.id, user.email, user.username);
            }
        }`,
  ],
  [
    `        // Check if email is verified
        if (!user.emailVerified) {
            throw new Error('Email not verified. Please check your email for verification link.');
        }`,
    `        if (!user.emailVerified) {
            if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
                await database_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        verificationToken: null,
                        verificationTokenExpiry: null,
                    },
                });
                user.emailVerified = true;
            }
            else {
                throw new Error('Email not verified. Please check your email for verification link.');
            }
        }`,
  ],
]);

patchFile('/app/apps/api/dist/core/admin/extension-installer/routes.js', [
  [
    `    fastify.all('/plugin/:slug/api', {
        schema: {`,
    `    fastify.all('/plugin/:slug/api', {
        onRequest: [middleware_1.optionalAuthMiddleware],
        schema: {`,
  ],
  [
    `    fastify.all('/plugin/:slug/api/*', {
        schema: {`,
    `    fastify.all('/plugin/:slug/api/*', {
        onRequest: [middleware_1.optionalAuthMiddleware],
        schema: {`,
  ],
]);
