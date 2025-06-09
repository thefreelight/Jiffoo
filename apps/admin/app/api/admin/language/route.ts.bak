import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 支持的语言类型
type SupportedLanguage = 
  | 'zh-CN' 
  | 'en-US' 
  | 'ja-JP' 
  | 'ko-KR' 
  | 'es-ES' 
  | 'fr-FR';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR'
];

// POST - 设置用户语言偏好
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language } = body;

    // 验证语言代码
    if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language code' },
        { status: 400 }
      );
    }

    // 设置语言Cookie（30天过期）
    const cookieStore = await cookies();
    cookieStore.set('admin-language', language, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // 允许客户端访问
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // 这里可以保存到数据库用户偏好设置
    // await saveUserLanguagePreference(userId, language);

    return NextResponse.json({
      success: true,
      language,
      message: 'Language preference saved successfully'
    });

  } catch (error) {
    console.error('Error saving language preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - 获取用户语言偏好
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const savedLanguage = cookieStore.get('admin-language')?.value;

    // 从Accept-Language头获取浏览器偏好
    const acceptLanguage = request.headers.get('accept-language');
    const browserLanguage = detectBrowserLanguage(acceptLanguage);

    return NextResponse.json({
      savedLanguage: savedLanguage || null,
      browserLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      defaultLanguage: 'zh-CN'
    });

  } catch (error) {
    console.error('Error getting language preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 检测浏览器语言偏好
function detectBrowserLanguage(acceptLanguage: string | null): SupportedLanguage | null {
  if (!acceptLanguage) return null;

  // 解析Accept-Language头
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, q = '1'] = lang.trim().split(';q=');
      return {
        code: code.trim(),
        quality: parseFloat(q)
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // 查找支持的语言
  for (const lang of languages) {
    // 精确匹配
    if (SUPPORTED_LANGUAGES.includes(lang.code as SupportedLanguage)) {
      return lang.code as SupportedLanguage;
    }

    // 语言代码匹配（如 zh 匹配 zh-CN）
    const langCode = lang.code.split('-')[0];
    const matchedLang = SUPPORTED_LANGUAGES.find(supported => 
      supported.startsWith(langCode + '-')
    );
    
    if (matchedLang) {
      return matchedLang;
    }
  }

  return null;
}

// PUT - 更新语言设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      language, 
      autoDetect, 
      fallbackLanguage, 
      enabledLanguages,
      rtlSupport,
      dateLocalization,
      numberLocalization 
    } = body;

    // 验证主要语言
    if (language && !SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language code' },
        { status: 400 }
      );
    }

    // 验证后备语言
    if (fallbackLanguage && !SUPPORTED_LANGUAGES.includes(fallbackLanguage)) {
      return NextResponse.json(
        { error: 'Invalid fallback language code' },
        { status: 400 }
      );
    }

    // 验证启用的语言列表
    if (enabledLanguages && !Array.isArray(enabledLanguages)) {
      return NextResponse.json(
        { error: 'Enabled languages must be an array' },
        { status: 400 }
      );
    }

    if (enabledLanguages) {
      for (const lang of enabledLanguages) {
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
          return NextResponse.json(
            { error: `Invalid language code: ${lang}` },
            { status: 400 }
          );
        }
      }
    }

    // 保存设置到Cookie
    const cookieStore = await cookies();
    
    if (language) {
      cookieStore.set('admin-language', language, {
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    // 保存其他设置到Cookie或数据库
    const settings = {
      autoDetect: autoDetect ?? true,
      fallbackLanguage: fallbackLanguage ?? 'en-US',
      enabledLanguages: enabledLanguages ?? SUPPORTED_LANGUAGES,
      rtlSupport: rtlSupport ?? false,
      dateLocalization: dateLocalization ?? true,
      numberLocalization: numberLocalization ?? true,
    };

    cookieStore.set('admin-language-settings', JSON.stringify(settings), {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // 这里可以保存到数据库
    // await saveUserLanguageSettings(userId, settings);

    return NextResponse.json({
      success: true,
      settings,
      message: 'Language settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating language settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
