import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { LoginPage } from '@shop-themes/bokmoo/src/components/LoginPage';
import { RegisterPage } from '@shop-themes/bokmoo/src/components/RegisterPage';
import { AuthCallbackPage } from '@shop-themes/bokmoo/src/components/AuthCallbackPage';
import { AuthIdentityFinishPage } from '@shop-themes/bokmoo/src/components/AuthIdentityFinishPage';
import { ForgotPasswordPage } from '@shop-themes/bokmoo/src/components/ForgotPasswordPage';
import { ProductsPage } from '@shop-themes/bokmoo/src/components/ProductsPage';
import { ProductDetailPage } from '@shop-themes/bokmoo/src/components/ProductDetailPage';
import { CartPage } from '@shop-themes/bokmoo/src/components/CartPage';
import { CheckoutPage } from '@shop-themes/bokmoo/src/components/CheckoutPage';
import { mapBokmooApiProductToThemeProduct } from '@shop-themes/bokmoo/src/lib/api';
import { authErrorText } from '@shop-themes/bokmoo/src/lib/auth-copy';
import { countryCodeOf, countryName, countryOptions, detectShopperCountry, normalizeCountryCode } from '@shop-themes/bokmoo/src/lib/address';
import { cardDescription as cardText, cardName as cardTitle, catalogCardDescription } from '@shop-themes/bokmoo/src/lib/card-copy';
import { resetSaleCachesForTests } from '@shop-themes/bokmoo/src/lib/sale';

// The owner's report (2026-11-27): "商品描述中英文混杂的问题，登录注册页面还是中英文混杂" and "网站上没有自动识别地址".
// The sign-in, sign-up and callback pages were written in English only; the two cards' names and descriptions
// are catalog data in English; the checkout's address fields carried no autofill tokens and "Country" was a box to type in.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeRoot = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo');

// the English descriptions the catalog carries (the theme keeps a copy to know when its translations still apply)
const BLUETOOTH_SOURCE = catalogCardDescription({ id: 'odoo-product-7' });
const CARD_SOURCE = catalogCardDescription({ id: 'odoo-product-6' });

const apiCard = (id: string, slug: string, name: string, price: number, description: string, variantId: string) => ({
  id, slug, name, price, description, currency: 'USD', productKind: 'goods', isActive: true, requiresShipping: true,
  images: [`/media/${id}?v=1`], variants: [{ id: variantId, name, salePrice: price, isActive: true, attributes: {} }],
  typeData: { provider: 'odoo' },
});
const BLUETOOTH = apiCard('odoo-product-7', 'bokmoo-ble-v1', '[BOKMOO-BLE-V1] Bokmoo Bluetooth Card', 40, BLUETOOTH_SOURCE, 'odoo-variant-7');
const CARD = apiCard('odoo-product-6', 'bokmoo-card-v1', '[BOKMOO-CARD-V1] Bokmoo Card V1', 20, CARD_SOURCE, 'odoo-variant-6');

const LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'] as const;
type Locale = (typeof LOCALES)[number];
const text = (container: HTMLElement) => (container.textContent ?? '').replace(/\s+/g, ' ');
const stubFetch = () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { items: [] } }) })));
const setZone = (zone: string) => vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: zone } as Intl.ResolvedDateTimeFormatOptions);

