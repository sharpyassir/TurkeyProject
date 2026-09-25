/** Minimal i18n: three launch languages, Arabic is RTL. Strings live here until we adopt next-intl. */
export type Locale = 'en' | 'tr' | 'ar';

export const RTL: Record<Locale, boolean> = { en: false, tr: false, ar: true };

const dict = {
  en: {
    products: 'Products', servers: 'Servers', create: 'Create server', apps: 'Marketplace', billing: 'Billing', agents: 'Agents', signOut: 'Sign out',
    name: 'Name', size: 'Size', image: 'Image', region: 'Region', status: 'Status', ip: 'Public IP', created: 'Created',
    noServers: 'No servers yet. Create your first one. It takes about a minute.',
    creating: 'Creating…', deploy: 'Deploy', perMonth: '/mo', perHour: '/hr',
    login: 'Sign in', email: 'Email', password: 'Password', signup: 'Create account', teamName: 'Team name',
    balance: 'Credit balance', mtd: 'Month to date', actions: 'Actions', stop: 'Stop', start: 'Start', reboot: 'Reboot', delete: 'Delete',
    confirmDelete: 'Delete this server? This cannot be undone.', oneClick: 'One-click apps', distributions: 'Distributions',
    comingSoon: 'Coming soon', interest: 'Notify me when this launches', interested: 'Thanks. We will let you know.',
    agentTokens: 'Agent tokens', newAgentToken: 'Create agent token', spendCap: 'Monthly spend cap', requireApproval: 'Require human approval for',
    scopes: 'Scopes', tokenShownOnce: 'Copy this token now. It is shown only once.', revoke: 'Revoke',
    firewalls: 'Firewalls', rules: 'rules', attachedServers: 'servers', newFirewall: 'Create firewall',
    snapshots: 'Snapshots', publicIps: 'Public IPs', webhooks: 'Webhooks', newWebhook: 'Add webhook', events: 'Events', url: 'URL',
  },
  tr: {
    products: 'Ürünler', servers: 'Sunucular', create: 'Sunucu oluştur', apps: 'Uygulama Mağazası', billing: 'Faturalama', agents: 'Ajanlar', signOut: 'Çıkış',
    name: 'Ad', size: 'Boyut', image: 'İmaj', region: 'Bölge', status: 'Durum', ip: 'Genel IP', created: 'Oluşturulma',
    noServers: 'Henüz sunucu yok. İlk sunucunu oluştur. Yaklaşık bir dakika sürer.',
    creating: 'Oluşturuluyor…', deploy: 'Kur', perMonth: '/ay', perHour: '/saat',
    login: 'Giriş yap', email: 'E-posta', password: 'Şifre', signup: 'Hesap oluştur', teamName: 'Takım adı',
    balance: 'Kredi bakiyesi', mtd: 'Bu ay', actions: 'İşlemler', stop: 'Durdur', start: 'Başlat', reboot: 'Yeniden başlat', delete: 'Sil',
    confirmDelete: 'Bu sunucu silinsin mi? Geri alınamaz.', oneClick: 'Tek tıkla uygulamalar', distributions: 'Dağıtımlar',
    comingSoon: 'Çok yakında', interest: 'Yayınlanınca haber ver', interested: 'Teşekkürler. Haber vereceğiz.',
    agentTokens: 'Ajan tokenları', newAgentToken: 'Ajan tokenı oluştur', spendCap: 'Aylık harcama limiti', requireApproval: 'İnsan onayı gerektir',
    scopes: 'Yetkiler', tokenShownOnce: 'Bu tokenı şimdi kopyala. Yalnızca bir kez gösterilir.', revoke: 'İptal et',
    firewalls: 'Güvenlik duvarları', rules: 'kural', attachedServers: 'sunucu', newFirewall: 'Güvenlik duvarı oluştur',
    snapshots: 'Anlık görüntüler', publicIps: 'Genel IP’ler', webhooks: 'Webhook’lar', newWebhook: 'Webhook ekle', events: 'Olaylar', url: 'URL',
  },
  ar: {
    products: 'المنتجات', servers: 'الخوادم', create: 'إنشاء خادم', apps: 'المتجر', billing: 'الفوترة', agents: 'الوكلاء', signOut: 'تسجيل الخروج',
    name: 'الاسم', size: 'الحجم', image: 'الصورة', region: 'المنطقة', status: 'الحالة', ip: 'IP عام', created: 'تاريخ الإنشاء',
    noServers: 'لا توجد خوادم بعد. أنشئ أول خادم. يستغرق حوالي دقيقة.',
    creating: 'جارٍ الإنشاء…', deploy: 'نشر', perMonth: '/شهر', perHour: '/ساعة',
    login: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور', signup: 'إنشاء حساب', teamName: 'اسم الفريق',
    balance: 'الرصيد', mtd: 'هذا الشهر', actions: 'إجراءات', stop: 'إيقاف', start: 'تشغيل', reboot: 'إعادة تشغيل', delete: 'حذف',
    confirmDelete: 'حذف هذا الخادم؟ لا يمكن التراجع.', oneClick: 'تطبيقات بنقرة واحدة', distributions: 'التوزيعات',
    comingSoon: 'قريبًا', interest: 'أعلمني عند الإطلاق', interested: 'شكرًا. سنعلمك.',
    agentTokens: 'رموز الوكلاء', newAgentToken: 'إنشاء رمز وكيل', spendCap: 'حد الإنفاق الشهري', requireApproval: 'يتطلب موافقة بشرية لـ',
    scopes: 'الصلاحيات', tokenShownOnce: 'انسخ هذا الرمز الآن. يُعرض مرة واحدة فقط.', revoke: 'إلغاء',
    firewalls: 'جدران الحماية', rules: 'قواعد', attachedServers: 'خوادم', newFirewall: 'إنشاء جدار حماية',
    snapshots: 'اللقطات', publicIps: 'عناوين IP العامة', webhooks: 'Webhooks', newWebhook: 'إضافة webhook', events: 'الأحداث', url: 'الرابط',
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
