'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MultilingualEditor, MultilingualInput, MultilingualTextarea } from '../../components/i18n/multilingual-editor';
import { useI18n } from '../../lib/i18n';
import { Save, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface ProductData {
  name: { [key: string]: string };
  description: { [key: string]: string };
  shortDescription: { [key: string]: string };
  features: { [key: string]: string };
  metaTitle: { [key: string]: string };
  metaDescription: { [key: string]: string };
}

export default function TestMultilingualPage() {
  const { t } = useI18n();
  const [productData, setProductData] = useState<ProductData>({
    name: {
      'zh-CN': '智能手机 Pro Max',
      'en-US': 'Smartphone Pro Max',
    },
    description: {
      'zh-CN': '这是一款功能强大的智能手机，配备最新的处理器和高清摄像头。',
      'en-US': 'This is a powerful smartphone with the latest processor and high-definition camera.',
    },
    shortDescription: {
      'zh-CN': '高性能智能手机',
      'en-US': 'High-performance smartphone',
    },
    features: {
      'zh-CN': '• 6.7英寸OLED显示屏\n• 128GB存储空间\n• 三摄像头系统\n• 5G网络支持',
      'en-US': '• 6.7-inch OLED display\n• 128GB storage\n• Triple camera system\n• 5G network support',
    },
    metaTitle: {
      'zh-CN': '智能手机 Pro Max - 高性能手机',
      'en-US': 'Smartphone Pro Max - High Performance Phone',
    },
    metaDescription: {
      'zh-CN': '购买最新的智能手机 Pro Max，享受卓越的性能和拍照体验。',
      'en-US': 'Buy the latest Smartphone Pro Max and enjoy exceptional performance and photography experience.',
    },
  });

  const [showPreview, setShowPreview] = useState(false);

  const handleSave = () => {
    // 验证必填字段
    const hasName = Object.values(productData.name).some(v => v.trim());
    const hasDescription = Object.values(productData.description).some(v => v.trim());

    if (!hasName || !hasDescription) {
      toast.error(t('multilingual.validation_failed', 'Please fill in required fields'));
      return;
    }

    // 模拟保存
    toast.success(t('multilingual.saved_successfully', 'Product saved successfully'));
  };

  const updateField = (field: keyof ProductData, value: { [key: string]: string }) => {
    setProductData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('multilingual.product_editor', 'Multilingual Product Editor')}
          </h1>
          <p className="text-muted-foreground">
            {t('multilingual.product_editor_desc', 'Edit product information in multiple languages')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? t('common.hide_preview', 'Hide Preview') : t('common.show_preview', 'Show Preview')}
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {t('common.save', 'Save')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 编辑表单 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('multilingual.basic_info', 'Basic Information')}</CardTitle>
              <CardDescription>
                {t('multilingual.basic_info_desc', 'Essential product information')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <MultilingualInput
                label={t('multilingual.product_name', 'Product Name')}
                value={productData.name}
                onChange={(value) => updateField('name', value)}
                placeholder={t('multilingual.enter_product_name', 'Enter product name...')}
                required
              />

              <MultilingualInput
                label={t('multilingual.short_description', 'Short Description')}
                value={productData.shortDescription}
                onChange={(value) => updateField('shortDescription', value)}
                placeholder={t('multilingual.enter_short_desc', 'Enter short description...')}
              />

              <MultilingualTextarea
                label={t('multilingual.description', 'Description')}
                value={productData.description}
                onChange={(value) => updateField('description', value)}
                placeholder={t('multilingual.enter_description', 'Enter detailed description...')}
                required
              />

              <MultilingualTextarea
                label={t('multilingual.features', 'Features')}
                value={productData.features}
                onChange={(value) => updateField('features', value)}
                placeholder={t('multilingual.enter_features', 'Enter product features...')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('multilingual.seo_info', 'SEO Information')}</CardTitle>
              <CardDescription>
                {t('multilingual.seo_info_desc', 'Search engine optimization content')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <MultilingualEditor
                label={t('multilingual.meta_title', 'Meta Title')}
                value={productData.metaTitle}
                onChange={(value) => updateField('metaTitle', value)}
                placeholder={t('multilingual.enter_meta_title', 'Enter meta title...')}
                maxLength={60}
              />

              <MultilingualEditor
                label={t('multilingual.meta_description', 'Meta Description')}
                value={productData.metaDescription}
                onChange={(value) => updateField('metaDescription', value)}
                type="textarea"
                placeholder={t('multilingual.enter_meta_desc', 'Enter meta description...')}
                maxLength={160}
              />
            </CardContent>
          </Card>
        </div>

        {/* 预览面板 */}
        {showPreview && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('multilingual.preview', 'Preview')}</CardTitle>
                <CardDescription>
                  {t('multilingual.preview_desc', 'Preview how the content will appear')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(productData.name).map(([lang, name]) => (
                  name && (
                    <div key={lang} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium bg-muted px-2 py-1 rounded">
                          {lang}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">{name}</h3>
                        
                        {productData.shortDescription[lang] && (
                          <p className="text-muted-foreground">
                            {productData.shortDescription[lang]}
                          </p>
                        )}
                        
                        {productData.description[lang] && (
                          <p className="text-sm">
                            {productData.description[lang]}
                          </p>
                        )}
                        
                        {productData.features[lang] && (
                          <div className="text-sm">
                            <strong>{t('multilingual.features', 'Features')}:</strong>
                            <pre className="mt-1 whitespace-pre-wrap font-sans">
                              {productData.features[lang]}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('multilingual.seo_preview', 'SEO Preview')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(productData.metaTitle).map(([lang, title]) => (
                  title && (
                    <div key={lang} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium bg-muted px-2 py-1 rounded">
                          {lang}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-blue-600 text-lg hover:underline cursor-pointer">
                          {title}
                        </h4>
                        <p className="text-green-600 text-sm">
                          https://example.com/products/smartphone-pro-max
                        </p>
                        {productData.metaDescription[lang] && (
                          <p className="text-gray-600 text-sm">
                            {productData.metaDescription[lang]}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">
            {t('multilingual.usage_tips', 'Usage Tips')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 space-y-2">
          <p>• {t('multilingual.tip_1', 'Use the Copy button to duplicate content to empty languages')}</p>
          <p>• {t('multilingual.tip_2', 'Use the Translate button for automatic translation (demo only)')}</p>
          <p>• {t('multilingual.tip_3', 'Required fields must be filled in at least one language')}</p>
          <p>• {t('multilingual.tip_4', 'Character limits are enforced for SEO fields')}</p>
          <p>• {t('multilingual.tip_5', 'Green dots indicate completed languages')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
