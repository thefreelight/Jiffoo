import { prisma } from '@/config/database';
import { SupportedLanguage, TranslationNamespace } from './types';

interface SeedTranslation {
  key: string;
  namespace: string;
  translations: Record<SupportedLanguage, string>;
  description?: string;
  context?: string;
}

const seedData: SeedTranslation[] = [
  // 通用翻译
  {
    key: 'save',
    namespace: TranslationNamespace.COMMON,
    description: '保存按钮文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '保存',
      [SupportedLanguage.ZH_TW]: '儲存',
      [SupportedLanguage.EN_US]: 'Save',
      [SupportedLanguage.EN_GB]: 'Save',
      [SupportedLanguage.JA_JP]: '保存',
      [SupportedLanguage.KO_KR]: '저장',
      [SupportedLanguage.ES_ES]: 'Guardar',
      [SupportedLanguage.FR_FR]: 'Enregistrer',
      [SupportedLanguage.DE_DE]: 'Speichern',
      [SupportedLanguage.IT_IT]: 'Salva',
      [SupportedLanguage.PT_BR]: 'Salvar',
      [SupportedLanguage.RU_RU]: 'Сохранить',
      [SupportedLanguage.AR_SA]: 'حفظ',
      [SupportedLanguage.TH_TH]: 'บันทึก',
      [SupportedLanguage.VI_VN]: 'Lưu'
    }
  },
  {
    key: 'cancel',
    namespace: TranslationNamespace.COMMON,
    description: '取消按钮文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '取消',
      [SupportedLanguage.ZH_TW]: '取消',
      [SupportedLanguage.EN_US]: 'Cancel',
      [SupportedLanguage.EN_GB]: 'Cancel',
      [SupportedLanguage.JA_JP]: 'キャンセル',
      [SupportedLanguage.KO_KR]: '취소',
      [SupportedLanguage.ES_ES]: 'Cancelar',
      [SupportedLanguage.FR_FR]: 'Annuler',
      [SupportedLanguage.DE_DE]: 'Abbrechen',
      [SupportedLanguage.IT_IT]: 'Annulla',
      [SupportedLanguage.PT_BR]: 'Cancelar',
      [SupportedLanguage.RU_RU]: 'Отмена',
      [SupportedLanguage.AR_SA]: 'إلغاء',
      [SupportedLanguage.TH_TH]: 'ยกเลิก',
      [SupportedLanguage.VI_VN]: 'Hủy'
    }
  },
  {
    key: 'delete',
    namespace: TranslationNamespace.COMMON,
    description: '删除按钮文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '删除',
      [SupportedLanguage.ZH_TW]: '刪除',
      [SupportedLanguage.EN_US]: 'Delete',
      [SupportedLanguage.EN_GB]: 'Delete',
      [SupportedLanguage.JA_JP]: '削除',
      [SupportedLanguage.KO_KR]: '삭제',
      [SupportedLanguage.ES_ES]: 'Eliminar',
      [SupportedLanguage.FR_FR]: 'Supprimer',
      [SupportedLanguage.DE_DE]: 'Löschen',
      [SupportedLanguage.IT_IT]: 'Elimina',
      [SupportedLanguage.PT_BR]: 'Excluir',
      [SupportedLanguage.RU_RU]: 'Удалить',
      [SupportedLanguage.AR_SA]: 'حذف',
      [SupportedLanguage.TH_TH]: 'ลบ',
      [SupportedLanguage.VI_VN]: 'Xóa'
    }
  },
  {
    key: 'search',
    namespace: TranslationNamespace.COMMON,
    description: '搜索功能文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '搜索',
      [SupportedLanguage.ZH_TW]: '搜尋',
      [SupportedLanguage.EN_US]: 'Search',
      [SupportedLanguage.EN_GB]: 'Search',
      [SupportedLanguage.JA_JP]: '検索',
      [SupportedLanguage.KO_KR]: '검색',
      [SupportedLanguage.ES_ES]: 'Buscar',
      [SupportedLanguage.FR_FR]: 'Rechercher',
      [SupportedLanguage.DE_DE]: 'Suchen',
      [SupportedLanguage.IT_IT]: 'Cerca',
      [SupportedLanguage.PT_BR]: 'Pesquisar',
      [SupportedLanguage.RU_RU]: 'Поиск',
      [SupportedLanguage.AR_SA]: 'بحث',
      [SupportedLanguage.TH_TH]: 'ค้นหา',
      [SupportedLanguage.VI_VN]: 'Tìm kiếm'
    }
  },
  {
    key: 'loading',
    namespace: TranslationNamespace.COMMON,
    description: '加载状态文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '加载中...',
      [SupportedLanguage.ZH_TW]: '載入中...',
      [SupportedLanguage.EN_US]: 'Loading...',
      [SupportedLanguage.EN_GB]: 'Loading...',
      [SupportedLanguage.JA_JP]: '読み込み中...',
      [SupportedLanguage.KO_KR]: '로딩 중...',
      [SupportedLanguage.ES_ES]: 'Cargando...',
      [SupportedLanguage.FR_FR]: 'Chargement...',
      [SupportedLanguage.DE_DE]: 'Laden...',
      [SupportedLanguage.IT_IT]: 'Caricamento...',
      [SupportedLanguage.PT_BR]: 'Carregando...',
      [SupportedLanguage.RU_RU]: 'Загрузка...',
      [SupportedLanguage.AR_SA]: 'جاري التحميل...',
      [SupportedLanguage.TH_TH]: 'กำลังโหลด...',
      [SupportedLanguage.VI_VN]: 'Đang tải...'
    }
  },

  // 认证相关
  {
    key: 'login',
    namespace: TranslationNamespace.AUTH,
    description: '登录按钮文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '登录',
      [SupportedLanguage.ZH_TW]: '登入',
      [SupportedLanguage.EN_US]: 'Login',
      [SupportedLanguage.EN_GB]: 'Login',
      [SupportedLanguage.JA_JP]: 'ログイン',
      [SupportedLanguage.KO_KR]: '로그인',
      [SupportedLanguage.ES_ES]: 'Iniciar sesión',
      [SupportedLanguage.FR_FR]: 'Se connecter',
      [SupportedLanguage.DE_DE]: 'Anmelden',
      [SupportedLanguage.IT_IT]: 'Accedi',
      [SupportedLanguage.PT_BR]: 'Entrar',
      [SupportedLanguage.RU_RU]: 'Войти',
      [SupportedLanguage.AR_SA]: 'تسجيل الدخول',
      [SupportedLanguage.TH_TH]: 'เข้าสู่ระบบ',
      [SupportedLanguage.VI_VN]: 'Đăng nhập'
    }
  },
  {
    key: 'register',
    namespace: TranslationNamespace.AUTH,
    description: '注册按钮文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '注册',
      [SupportedLanguage.ZH_TW]: '註冊',
      [SupportedLanguage.EN_US]: 'Register',
      [SupportedLanguage.EN_GB]: 'Register',
      [SupportedLanguage.JA_JP]: '登録',
      [SupportedLanguage.KO_KR]: '회원가입',
      [SupportedLanguage.ES_ES]: 'Registrarse',
      [SupportedLanguage.FR_FR]: "S'inscrire",
      [SupportedLanguage.DE_DE]: 'Registrieren',
      [SupportedLanguage.IT_IT]: 'Registrati',
      [SupportedLanguage.PT_BR]: 'Registrar',
      [SupportedLanguage.RU_RU]: 'Регистрация',
      [SupportedLanguage.AR_SA]: 'التسجيل',
      [SupportedLanguage.TH_TH]: 'สมัครสมาชิก',
      [SupportedLanguage.VI_VN]: 'Đăng ký'
    }
  },
  {
    key: 'logout',
    namespace: TranslationNamespace.AUTH,
    description: '退出登录文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '退出登录',
      [SupportedLanguage.ZH_TW]: '登出',
      [SupportedLanguage.EN_US]: 'Logout',
      [SupportedLanguage.EN_GB]: 'Logout',
      [SupportedLanguage.JA_JP]: 'ログアウト',
      [SupportedLanguage.KO_KR]: '로그아웃',
      [SupportedLanguage.ES_ES]: 'Cerrar sesión',
      [SupportedLanguage.FR_FR]: 'Se déconnecter',
      [SupportedLanguage.DE_DE]: 'Abmelden',
      [SupportedLanguage.IT_IT]: 'Esci',
      [SupportedLanguage.PT_BR]: 'Sair',
      [SupportedLanguage.RU_RU]: 'Выйти',
      [SupportedLanguage.AR_SA]: 'تسجيل الخروج',
      [SupportedLanguage.TH_TH]: 'ออกจากระบบ',
      [SupportedLanguage.VI_VN]: 'Đăng xuất'
    }
  },

  // 商品相关
  {
    key: 'product',
    namespace: TranslationNamespace.PRODUCT,
    description: '商品文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '商品',
      [SupportedLanguage.ZH_TW]: '商品',
      [SupportedLanguage.EN_US]: 'Product',
      [SupportedLanguage.EN_GB]: 'Product',
      [SupportedLanguage.JA_JP]: '商品',
      [SupportedLanguage.KO_KR]: '상품',
      [SupportedLanguage.ES_ES]: 'Producto',
      [SupportedLanguage.FR_FR]: 'Produit',
      [SupportedLanguage.DE_DE]: 'Produkt',
      [SupportedLanguage.IT_IT]: 'Prodotto',
      [SupportedLanguage.PT_BR]: 'Produto',
      [SupportedLanguage.RU_RU]: 'Товар',
      [SupportedLanguage.AR_SA]: 'منتج',
      [SupportedLanguage.TH_TH]: 'สินค้า',
      [SupportedLanguage.VI_VN]: 'Sản phẩm'
    }
  },
  {
    key: 'price',
    namespace: TranslationNamespace.PRODUCT,
    description: '价格文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '价格',
      [SupportedLanguage.ZH_TW]: '價格',
      [SupportedLanguage.EN_US]: 'Price',
      [SupportedLanguage.EN_GB]: 'Price',
      [SupportedLanguage.JA_JP]: '価格',
      [SupportedLanguage.KO_KR]: '가격',
      [SupportedLanguage.ES_ES]: 'Precio',
      [SupportedLanguage.FR_FR]: 'Prix',
      [SupportedLanguage.DE_DE]: 'Preis',
      [SupportedLanguage.IT_IT]: 'Prezzo',
      [SupportedLanguage.PT_BR]: 'Preço',
      [SupportedLanguage.RU_RU]: 'Цена',
      [SupportedLanguage.AR_SA]: 'السعر',
      [SupportedLanguage.TH_TH]: 'ราคา',
      [SupportedLanguage.VI_VN]: 'Giá'
    }
  },
  {
    key: 'add_to_cart',
    namespace: TranslationNamespace.PRODUCT,
    description: '添加到购物车按钮',
    translations: {
      [SupportedLanguage.ZH_CN]: '加入购物车',
      [SupportedLanguage.ZH_TW]: '加入購物車',
      [SupportedLanguage.EN_US]: 'Add to Cart',
      [SupportedLanguage.EN_GB]: 'Add to Basket',
      [SupportedLanguage.JA_JP]: 'カートに追加',
      [SupportedLanguage.KO_KR]: '장바구니에 추가',
      [SupportedLanguage.ES_ES]: 'Añadir al carrito',
      [SupportedLanguage.FR_FR]: 'Ajouter au panier',
      [SupportedLanguage.DE_DE]: 'In den Warenkorb',
      [SupportedLanguage.IT_IT]: 'Aggiungi al carrello',
      [SupportedLanguage.PT_BR]: 'Adicionar ao carrinho',
      [SupportedLanguage.RU_RU]: 'Добавить в корзину',
      [SupportedLanguage.AR_SA]: 'أضف إلى السلة',
      [SupportedLanguage.TH_TH]: 'เพิ่มลงตะกร้า',
      [SupportedLanguage.VI_VN]: 'Thêm vào giỏ'
    }
  },

  // 订单相关
  {
    key: 'order',
    namespace: TranslationNamespace.ORDER,
    description: '订单文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '订单',
      [SupportedLanguage.ZH_TW]: '訂單',
      [SupportedLanguage.EN_US]: 'Order',
      [SupportedLanguage.EN_GB]: 'Order',
      [SupportedLanguage.JA_JP]: '注文',
      [SupportedLanguage.KO_KR]: '주문',
      [SupportedLanguage.ES_ES]: 'Pedido',
      [SupportedLanguage.FR_FR]: 'Commande',
      [SupportedLanguage.DE_DE]: 'Bestellung',
      [SupportedLanguage.IT_IT]: 'Ordine',
      [SupportedLanguage.PT_BR]: 'Pedido',
      [SupportedLanguage.RU_RU]: 'Заказ',
      [SupportedLanguage.AR_SA]: 'طلب',
      [SupportedLanguage.TH_TH]: 'คำสั่งซื้อ',
      [SupportedLanguage.VI_VN]: 'Đơn hàng'
    }
  },
  {
    key: 'order_status',
    namespace: TranslationNamespace.ORDER,
    description: '订单状态文本',
    translations: {
      [SupportedLanguage.ZH_CN]: '订单状态',
      [SupportedLanguage.ZH_TW]: '訂單狀態',
      [SupportedLanguage.EN_US]: 'Order Status',
      [SupportedLanguage.EN_GB]: 'Order Status',
      [SupportedLanguage.JA_JP]: '注文状況',
      [SupportedLanguage.KO_KR]: '주문 상태',
      [SupportedLanguage.ES_ES]: 'Estado del pedido',
      [SupportedLanguage.FR_FR]: 'Statut de la commande',
      [SupportedLanguage.DE_DE]: 'Bestellstatus',
      [SupportedLanguage.IT_IT]: 'Stato ordine',
      [SupportedLanguage.PT_BR]: 'Status do pedido',
      [SupportedLanguage.RU_RU]: 'Статус заказа',
      [SupportedLanguage.AR_SA]: 'حالة الطلب',
      [SupportedLanguage.TH_TH]: 'สถานะคำสั่งซื้อ',
      [SupportedLanguage.VI_VN]: 'Trạng thái đơn hàng'
    }
  },

  // 错误消息
  {
    key: 'required_field',
    namespace: TranslationNamespace.VALIDATION,
    description: '必填字段错误',
    translations: {
      [SupportedLanguage.ZH_CN]: '此字段为必填项',
      [SupportedLanguage.ZH_TW]: '此欄位為必填項',
      [SupportedLanguage.EN_US]: 'This field is required',
      [SupportedLanguage.EN_GB]: 'This field is required',
      [SupportedLanguage.JA_JP]: 'この項目は必須です',
      [SupportedLanguage.KO_KR]: '이 필드는 필수입니다',
      [SupportedLanguage.ES_ES]: 'Este campo es obligatorio',
      [SupportedLanguage.FR_FR]: 'Ce champ est obligatoire',
      [SupportedLanguage.DE_DE]: 'Dieses Feld ist erforderlich',
      [SupportedLanguage.IT_IT]: 'Questo campo è obbligatorio',
      [SupportedLanguage.PT_BR]: 'Este campo é obrigatório',
      [SupportedLanguage.RU_RU]: 'Это поле обязательно',
      [SupportedLanguage.AR_SA]: 'هذا الحقل مطلوب',
      [SupportedLanguage.TH_TH]: 'ฟิลด์นี้จำเป็น',
      [SupportedLanguage.VI_VN]: 'Trường này là bắt buộc'
    }
  },
  {
    key: 'invalid_email',
    namespace: TranslationNamespace.VALIDATION,
    description: '无效邮箱错误',
    translations: {
      [SupportedLanguage.ZH_CN]: '请输入有效的邮箱地址',
      [SupportedLanguage.ZH_TW]: '請輸入有效的電子郵件地址',
      [SupportedLanguage.EN_US]: 'Please enter a valid email address',
      [SupportedLanguage.EN_GB]: 'Please enter a valid email address',
      [SupportedLanguage.JA_JP]: '有効なメールアドレスを入力してください',
      [SupportedLanguage.KO_KR]: '유효한 이메일 주소를 입력하세요',
      [SupportedLanguage.ES_ES]: 'Ingrese una dirección de correo válida',
      [SupportedLanguage.FR_FR]: 'Veuillez saisir une adresse email valide',
      [SupportedLanguage.DE_DE]: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
      [SupportedLanguage.IT_IT]: 'Inserisci un indirizzo email valido',
      [SupportedLanguage.PT_BR]: 'Digite um endereço de email válido',
      [SupportedLanguage.RU_RU]: 'Введите действительный адрес электронной почты',
      [SupportedLanguage.AR_SA]: 'يرجى إدخال عنوان بريد إلكتروني صحيح',
      [SupportedLanguage.TH_TH]: 'กรุณาใส่อีเมลที่ถูกต้อง',
      [SupportedLanguage.VI_VN]: 'Vui lòng nhập địa chỉ email hợp lệ'
    }
  }
];

export async function seedTranslations() {
  console.log('🌍 Starting translation seeding...');

  for (const item of seedData) {
    // 创建或更新翻译键
    const translationKey = await prisma.translationKey.upsert({
      where: {
        key_namespace: {
          key: item.key,
          namespace: item.namespace
        }
      },
      update: {
        description: item.description,
        context: item.context
      },
      create: {
        key: item.key,
        namespace: item.namespace,
        description: item.description,
        context: item.context
      }
    });

    // 为每种语言创建翻译
    for (const [language, value] of Object.entries(item.translations)) {
      if (value) {
        await prisma.translation.upsert({
          where: {
            key_namespace_language: {
              key: item.key,
              namespace: item.namespace,
              language: language as SupportedLanguage
            }
          },
          update: {
            value,
            isApproved: true
          },
          create: {
            key: item.key,
            namespace: item.namespace,
            language: language as SupportedLanguage,
            value,
            isApproved: true
          }
        });
      }
    }

    console.log(`✅ Seeded translations for key: ${item.namespace}.${item.key}`);
  }

  console.log('🎉 Translation seeding completed!');
}

// 如果直接运行此文件，则执行种子数据
if (require.main === module) {
  seedTranslations()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