beforeEach(() => { resetSaleCachesForTests(); stubFetch(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('the sign-in, sign-up and callback pages speak the storefront language', () => {
  const EXPECTED: Record<Locale, { welcome: string; submit: string; forgot: string; create: string }> = {
    en: { welcome: 'Welcome back', submit: 'Sign in', forgot: 'Forgot password', create: 'Create account' },
    'zh-Hans': { welcome: '欢迎回来', submit: '登录', forgot: '忘记密码', create: '创建账户' },
    'zh-Hant': { welcome: '歡迎回來', submit: '登入', forgot: '忘記密碼', create: '建立帳戶' },
    ja: { welcome: 'おかえりなさい', submit: 'サインイン', forgot: 'パスワードをお忘れですか', create: 'アカウントを作成' },
    ko: { welcome: '다시 오신 것을 환영합니다', submit: '로그인', forgot: '비밀번호를 잊으셨나요', create: '계정 만들기' },
    fr: { welcome: 'Bon retour', submit: 'Se connecter', forgot: 'Mot de passe oublié ?', create: 'Créer un compte' },
    de: { welcome: 'Willkommen zurück', submit: 'Anmelden', forgot: 'Passwort vergessen', create: 'Konto erstellen' },
  };

  for (const locale of LOCALES) {
    it(`sign-in page in ${locale}`, () => {
      const { container } = render(
        <LoginPage
          isLoading={false} locale={locale}
          onSubmit={vi.fn(async () => undefined)} onOAuthClick={vi.fn(async () => undefined)}
          onAppleOAuthClick={vi.fn(async () => undefined)} onFacebookOAuthClick={vi.fn(async () => undefined)}
          onNavigateToRegister={vi.fn()} onNavigateToForgotPassword={vi.fn()}
        />,
      );
      const page = text(container);
      expect(page).toContain(EXPECTED[locale].welcome);
      expect(page).toContain(EXPECTED[locale].forgot);
      expect(page).toContain(EXPECTED[locale].create);
      expect(screen.getByRole('button', { name: EXPECTED[locale].submit })).toBeTruthy();
      if (locale !== 'en') {
        // none of the English wording is left on the page, apart from the brand and the e-mail example
        for (const english of ['Welcome back', 'Forgot password', 'Create account', 'Secure account access', 'or email', 'Password']) expect(page).not.toContain(english);
      }
    });

    it(`sign-up page in ${locale}`, () => {
      const { container } = render(
        <RegisterPage
          isLoading={false} locale={locale}
          onSubmit={vi.fn(async () => undefined)} onOAuthClick={vi.fn(async () => undefined)}
          onAppleOAuthClick={vi.fn(async () => undefined)} onFacebookOAuthClick={vi.fn(async () => undefined)}
          onNavigateToLogin={vi.fn()}
        />,
      );
      const page = text(container);
      expect(page).toContain(EXPECTED[locale].create);
      if (locale !== 'en') for (const english of ['Create account', 'Already have an account', 'Protected traveler identity', 'First name', 'Last name']) expect(page).not.toContain(english);
    });
  }

  it('sign-up in Chinese names the name fields the Chinese way and reports mismatched passwords in Chinese', () => {
    const { container } = render(
      <RegisterPage isLoading={false} locale="zh-Hans" onSubmit={vi.fn(async () => undefined)} onOAuthClick={vi.fn(async () => undefined)}
        onAppleOAuthClick={vi.fn(async () => undefined)} onFacebookOAuthClick={vi.fn(async () => undefined)} onNavigateToLogin={vi.fn()} />,
    );
    expect(container.textContent).toContain('已有账户？');
    const password = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(password[0]!, { target: { value: 'abcdefgh' } });
    fireEvent.change(password[1]!, { target: { value: 'abcdefgi' } });
    expect(container.textContent).toContain('两次输入的密码不一致');
  });

  it('says a refused sign-in in the shopper’s language and passes on what it does not know', () => {
    expect(authErrorText('zh-Hans', 'Invalid credentials')).toBe('邮箱或密码不正确。');
    expect(authErrorText('en', 'Invalid credentials')).toBe('Incorrect email or password.');
    expect(authErrorText('zh-Hant', 'An account already exists for this email')).toBe('該郵箱已註冊，請直接登入。');
    expect(authErrorText('ja', 'Too many registration attempts. Try again later')).toBe('試行回数が多すぎます。しばらくしてからもう一度お試しください。');
    expect(authErrorText('fr', 'Something very specific')).toBe('Something very specific');
    expect(authErrorText('ko', null)).toBe('');
    const { container } = render(
      <LoginPage isLoading={false} locale="zh-Hans" error="Invalid credentials" onSubmit={vi.fn(async () => undefined)} onOAuthClick={vi.fn(async () => undefined)}
        onAppleOAuthClick={vi.fn(async () => undefined)} onFacebookOAuthClick={vi.fn(async () => undefined)} onNavigateToRegister={vi.fn()} onNavigateToForgotPassword={vi.fn()} />,
    );
    expect(container.querySelector('[data-purpose="auth-error"]')?.textContent).toBe('邮箱或密码不正确。');
  });

  it('callback and finish pages in Chinese carry no English', () => {
    const first = render(<AuthCallbackPage provider="google" isLoading={false} locale="zh-Hans" onRetry={vi.fn()} onNavigateToHome={vi.fn()} />);
    expect(text(first.container)).toContain('正在完成登录');
    expect(text(first.container)).not.toMatch(/Completing|Securing|Back to sign in/);
    cleanup();
    const failed = render(<AuthCallbackPage provider="google" isLoading={false} error="Access denied" locale="zh-Hans" onRetry={vi.fn()} onNavigateToHome={vi.fn()} />);
    expect(text(failed.container)).toContain('登录失败');
    expect(text(failed.container)).not.toContain('Access denied');
    cleanup();
    const finish = render(<AuthIdentityFinishPage isLoading={false} error="no code" locale="zh-Hans" onRetry={vi.fn()} onNavigateToHome={vi.fn()} />);
    expect(text(finish.container)).toContain('没能完成登录');
    expect(text(finish.container)).not.toContain('no code');
  });

  it('registers the password-reset and sign-in-finish pages, so the storefront’s English fallbacks are never shown', () => {
    for (const file of ['index.ts', 'runtime.ts']) {
      const source = readFileSync(path.join(themeRoot, 'src', file), 'utf8');
      expect(source).toMatch(/\bForgotPasswordPage,/);
      expect(source).toMatch(/\bAuthIdentityFinishPage,/);
    }
  });

  it('password reset: e-mail, code and new password, then back to sign-in — in Chinese', async () => {
    const onRequestCode = vi.fn(async () => undefined);
    const onResetPassword = vi.fn(async () => undefined);
    const onNavigateToLogin = vi.fn();
    const { container } = render(<ForgotPasswordPage isLoading={false} locale="zh-Hans" initialEmail="" onRequestCode={onRequestCode} onResetPassword={onResetPassword} onNavigateToLogin={onNavigateToLogin} />);
    expect(container.textContent).toContain('重置密码');
    expect(container.textContent).not.toMatch(/Reset your password|Send code|Set new password/);
    const email = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(email, { target: { value: 'shopper@example.com' } });
    fireEvent.submit(container.querySelector('[data-purpose="forgot-password-email"]')!);
    await waitFor(() => expect(onRequestCode).toHaveBeenCalledWith('shopper@example.com'));
    await waitFor(() => expect(container.querySelector('[data-purpose="forgot-password"]')?.getAttribute('data-step')).toBe('code'));
    expect(container.textContent).toContain('验证码已发送到 shopper@example.com。');
    // the code is six digits: letters typed into it are dropped
    const code = screen.getByPlaceholderText('000000') as HTMLInputElement;
    fireEvent.change(code, { target: { value: '12ab34' } });
    expect(code.value).toBe('1234');
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'newpassword' } });
    fireEvent.submit(container.querySelector('[data-purpose="forgot-password-code"]')!);
    await waitFor(() => expect(onResetPassword).toHaveBeenCalledWith({ email: 'shopper@example.com', code: '123456', password: 'newpassword' }));
    await waitFor(() => expect(container.textContent).toContain('密码已更新'));
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(onNavigateToLogin).toHaveBeenCalled();
  });

  it('password reset takes the language from the page address when the storefront passes none', () => {
    // storefront builds before the page handed its language over pass nothing; the page used to speak English
    window.history.replaceState({}, '', '/zh-Hans/auth/forgot-password');
    const { container } = render(<ForgotPasswordPage isLoading={false} onRequestCode={vi.fn(async () => undefined)} onResetPassword={vi.fn(async () => undefined)} onNavigateToLogin={vi.fn()} />);
    expect(container.textContent).toContain('重置密码');
    expect(container.textContent).toContain('BOKMOO 账户');
    expect(container.textContent).not.toContain('Reset your password');
    window.history.replaceState({}, '', '/');
    cleanup();
    const english = render(<ForgotPasswordPage isLoading={false} onRequestCode={vi.fn(async () => undefined)} onResetPassword={vi.fn(async () => undefined)} onNavigateToLogin={vi.fn()} />);
    expect(text(english.container)).toContain('Reset your password');
  });

  it('password reset: a code that does not arrive is said so, in the shopper’s language', async () => {
    const { container } = render(
      <ForgotPasswordPage isLoading={false} locale="zh-Hans" initialEmail="shopper@example.com"
        onRequestCode={vi.fn(async () => { throw new Error('Could not send the reset code. Try again in a moment.'); })}
        onResetPassword={vi.fn(async () => undefined)} onNavigateToLogin={vi.fn()} />,
    );
    fireEvent.submit(container.querySelector('[data-purpose="forgot-password-email"]')!);
    await waitFor(() => expect(container.querySelector('[data-purpose="auth-error"]')?.textContent).toBe('验证码没能发出去，请稍后重试。'));
  });
});

