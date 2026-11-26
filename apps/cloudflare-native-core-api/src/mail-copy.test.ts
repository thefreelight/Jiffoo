import { describe, expect, it } from 'vitest';

import { MAIL_LOCALES, accountMailCopy, resolveMailLocale } from './mail-copy';

const CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

/** Every sentence a player can be sent, with a name, a brand and a code put in place. */
function sentences(locale: string, name = '玩家'): string[] {
  const copy = accountMailCopy(locale as never);
  return [copy.verification, copy.reset].flatMap((mail) => [
    mail.subject('PLAYGROUND', '123456'),
    mail.text(name, 'PLAYGROUND', '123456'),
    mail.title,
    mail.intro(name, 'PLAYGROUND'),
    ...mail.expires,
    mail.ignore,
    copy.footer('PLAYGROUND'),
    copy.unmonitored,
  ]);
}

describe('account mail copy', () => {
  it('is written for every storefront language, with nothing left to fill in', () => {
    expect(MAIL_LOCALES).toEqual(['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de']);
    for (const locale of MAIL_LOCALES) {
      for (const sentence of sentences(locale)) {
        expect(sentence.trim(), `${locale}: ${sentence.slice(0, 40)}`).not.toBe('');
        expect(sentence, `${locale}: ${sentence.slice(0, 40)}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('puts the code, the name and the brand where they belong', () => {
    for (const locale of MAIL_LOCALES) {
      const copy = accountMailCopy(locale);
      expect(copy.verification.subject('PLAYGROUND', '123456')).toContain('123456');
      expect(copy.reset.subject('PLAYGROUND', '123456')).toContain('123456');
      expect(copy.verification.text('玩家', 'PLAYGROUND', '123456')).toContain('玩家');
      expect(copy.reset.intro('玩家', 'PLAYGROUND')).toContain('PLAYGROUND');
      expect(copy.footer('PLAYGROUND')).toContain('PLAYGROUND');
    }
  });

  it('keeps English exactly as the mails always read', () => {
    const copy = accountMailCopy('en');
    expect(copy.verification.subject('Jiffoo', '123456')).toBe('Jiffoo verification code: 123456');
    expect(copy.verification.title).toBe('Verify your email');
    expect(copy.verification.intro('Jordan', 'Jiffoo')).toBe('Hi Jordan, use the verification code below to finish setting up your Jiffoo account.');
    expect(copy.verification.expires).toEqual(['This code expires in ', '10 minutes', '.']);
    expect(copy.verification.text('Jordan', 'Jiffoo', '123456')).toBe(
      "Hi Jordan,\n\nYour Jiffoo verification code is 123456. It expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.",
    );
    expect(copy.reset.subject('Jiffoo', '123456')).toBe('Jiffoo password reset code: 123456');
    expect(copy.reset.title).toBe('Reset your password');
    expect(copy.reset.intro('Jordan', 'Jiffoo')).toBe('Hi Jordan, use the code below to reset your Jiffoo password.');
    expect(copy.footer('Jiffoo')).toBe('This is an automated message from Jiffoo.');
    expect(copy.unmonitored).toBe('Replies to this address are not monitored.');
  });

  it('is written in each language\u2019s own script', () => {
    for (const locale of ['zh-Hans', 'zh-Hant', 'ja', 'ko']) {
      for (const sentence of sentences(locale)) expect(sentence, `${locale}: ${sentence.slice(0, 40)}`).toMatch(CJK);
    }
    // An ASCII name, so only the copy's own script is judged.
    for (const locale of ['fr', 'de']) {
      for (const sentence of sentences(locale, 'Player')) expect(sentence, `${locale}: ${sentence.slice(0, 40)}`).not.toMatch(CJK);
    }
  });
});

describe('resolveMailLocale', () => {
  it.each([
    [undefined, 'en'],
    ['', 'en'],
    ['en', 'en'],
    ['en-US', 'en'],
    ['zh-Hans', 'zh-Hans'],
    ['zh-Hant', 'zh-Hant'],
    ['ZH-HANT', 'zh-Hant'],
    ['zh', 'zh-Hans'],
    ['zh-CN', 'zh-Hans'],
    ['zh-SG', 'zh-Hans'],
    ['zh-TW', 'zh-Hant'],
    ['zh-HK', 'zh-Hant'],
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['ko', 'ko'],
    ['fr', 'fr'],
    ['fr-CA', 'fr'],
    ['de', 'de'],
    ['es', 'en'],
  ])('%j → %s', (named, expected) => {
    expect(resolveMailLocale(named)).toBe(expected);
  });
});
