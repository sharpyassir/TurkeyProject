/** Minimal i18n: three launch languages, Arabic is RTL. Strings live here until we adopt next-intl. */
export type Locale = 'en' | 'tr' | 'ar';

export const RTL: Record<Locale, boolean> = { en: false, tr: false, ar: true };

const dict = {
  en: {
    servers: 'Servers', create: 'Create server', apps: 'Marketplace', billing: 'Billing', signOut: 'Sign out',
    name: 'Name', size: 'Size', image: 'Image', region: 'Region', status: 'Status', ip: 'Public IP', created: 'Created',
    noServers: 'No servers yet. Create your first one — it takes about a minute.',
    creating: 'Creating…', deploy: 'Deploy', perMonth: '/mo', perHour: '/hr',
    login: 'Sign in', email: 'Email', password: 'Password', signup: 'Create account', teamName: 'Team name',
    balance: 'Credit balance', mtd: 'Month to date', actions: 'Actions', stop: 'Stop', start: 'Start', reboot: 'Reboot', delete: 'Delete',
    confirmDelete: 'Delete this server? This cannot be undone.', oneClick: 'One-click apps', distributions: 'Distributions',
  },
  tr: {
    servers: 'Sunucular', create: 'Sunucu oluştur', apps: 'Uygulama Mağazası', billing: 'Faturalama', signOut: 'Çıkış',
    name: 'Ad', size: 'Boyut', image: 'İmaj', region: 'Bölge', status: 'Durum', ip: 'Genel IP', created: 'Oluşturulma',
    noServers: 'Henüz sunucu yok. İlk sunucunu oluştur — yaklaşık bir dakika sürer.',
    creating: 'Oluşturuluyor…', deploy: 'Kur', perMonth: '/ay', perHour: '/saat',
    login: 'Giriş yap', email: 'E-posta', password: 'Şifre', signup: 'Hesap oluştur', teamName: 'Takım adı',
    balance: 'Kredi bakiyesi', mtd: 'Bu ay', actions: 'İşlemler', stop: 'Durdur', start: 'Başlat', reboot: 'Yeniden başlat', delete: 'Sil',
    confirmDelete: 'Bu sunucu silinsin mi? Geri alınamaz.', oneClick: 'Tek tıkla uygulamalar', distributions: 'Dağıtımlar',
  },
  ar: {
    servers: 'الخوادم', create: 'إنشاء خادم', apps: 'المتجر', billing: 'الفوترة', signOut: 'تسجيل الخروج',
    name: 'الاسم', size: 'الحجم', image: 'الصورة', region: 'المنطقة', status: 'الحالة', ip: 'IP عام', created: 'تاريخ الإنشاء',
    noServers: 'لا توجد خوادم بعد. أنشئ أول خادم — يستغرق حوالي دقيقة.',
    creating: 'جارٍ الإنشاء…', deploy: 'نشر', perMonth: '/شهر', perHour: '/ساعة',
    login: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور', signup: 'إنشاء حساب', teamName: 'اسم الفريق',
    balance: 'الرصيد', mtd: 'هذا الشهر', actions: 'إجراءات', stop: 'إيقاف', start: 'تشغيل', reboot: 'إعادة تشغيل', delete: 'حذف',
    confirmDelete: 'حذف هذا الخادم؟ لا يمكن التراجع.', oneClick: 'تطبيقات بنقرة واحدة', distributions: 'التوزيعات',
  },
} as const;

export type Key = keyof typeof dict.en;

export function t(locale: Locale, key: Key): string {
  return dict[locale][key] ?? dict.en[key];
}

export function getLocale(): Locale {
  try {
    const l = localStorage.getItem('pgcloud.locale');
    if (l === 'tr' || l === 'ar' || l === 'en') return l;
    const nav = navigator.language.slice(0, 2);
    return nav === 'tr' || nav === 'ar' ? nav : 'en';
  } catch {
    return 'en';
  }
}
