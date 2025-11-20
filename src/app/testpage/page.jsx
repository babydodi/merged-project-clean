'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Star, BookOpen, Brain, Trophy, ArrowRight, Zap } from 'lucide-react'

export default function Landing2() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  // language toggle: 'ar' or 'en'
  const [lang, setLang] = useState('ar')
  const toggleLang = () => setLang(l => (l === 'ar' ? 'en' : 'ar'))

  // signup dialog + form
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [loadingSignUp, setLoadingSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    plan: 'basic'
  })

  // Prices in SAR
  const PLANS = { basic: { sar: 75 }, premium: { sar: 85 } }

  const t = {
    ar: {
      heroBadge: 'تحضير احترافي للاختبار',
      heroTitle1: 'تمكّن من',
      heroTitle2: 'اختبار STEP الإنجليزي',
      heroDesc: 'جرب محاكاة الاختبار الحقيقية مع شروحات مفصلة لكل سؤال. استعد بثقة وحقق هدفك.',
      startJourney: 'ابدأ رحلتك',
      viewPricing: 'عرض الأسعار',
      featuresTitle: 'لماذا تختار منصتنا؟',
      featuresDesc: 'أدوات شاملة لتحضير اختبار STEP',
      choosePlan: 'اختر خطتك',
      pricesSar: 'الأسعار بالريال السعودي',
      lifetime: '/ مدى الحياة',
      ctaTitle: 'هل أنت جاهز للاختبار؟',
      ctaDesc: 'انضم لمئات الطلاب الذين حسّنوا درجاتهم',
      ctaBtn: 'ابدأ التحضير الآن',
      dialogTitle: 'ابدأ رحلتك',
      name: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      selectedPlan: 'الخطة المختارة',
      completeSignUp: 'إكمال التسجيل',
      success: 'تم التسجيل بنجاح، جاري التوجيه إلى لوحة التحكم...',
      signUp: 'سجل الآن',
      subscribe: 'اشترك'
    },
    en: {
      heroBadge: 'Professional Test Preparation',
      heroTitle1: 'Master the',
      heroTitle2: 'STEP English Test',
      heroDesc: 'Experience a real test simulator with detailed explanations for every question. Prepare with confidence.',
      startJourney: 'Start Your Journey',
      viewPricing: 'View Pricing',
      featuresTitle: 'Why Choose Our Platform?',
      featuresDesc: 'Experience the most comprehensive STEP test preparation',
      choosePlan: 'Choose Your Plan',
      pricesSar: 'Prices in SAR',
      lifetime: '/ lifetime',
      ctaTitle: 'Ready to Ace Your STEP Test?',
      ctaDesc: 'Join hundreds of students who have improved their scores',
      ctaBtn: 'Start Preparing Today',
      dialogTitle: 'Start Your Journey',
      name: 'Full Name',
      email: 'Email Address',
      password: 'Password',
      selectedPlan: 'Selected Plan',
      completeSignUp: 'Complete Sign Up',
      success: 'Signed up — redirecting to dashboard...',
      signUp: 'Get Started',
      subscribe: 'Get Started'
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoadingSignUp(true)

    try {
      const email = (formData.email || '').trim()
      const password = (formData.password || '').trim()
      const full_name = (formData.name || '').trim()
      const plan = (formData.plan || 'basic').toLowerCase()

      if (!email || !password || !full_name) {
        throw new Error(lang === 'ar' ? 'الرجاء تعبئة الاسم، البريد وكلمة المرور' : 'Please provide name, email and password')
      }

      // 1) Create user in auth.users
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError && !/already registered/i.test(signUpError.message || '')) throw signUpError

      // 2) Sign in to get session (if not auto)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const user = signInData?.user || signUpData?.user || null
      if (!user) throw new Error(lang === 'ar' ? 'فشل تسجيل الدخول' : 'Failed to sign in')

      // 3) Insert into public.users (link to auth.users.id)
      const { error: userInsErr } = await supabase.from('users').insert({
        id: user.id,
        email,
        full_name,
        role: 'unsubscribed'
      })
      if (userInsErr && !/duplicate key/i.test(userInsErr.message || '')) throw userInsErr

      // 4) Create a pending subscription
      const amountSAR = PLANS[plan]?.sar ?? PLANS.basic.sar
      const { error: subErr } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan,
        is_active: false,
        status: 'pending',
        amount: amountSAR,
        customer_email: email
      })
      if (subErr) console.warn('subscriptions insert warning', subErr)

      setLoadingSignUp(false)
      alert(t[lang].success)
      router.push('/dashboard')
    } catch (err) {
      console.error('signup error', err)
      setErrorMsg(err?.message || (lang === 'ar' ? 'حدث خطأ' : 'An error occurred'))
      setLoadingSignUp(false)
    }
  }

  return (
    <div ref={containerRef} className="relative min-h-screen bg-black text-white">
      {/* NAV */}
      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }} className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]">
        <div className="container mx-auto px-6 flex items-center justify-between py-3">
          <div className="text-2xl font-bold">STEP Online</div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLang} className="text-sm text-gray-300 border px-3 py-1 rounded">
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
            <Button onClick={() => setIsSignUpOpen(true)} className="bg-white text-black hover:bg-gray-200">
              {t[lang].signUp}
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* HERO */}
      <motion.section style={{ opacity, scale }} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, #1a1a1a 1px, transparent 1px),
            linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px'
        }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-6">
              <Star className="w-4 h-4" />
              <span className="text-sm text-gray-400">{t[lang].heroBadge}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span>{t[lang].heroTitle1}</span>
              <span className="border-b-4 border-white pb-2 ml-3">{t[lang].heroTitle2}</span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">{t[lang].heroDesc}</p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => setIsSignUpOpen(true)} className="bg-white text-black px-8 py-4">
                {t[lang].startJourney} <ArrowRight className="ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="border-[#2a2a2a]" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                {t[lang].viewPricing}
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* FEATURES */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: BookOpen, title: lang === 'ar' ? 'محاكي اختبارات حقيقي' : 'Real Test Simulator', desc: lang === 'ar' ? 'ممارسة في ظروف مشابهة للاختبار' : 'Practice in real-like conditions' },
              { icon: Brain, title: lang === 'ar' ? 'شروحات مفصلة' : 'Detailed Explanations', desc: lang === 'ar' ? 'فهم كل سؤال للتعلم من الأخطاء' : 'Understand every question' },
              { icon: Trophy, title: lang === 'ar' ? 'تتبع تقدمك' : 'Track Your Progress', desc: lang === 'ar' ? 'تقارير أداء شخصية' : 'Personalized analytics' }
            ].map((f, i) => (
              <Card key={i} className="bg-[#141414] border-[#2a2a2a] p-6">
                <CardHeader>
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-4">
                    <f.icon className="w-7 h-7 text-black" />
                  </div>
                  <CardTitle className="text-lg text-white">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-gray-400">{f.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white">{t[lang].choosePlan}</h2>
            <p className="text-gray-400">{t[lang].pricesSar}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {['basic', 'premium'].map((p) => {
              const isPremium = p === 'premium'
              return (
                <Card key={p} className={`p-6 ${isPremium ? 'bg-white text-black' : 'bg-[#141414] text-white'}`}>
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold">
                      {lang === 'ar' ? (p === 'basic' ? 'أساسي' : 'بريميوم') : p.charAt(0).toUpperCase() + p.slice(1)}
                    </CardTitle>
                    <div className="mt-4 text-4xl font-bold">{PLANS[p].sar} ر.س</div>
                    <div className="text-sm text-gray-400 mt-1">{t[lang].lifetime}</div>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-gray-400 space-y-2">
                      <li>• {lang === 'ar' ? 'محاكي اختبار' : 'Test simulator'}</li>
                      <li>• {lang === 'ar' ? 'شروحات' : 'Explanations'}</li>
                      <li>• {lang === 'ar' ? 'تتبع الأداء' : 'Progress tracking'}</li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => { setFormData({ ...formData, plan: p }); setIsSignUpOpen(true) }} className={`${isPremium ? 'bg-black text-white' : 'bg-white text-black'}`} size="lg">
                      {t[lang].subscribe} <ArrowRight className="ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl p-10 text-center">
            <h2 className="text-2xl font-bold text-black mb-4">{t[lang].ctaTitle}</h2>
            <p className="text-gray-700 mb-6">{t[lang].ctaDesc}</p>
            <Button size="lg" onClick={() => setIsSignUpOpen(true)} className="bg-black text-white px-8 py-3">
              {t[lang].ctaBtn} <Zap className="ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1a1a1a] py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="text-xl font-bold">STEP English</div>
          <p className="text-gray-400">© {new Date().getFullYear()} STEP English Test Platform</p>
        </div>
      </footer>

      {/* SIGNUP DIALOG */}
      {isSignUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsSignUpOpen(false)} />
          <div className="relative bg-[#141414] border border-[#2a2a2a] p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-3">{t[lang].dialogTitle}</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-gray-300">{t[lang].name}</Label>
                <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-[#0a0a0a] border-[#2a2a2a] text-white" />
              </div>
              <div>
                <Label className="text-gray-300">{t[lang].email}</Label>
                <Input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-[#0a0a0a] border-[#2a2a2a] text-white" />
              </div>
              <div>
                <Label className="text-gray-300">{t[lang].password}</Label>
                <Input required type="password" minLength={8} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="bg-[#0a0a0a] border-[#2a2a2a] text-white" placeholder={lang === 'ar' ? 'كلمة مرور (8 أحرف أو أكثر)' : 'Password (min 8 chars)'} />
              </div>

              <div>
                <Label className="text-gray-300">{t[lang].selectedPlan}</Label>
                <div className="flex gap-2 mt-2">
                  {['basic', 'premium'].map(p => (
                    <button key={p} type="button" onClick={() => setFormData({ ...formData, plan: p })} className={`flex-1 p-3 rounded ${formData.plan === p ? 'border border-white bg-white/10' : 'border border-[#2a2a2a]'}`}>
                      <div className="font-semibold text-white capitalize">{lang === 'ar' ? (p === 'basic' ? 'أساسي' : 'بريميوم') : p}</div>
                      <div className="text-white text-lg">{PLANS[p].sar} ر.س</div>
                    </button>
                  ))}
                </div>
              </div>

              {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}

              <div>
                <button type="submit" disabled={loadingSignUp} className="w-full py-3 rounded bg-white text-black">
                  {loadingSignUp ? (lang === 'ar' ? 'جارٍ التسجيل...' : 'Signing up...') : t[lang].completeSignUp}
                </button>
              </div>
            </form>

            <button onClick={() => setIsSignUpOpen(false)} className="absolute top-3 right-3 text-gray-400">×</button>
          </div>
        </div>
      )}
    </div>
  )
}