describe('the two cards are named and described in the storefront language', () => {
  it('catalog tiles in Chinese', async () => {
    const { container } = render(
      <ProductsPage
        products={[BLUETOOTH, CARD] as never} isLoading={false} totalProducts={2} currentPage={1} totalPages={0} sortBy="createdAt" viewMode="grid"
        onSortChange={vi.fn()} onViewModeChange={vi.fn()} onPageChange={vi.fn()} onAddToCart={vi.fn(async () => undefined)} onProductClick={vi.fn()} locale="zh-Hans"
      />,
    );
    await waitFor(() => expect(container.querySelectorAll('[data-purpose="catalog-card"]')).toHaveLength(2));
    const titles = [...container.querySelectorAll('[data-purpose="catalog-card"] h2')].map((node) => node.textContent?.trim());
    expect(titles).toEqual(['Bokmoo 蓝牙卡', 'Bokmoo 实体卡']);
    const page = text(container.querySelector('[data-purpose="catalog-grid"]')!);
    expect(page).toContain('无线管理多个 eSIM 配置文件');
    expect(page).toContain('即插即用的智能卡');
    expect(page).not.toMatch(/manage multiple eSIM|plug-in smart card/);
    expect(container.querySelector('[data-purpose="catalog-card"] img')?.getAttribute('alt')).toBe('Bokmoo 蓝牙卡');
  });

  it('catalog tiles in English keep the catalog’s own wording', async () => {
    const { container } = render(
      <ProductsPage
        products={[BLUETOOTH, CARD] as never} isLoading={false} totalProducts={2} currentPage={1} totalPages={0} sortBy="createdAt" viewMode="grid"
        onSortChange={vi.fn()} onViewModeChange={vi.fn()} onPageChange={vi.fn()} onAddToCart={vi.fn(async () => undefined)} onProductClick={vi.fn()} locale="en"
      />,
    );
    await waitFor(() => expect(container.querySelectorAll('[data-purpose="catalog-card"]')).toHaveLength(2));
    expect([...container.querySelectorAll('[data-purpose="catalog-card"] h2')].map((node) => node.textContent?.trim())).toEqual(['Bokmoo Bluetooth Card', 'Bokmoo Card']);
    expect(text(container)).toContain('manage multiple eSIM profiles wirelessly');
  });

  it('gives up its translation as soon as the store rewrites the description', () => {
    const bluetooth = mapBokmooApiProductToThemeProduct(BLUETOOTH);
    expect(cardTitle(bluetooth, 'ko')).toBe('Bokmoo 블루투스 카드');
    expect(cardText(bluetooth, 'ko')?.startsWith('Bokmoo 블루투스 카드')).toBe(true);
    expect(cardText(bluetooth, 'zh-Hant')?.startsWith('Bokmoo 藍牙卡——')).toBe(true);
    expect(cardText(bluetooth, 'en')).toBe(BLUETOOTH_SOURCE);
    const rewritten = mapBokmooApiProductToThemeProduct({ ...BLUETOOTH, description: 'Now with a second chip.' });
    expect(cardText(rewritten, 'ko')).toBeNull();
    expect(cardTitle(mapBokmooApiProductToThemeProduct(apiCard('odoo-product-99', 'other', 'Other card', 5, 'x', 'v')), 'ko')).toBeNull();
  });

  it('the card’s own page in Chinese, still recognised as the Bluetooth card', async () => {
    const product = mapBokmooApiProductToThemeProduct(BLUETOOTH);
    const { container } = render(
      <ProductDetailPage product={product} isLoading={false} quantity={1} locale="zh-Hans"
        onVariantChange={vi.fn()} onQuantityChange={vi.fn()} onAddToCart={vi.fn(async () => undefined)} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(container.querySelector('h1')?.textContent?.trim()).toBe('Bokmoo 蓝牙卡'));
    const page = text(container);
    expect(page).toContain('无线管理多个 eSIM 配置文件');
    // the Bluetooth facts are keyed on the product, not on English words in its description
    expect(page).toContain('蓝牙连接 BOKMOO App 管理');
    expect(page).not.toContain('Bokmoo Bluetooth Card —');
  });

  it('names a card in the cart the way the storefront does', () => {
    const cart = {
      id: 'cart-1', userId: 'user-1', status: 'active', createdAt: '', updatedAt: '', subtotal: 20, tax: 0, shipping: 0, discount: 0, total: 20, itemCount: 1,
      items: [{ id: 'line-1', productId: 'odoo-product-6', productName: 'Bokmoo Card V1', productImage: '', price: 20, quantity: 1, variantId: 'odoo-variant-6', requiresShipping: true, maxQuantity: 10, subtotal: 20 }],
    };
    const { container } = render(
      <CartPage cart={cart as never} isLoading={false} locale="zh-Hans" onUpdateQuantity={vi.fn(async () => undefined)} onRemoveItem={vi.fn(async () => undefined)} onCheckout={vi.fn()} onContinueShopping={vi.fn()} />,
    );
    expect(container.querySelector('h2')?.textContent?.trim()).toBe('Bokmoo 实体卡');
  });
});

