'use client'

import { useState, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, BookOpen, Brain, Trophy, ArrowRight, Target, Clock, Star, Zap } from 'lucide-react'

/* ترجمة النصوص */
const translations = {
  en: {
    siteName: 'STEP Online',
    pill: 'Professional Test Preparation',
    heroTitleLine1: 'Master the',
    heroTitleLine2: 'STEP English Test',
    heroSubtitle:
      'Experience a real test simulator with detailed explanations for every question. Prepare with confidence and achieve your target score.',
    startJourney: 'Start Your Journey',
    viewPricing: 'View Pricing',
    whyChoose: 'Why Choose Our Platform?',
    whyChooseSub: 'Experience the most comprehensive STEP test preparation',
    features: [
      { title: 'Real Test Simulator', desc: 'Practice with authentic test conditions and interface that mirrors the actual STEP exam' },
      { title: 'Detailed Explanations', desc: 'Understand every question with comprehensive explanations that help you learn from mistakes' },
      { title: 'Track Your Progress', desc: 'Monitor your improvement with detailed analytics and personalized performance insights' }
    ],
    benefitsTitle: 'Everything You Need to Succeed',
    benefitsSubtitle: 'Our platform provides comprehensive tools and resources designed to maximize your STEP test performance.',
    benefitItems: [
      'Accurate test simulation matching real exam conditions',
      'Step-by-step explanations for every answer',
      'Timed practice to improve speed and accuracy',
      'Performance tracking and progress analytics'
    ],
    choosePlan: 'Choose Your Plan',
    choosePlanSub: 'Select the perfect plan for your STEP test preparation journey',
    basic: 'Basic',
    premium: 'Premium',
    basicDesc: 'Essential tools for STEP preparation',
    premiumDesc: 'Complete preparation package',
    basicFeatures: ['Real test simulator access', 'Explanations for answers', 'Progress tracking', 'Standard support'],
    premiumFeatures: [
      'Full test simulator access',
      'Detailed explanations for every question',
      'Advanced analytics & progress tracking',
      'Priority support',
      'Unlimited practice tests'
    ],
    mostPopular: 'MOST POPULAR',
    perDurationEn: '/ 50 day',
    ctaTitle: 'Ready to Ace Your STEP Test?',
    ctaSubtitle: 'Join hundreds of students who have improved their scores with our comprehensive preparation platform',
    startPreparing: 'Start Preparing Today',
    footerName: 'STEP English',
    footerCopy: '© 2025 STEP English Test Platform. All rights reserved.',
    dialogTitle: 'Start Your Journey',
    dialogDesc: 'Sign up now and begin your STEP test preparation',
    trialMessage: 'Try the trial test before subscribing. After signup you will be redirected to the dashboard (no payment).',
    fullName: 'Full Name',
    email: 'Email Address',
    password: 'Password',
    selectedPlan: 'Selected Plan',
    completeSignUp: 'Complete Sign Up'
  },
  ar: {
    siteName: 'STEP أونلاين',
    pill: 'تحضير احترافي للاختبارات',
    heroTitleLine1: 'اتقن',
    heroTitleLine2: 'اختبار STEP للغة الإنجليزية',
    heroSubtitle:
      'اختبر محاكي اختبار حقيقي مع شروحات مفصّلة لكل سؤال. استعد بثقة وحقق الدرجة المستهدفة.',
    startJourney: 'ابدأ رحلتك',
    viewPricing: 'عرض الأسعار',
    whyChoose: 'لماذا تختار منصتنا؟',
    whyChooseSub: 'اختبر أكثر تحضير شامل لاختبار STEP',
    features: [
      { title: 'محاكي اختبار حقيقي', desc: 'تمرّن في ظروف واجهة مشابهة للاختبار الفعلي' },
      { title: 'شروحات مفصّلة', desc: 'افهم كل سؤال مع شروحات تساعدك على التعلم من الأخطاء' },
      { title: 'تتبع تقدمك', desc: 'راقب تحسّنك مع تحليلات مفصّلة ورؤى شخصية' }
    ],
    benefitsTitle: 'كل ما تحتاجه للنجاح',
    benefitsSubtitle: 'منصتنا توفر أدوات وموارد شاملة لزيادة أداءك في اختبار STEP.',
    benefitItems: [
      'محاكاة دقيقة للاختبار تطابق ظروف الامتحان الحقيقي',
      'شروحات خطوة بخطوة لكل إجابة',
      'تمارين زمنية لتحسين السرعة والدقة',
      'تتبع الأداء وتحليلات التقدم'
    ],
    choosePlan: 'اختر خطتك',
    choosePlanSub: 'اختر الخطة المناسبة لرحلة تحضيرك لاختبار STEP',
    basic: 'الأساسي',
    premium: 'البريميوم',
    basicDesc: 'أدوات أساسية للتحضير لاختبار STEP',
    premiumDesc: 'حزمة تحضير كاملة',
    basicFeatures: ['وصول لمحاكي الاختبار', 'شروحات مختصرة للإجابات', 'تتبع التقدم', 'دعم قياسي'],
    premiumFeatures: [
      'وصول كامل لمحاكي الاختبار',
      'شروحات مفصّلة لكل سؤال',
      'تحليلات متقدمة وتتبع التقدم',
      'دعم أولوية',
      'اختبارات غير محدودة'
    ],
    mostPopular: 'الأكثر شيوعاً',
    perDurationAr: '/ 50 يوم',
    ctaTitle: 'جاهز لتتفوق في اختبار STEP؟',
    ctaSubtitle: 'انضم لمئات الطلاب الذين حسّنوا درجاتهم باستخدام منصتنا الشاملة',
    startPreparing: 'ابدأ التحضير الآن',
    footerName: 'STEP English',
    footerCopy: '© 2025 منصة STEP English. جميع الحقوق محفوظة.',
    dialogTitle: 'ابدأ رحلتك',
    dialogDesc: 'سجّل الآن وابدأ تحضيرك لاختبار STEP',
    trialMessage: 'جرب الاختبار التجريبي قبل ما تشترك. بعد التسجيل ستنتقل للداشبورد (بدون دفع).',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    selectedPlan: 'الخطة المختارة',
    completeSignUp: 'إكمال التسجيل'
  }
}