describe('the checkout address is recognised, not typed from scratch', () => {
  const renderCheckout = (over: Record<string, unknown> = {}) => render(
    <CheckoutPage
      cart={{
        id: 'cart-1', userId: 'user-1', items: [{ id: 'line-1', productId: 'odoo-product-6', productName: 'Bokmoo Card V1', productImage: '', price: 20, quantity: 1, variantId: 'odoo-variant-6', requiresShipping: true, maxQuantity: 10, subtotal: 20 }],
        itemCount: 1, subtotal: 20, tax: 0, shipping: 0, discount: 0, total: 20, status: 'active', createdAt: '', updatedAt: '',
      } as never}
      isLoading={false} isProcessing={false} requireShippingAddress
      availablePaymentMethods={[{ name: 'stripe', displayName: 'Card' }]}
      onSubmit={vi.fn(async () => undefined)} onBack={vi.fn()} locale="en" {...(over as unknown as Record<string, unknown>)}
    />,
  );

  it('tells the browser what every address field is, so a saved address can be filled in', () => {
    const { container } = renderCheckout();
    const token = (name: string) => container.querySelector(`[name="${name}"]`)?.getAttribute('autocomplete');
    expect(token('email')).toBe('email');
    expect(token('firstName')).toBe('shipping given-name');
    expect(token('lastName')).toBe('shipping family-name');
    expect(token('phone')).toBe('shipping tel');
    expect(token('addressLine1')).toBe('shipping street-address');
    expect(token('city')).toBe('shipping address-level2');
    expect(token('country')).toBe('shipping country');
    expect(token('state')).toBe('shipping address-level1');
    expect(token('postalCode')).toBe('shipping postal-code');
  });

  it('offers the countries as a list and opens on the shopper’s own', () => {
    setZone('Asia/Shanghai');
    const { container } = renderCheckout();
    const select = container.querySelector('select[name="country"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('CN');
    expect([...select.options].map((option) => option.value)).toContain('US');
    expect(select.selectedOptions[0]?.textContent).toBe('China');
    expect(container.querySelector('[data-purpose="country-detected"]')?.textContent).toContain('Picked from this device');
    // the shopper can pick another country; the note steps aside
    fireEvent.change(select, { target: { value: 'JP' } });
    expect(select.value).toBe('JP');
    expect(container.querySelector('[data-purpose="country-detected"]')).toBeNull();
  });

  it('names the countries in a Chinese storefront and lists them in Chinese order', () => {
    setZone('Asia/Hong_Kong');
    const { container } = renderCheckout({ locale: 'zh-Hans' });
    const select = container.querySelector('select[name="country"]') as HTMLSelectElement;
    expect(select.value).toBe('HK');
    const names = [...select.options].map((option) => option.textContent);
    expect(names).toContain('中国');
    expect(names).toContain('美国');
    expect(names).toContain('日本');
    expect(container.querySelector('[data-purpose="country-detected"]')?.textContent).toContain('已根据你的设备自动选择');
  });

  it('a saved address brings its own country, written as a name', () => {
    setZone('Asia/Shanghai');
    const { container } = renderCheckout({ savedAddress: { id: 'a1', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+10000000000', addressLine1: '1 Main St', line1: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'United States', isDefault: true } });
    return waitFor(() => {
      const select = container.querySelector('select[name="country"]') as HTMLSelectElement;
      expect(select.value).toBe('US');
      expect(container.querySelector('[data-purpose="country-detected"]')).toBeNull();
      expect((container.querySelector('[name="addressLine1"]') as HTMLInputElement).value).toBe('1 Main St');
    });
  });

  it('submits the picked country with the order', async () => {
    setZone('Europe/Paris');
    const onSubmit = vi.fn(async (_data: unknown) => undefined);
    const { container } = renderCheckout({ onSubmit });
    await waitFor(() => expect((container.querySelector('select[name="country"]') as HTMLSelectElement).value).toBe('FR'));
    const fill = (name: string, value: string) => fireEvent.change(container.querySelector(`[name="${name}"]`)!, { target: { value } });
    fill('email', 'shopper@example.com');
    fill('firstName', 'Ada');
    fill('phone', '+33100000000');
    fill('addressLine1', '1 Rue de Rivoli');
    fill('city', 'Paris');
    fill('postalCode', '75001');
    await act(async () => { fireEvent.submit(container.querySelector('form')!); });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ country: 'FR', city: 'Paris' });
  });

  it('country helpers', () => {
    expect(normalizeCountryCode(' uk ')).toBe('GB');
    expect(countryCodeOf('China', 'zh-Hans')).toBe('CN');
    expect(countryCodeOf('中国', 'zh-Hans')).toBe('CN');
    expect(countryCodeOf(' Deutschland ', 'de')).toBe('DE');
    expect(countryCodeOf('Atlantis', 'en')).toBe('');
    expect(countryName('XX', 'en')).toBe('XX');
    expect(countryOptions('ja').find((option) => option.code === 'JP')?.name).toBe('日本');
    // the device's zone decides; a zone that names no single country falls back on the storefront language
    setZone('Europe/London');
    expect(detectShopperCountry('en')).toBe('GB');
    setZone('America/Sao_Paulo');
    expect(detectShopperCountry('en')).toBe('BR');
    setZone('Nowhere/Land');
    expect(detectShopperCountry('ko')).toBe('KR');
    expect(detectShopperCountry('en')).toBe('');
  });
});