/* بيانات الميزات مع أيقونات صحيحة لتجنّب undefined */
const featuresData = [
  {
    icon: BookOpen,
    titleEn: 'Real Test Simulator',
    titleAr: 'محاكي اختبار حقيقي',
    descEn: 'Practice with authentic test conditions and interface that mirrors the actual STEP exam',
    descAr: 'تمرّن في ظروف واجهة مشابهة للاختبار الفعلي'
  },
  {
    icon: Brain,
    titleEn: 'Detailed Explanations',
    titleAr: 'شروحات مفصّلة',
    descEn: 'Understand every question with comprehensive explanations that help you learn from mistakes',
    descAr: 'افهم كل سؤال مع شروحات تساعدك على التعلم من الأخطاء'
  },
  {
    icon: Trophy,
    titleEn: 'Track Your Progress',
    titleAr: 'تتبع تقدمك',
    descEn: 'Monitor your improvement with detailed analytics and personalized performance insights',
    descAr: 'راقب تحسّنك مع تحليلات مفصّلة ورؤى شخصية'
  }
]

export default function Landing2() {
  const [lang, setLang] = useState('ar') // 'ar' or 'en'
  const t = (key) => translations[lang][key] || key

  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', plan: 'basic' })
  const [dialogMode, setDialogMode] = useState('signup') // 'signup' = بدون خطط, 'trial' = مع الخطط
  const containerRef = useRef(null)

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
    // استبدل هذا بإرسال بيانات فعلية للباك إند عند الحاجة
    window.location.href = '/dashboard'
  }

  const planDuration = lang === 'ar' ? translations.ar.perDurationAr : translations.en.perDurationEn

  return (
    <div ref={containerRef} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]"
      >
        <div className="container mx-auto px-6 flex items-center justify-between py-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-bold text-white">
            {t('siteName')}
          </motion.div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="text-sm text-gray-300 px-3 py-2 border border-[#2a2a2a] rounded-md"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Button
                onClick={() => {
                  setDialogMode('signup') // افتح بدون خطط
                  setIsSignUpOpen(true)
                }}
                className="bg-white text-black hover:bg-gray-200 transition-colors"
              >
                {t('startJourney')}
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section style={{ opacity, scale }} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated background grid */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, #1a1a1a 1px, transparent 1px),
                linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)
              `,
              backgroundSize: '80px 80px'
            }}
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-6">
              <Star className="w-4 h-4 text-white" />
              <span className="text-sm text-gray-400">{t('pill')}</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">{t('heroTitleLine1')} </span>
              <span className="text-white border-b-4 border-white pb-2">{t('heroTitleLine2')}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('heroSubtitle')}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }} className="flex gap-4 justify-center flex-wrap">
              <Button
                size="lg"
                onClick={() => {
                  setDialogMode('signup') // افتح بدون خطط
                  setIsSignUpOpen(true)
                }}
                className="bg-white text-black hover:bg-gray-200 transition-all transform hover:scale-105 text-lg px-8 py-6"
              >
                {t('startJourney')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="border-[#2a2a2a] text-white hover:bg-[#1a1a1a] text-lg px-8 py-6"
                onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}
              >
                {t('viewPricing')}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }} className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-6 h-10 border-2 border-[#2a2a2a] rounded-full flex justify-center pt-2">
            <motion.div className="w-1.5 h-1.5 bg-white rounded-full" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section className="py-32 relative border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">{t('whyChoose')}</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">{t('whyChooseSub')}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {featuresData.map((feature, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 + index * 0.2 }} viewport={{ once: true }} whileHover={{ y: -10, transition: { duration: 0.3 } }}>
                <Card className="bg-[#141414] border-[#2a2a2a] hover:border-white transition-all duration-300 h-full">
                  <CardHeader>
                    <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4">
                      <feature.icon className="w-8 h-8 text-black" />
                    </motion.div>
                    <CardTitle className="text-2xl text-white">{lang === 'ar' ? feature.titleAr : feature.titleEn}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-400 text-base leading-relaxed">{lang === 'ar' ? feature.descAr : feature.descEn}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">{t('benefitsTitle')}</h2>
                <p className="text-lg text-gray-400 mb-8">{t('benefitsSubtitle')}</p>

                <div className="space-y-6">
                  {translations[lang].benefitItems.map((item, index) => (
                    <motion.div key={index} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }} viewport={{ once: true }} className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                        <Target className="w-6 h-6 text-black" />
                      </div>
                      <p className="text-gray-400 text-lg pt-2">{item}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="relative">
                <div className="relative bg-[#141414] rounded-3xl p-8 border border-[#2a2a2a]">
                  <div className="space-y-4">
                    {[1, 2, 3].map((item, index) => (
                      <motion.div key={item} initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }} viewport={{ once: true }} className="bg-[#0a0a0a] rounded-xl p-6 border border-[#2a2a2a]">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-bold">{item}</div>
                          <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} whileInView={{ width: `${60 + item * 10}%` }} transition={{ duration: 1, delay: 0.5 + index * 0.1 }} viewport={{ once: true }} className="h-full bg-white" />
                          </div>
                        </div>
                        <div className="h-2 bg-[#1a1a1a] rounded-full mb-2" />
                        <div className="h-2 bg-[#1a1a1a] rounded-full w-3/4" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">{t('choosePlan')}</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">{t('choosePlanSub')}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'basic',
                price: 75,
                title: t('basic'),
                description: t('basicDesc'),
                features: translations[lang].basicFeatures || translations.en.basicFeatures,
                popular: false,
                delay: 0.2
              },
              {
                name: 'premium',
                price: 85,
                title: t('premium'),
                description: t('premiumDesc'),
                features: translations[lang].premiumFeatures || translations.en.premiumFeatures,
                popular: true,
                delay: 0.4
              }
            ].map((plan) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: plan.delay }} viewport={{ once: true }} whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}>
                <Card className={`relative overflow-hidden h-full ${plan.popular ? 'bg-white border-white' : 'bg-[#141414] border-[#2a2a2a]'}`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-black text-white px-4 py-1 text-sm font-semibold">{t('mostPopular')}</div>
                    </div>
                  )}

                  <CardHeader className="pt-8">
                    <CardTitle className={`text-3xl ${plan.popular ? 'text-black' : 'text-white'}`}>{plan.title}</CardTitle>
                    <CardDescription className={plan.popular ? 'text-gray-600' : 'text-gray-400'}>{plan.description}</CardDescription>

                    <div className="mt-6">
                      <span className={`text-5xl font-bold ${plan.popular ? 'text-black' : 'text-white'}`}>﷼{plan.price}</span>
                      <span className={`ml-2 ${plan.popular ? 'text-gray-600' : 'text-gray-400'}`}>{planDuration}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    <ul className="space-y-4">
                      {plan.features.map((feature, index) => (
                        <motion.li key={index} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: plan.delay + 0.1 * index }} viewport={{ once: true }} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${plan.popular ? 'bg-black' : 'bg-white'}`}>
                            <Check className={`w-4 h-4 ${plan.popular ? 'text-white' : 'text-black'}`} />
                          </div>
                          <span className={plan.popular ? 'text-gray-700' : 'text-gray-400'}>{feature}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="pt-6">
                    <Button
                      className={`w-full transition-all transform hover:scale-105 ${plan.popular ? 'bg-black text-white hover:bg-gray-900' : 'bg-white text-black hover:bg-gray-200'}`}
                      size="lg"
                      onClick={() => {
                        setFormData({ ...formData, plan: plan.name })
                        setDialogMode('trial') // نعرض الخطط داخل الـ dialog
                        setIsSignUpOpen(true)
                      }}
                    >
                      {t('startJourney')}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="max-w-4xl mx-auto bg-white rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
            <div className="relative z-10">
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} viewport={{ once: true }} className="text-4xl md:text-5xl font-bold text-black mb-6">
                {t('ctaTitle')}
              </motion.h2>

              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} viewport={{ once: true }} className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto">
                {t('ctaSubtitle')}
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} viewport={{ once: true }}>
                <Button
                  size="lg"
                  onClick={() => {
                    setDialogMode('trial')
                    setIsSignUpOpen(true)
                  }}
                  className="bg-black text-white hover:bg-gray-900 transition-all transform hover:scale-105 text-lg px-10 py-6"
                >
                  {t('startPreparing')}
                  <Zap className="ml-2 w-5 h-5" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-12">
        <div className="container mx-auto px-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-4">{t('footerName')}</div>
            <p className="text-gray-400">{t('footerCopy')}</p>
          </div>
        </div>
      </footer>

      {/* Sign Up Dialog */}
      <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] text-white z-60 relative">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">{t('dialogTitle')}</DialogTitle>
            <DialogDescription className="text-gray-400">{t('dialogDesc')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {dialogMode === 'trial' && (
              <div className="bg-[#0b0b0b] p-4 rounded-md border border-[#2a2a2a] text-gray-200">
                {t('trialMessage')}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">{t('fullName')}</Label>
              <Input
                id="name"
                placeholder={lang === 'ar' ? 'أدخل اسمك' : 'Enter your name'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={lang === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter a password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white"
              />
            </div>

            {dialogMode === 'trial' && (
              <div className="space-y-2">
                <Label className="text-white">{t('selectedPlan')}</Label>
                <div className="flex gap-4">
                  {['basic', 'premium'].map((planType) => (
                    <button
                      key={planType}
                      type="button"
                      onClick={() => setFormData({ ...formData, plan: planType })}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${formData.plan === planType ? 'border-white bg-white/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}
                    >
                      <div className="font-semibold text-white capitalize">
                        {planType === 'basic' ? translations[lang].basic : translations[lang].premium}
                      </div>
                      <div className="text-2xl font-bold text-white">﷼{planType === 'basic' ? '75' : '85'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 transition-colors" size="lg">
              {t('completeSignUp')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
