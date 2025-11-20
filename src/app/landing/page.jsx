'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, BookOpen, Brain, Trophy, ArrowRight, Target, Clock, Star, Zap } from 'lucide-react'

export default function Landing2() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  // language toggle: 'ar' or 'en'
  const [lang, setLang] = useState('ar')

  // signup dialog + form
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', plan: 'basic' })
  const [loadingSignUp, setLoadingSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Prices (already in SAR)
  const PLANS = {
    basic: { sar: 75 },
    premium: { sar: 85 }
  }

  const t = {
    ar: {
      start: 'ابدأ رحلتك',
      getStarted: 'سجل الآن',
      name: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      plan: 'الخطة المختارة',
      complete: 'إكمال التسجيل',
      pricing: 'الأسعار بالريال السعودي',
      success: 'تم التسجيل، سيتم تحويلك لاختبار تجريبي...'
    },
    en: {
      start: 'Start Your Journey',
      getStarted: 'Get Started',
      name: 'Full Name',
      email: 'Email Address',
      plan: 'Selected Plan',
      complete: 'Complete Sign Up',
      pricing: 'Prices in SAR',
      success: 'Signed up — redirecting to demo test...'
    }
  }

  // --- CORE: signup & DB writes ---
  // flow:
  // 1) supabase.auth.signUp({ email }) -> magic link
  // 2) create subscriptions row (pending) with amount in SAR and customer_email
  // 3) create test_attempts for DEMO_TEST_ID if available and redirect to attempts/{id}/start or /tests/preview
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoadingSignUp(true)

    try {
      const email = (formData.email || '').trim()
      const full_name = (formData.name || '').trim()
      const plan = (formData.plan || 'basic').toLowerCase()
      if (!email) throw new Error(lang === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email required')

      // 1) sign up (magic link)
      const { error: signErr } = await supabase.auth.signUp(
        { email },
        {
          redirectTo: typeof window !== 'undefined'
            ? window.location.origin + '/auth/callback'
            : undefined
        }
      )

      // signErr may be non-fatal (user exists). Log but continue.
      if (signErr && signErr.message && !signErr.message.includes('User already registered')) {
        console.warn('signUp warning:', signErr.message)
      }

      // 2) try get current user (may be null for magic-link flows)
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user || null

      // 3) create subscription record (pending)
      const amountSAR = PLANS[plan]?.sar ?? PLANS.basic.sar
      const subPayload = {
        user_id: user?.id || null,
        plan,
        is_active: false,
        status: 'pending',
        amount: amountSAR,
        customer_email: email
      }

      const { data: subData, error: subErr } = await supabase
        .from('subscriptions')
        .insert(subPayload)
        .select()
        .single()

      if (subErr) {
        console.error('subscriptions insert error', subErr)
        // not fatal: continue but surface message
      }

      // 4) create test_attempts for demo test if DEMO_TEST_ID provided
      const DEMO_TEST_ID = process.env.NEXT_PUBLIC_DEMO_TEST_ID || null
      let attemptId = null

      if (DEMO_TEST_ID) {
        const { data: attempt, error: attErr } = await supabase
          .from('test_attempts')
          .insert({ test_id: DEMO_TEST_ID, user_id: user?.id || null })
          .select()
          .single()

        if (attErr) {
          console.error('create attempt error', attErr)
        } else {
          attemptId = attempt?.id
        }
      }

      setLoadingSignUp(false)
      alert(t[lang].success)

      // redirect logic
      if (attemptId) {
        router.push(`/attempts/${attemptId}/start`)
      } else if (DEMO_TEST_ID) {
        router.push(`/tests/preview?testId=${DEMO_TEST_ID}`)
      } else {
        router.push('/dashboard2')
      }
    } catch (err) {
      console.error('signup error', err)
      setErrorMsg(err?.message || (lang === 'ar' ? 'حدث خطأ' : 'An error occurred'))
      setLoadingSignUp(false)
    }
  }

  // small helpers for UI
  const toggleLang = () => setLang(l => (l === 'ar' ? 'en' : 'ar'))

  return (
    <div ref={containerRef} className="relative">
      {/* NAV */}
      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.6 }} className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]">
        <div className="container mx-auto px-6 flex items-center justify-between py-3">
          <div className="text-2xl font-bold text-white">STEP Online</div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLang} className="text-sm text-gray-300 border px-3 py-1 rounded">
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
            <Button onClick={() => setIsSignUpOpen(true)} className="bg-white text-black hover:bg-gray-200 transition-colors">
              {lang === 'ar' ? 'سجل الآن' : 'Get Started'}
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* HERO */}
      <motion.section style={{ opacity, scale }} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, #1a1a1a 1px, transparent 1px),
              linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }} />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-6">
              <Star className="w-4 h-4 text-white" />
              <span className="text-sm text-gray-400">{lang === 'ar' ? 'تحضير احترافي للاختبار' : 'Professional Test Preparation'}</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">{lang === 'ar' ? 'تمكن من' : 'Master the'}</span>
              <span className="text-white border-b-4 border-white pb-2 ml-3">{lang === 'ar' ? 'اختبار STEP الإنجليزي' : 'STEP English Test'}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {lang === 'ar'
                ? 'جرب محاكاة الاختبار الحقيقية مع شروحات مفصلة لكل سؤال. استعد بثقة وحقق هدفك.'
                : 'Experience a real test simulator with detailed explanations for every question. Prepare with confidence and achieve your target score.'}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }} className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" onClick={() => setIsSignUpOpen(true)} className="bg-white text-black hover:bg-gray-200 transition-all transform hover:scale-105 text-lg px-8 py-6">
                {lang === 'ar' ? 'ابدأ رحلتك' : 'Start Your Journey'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <Button size="lg" variant="outline" className="border-[#2a2a2a] text-white hover:bg-[#1a1a1a] text-lg px-8 py-6" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                {lang === 'ar' ? 'عرض الأسعار' : 'View Pricing'}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* scroll indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }} className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-6 h-10 border-2 border-[#2a2a2a] rounded-full flex justify-center pt-2">
            <motion.div className="w-1.5 h-1.5 bg-white rounded-full" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* FEATURES (kept simple) */}
      <section className="py-32 relative border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">{lang === 'ar' ? 'لماذا تختار منصتنا؟' : 'Why Choose Our Platform?'}</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">{lang === 'ar' ? 'أدوات شاملة لتحضير اختبار STEP' : 'Experience the most comprehensive STEP test preparation'}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: BookOpen, title: lang === 'ar' ? 'محاكي اختبارات حقيقي' : 'Real Test Simulator', desc: lang === 'ar' ? 'ممارسة في ظروف مشابهة للاختبار' : 'Practice with authentic test conditions', delay: 0.2 },
              { icon: Brain, title: lang === 'ar' ? 'شروحات مفصلة' : 'Detailed Explanations', desc: lang === 'ar' ? 'فهم كل سؤال للتعلم من الأخطاء' : 'Understand every question with comprehensive explanations', delay: 0.4 },
              { icon: Trophy, title: lang === 'ar' ? 'تتبع تقدمك' : 'Track Your Progress', desc: lang === 'ar' ? 'تقارير أداء شخصية' : 'Monitor your improvement with analytics', delay: 0.6 }
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: f.delay }} viewport={{ once: true }} whileHover={{ y: -8, transition: { duration: 0.25 } }}>
                <Card className="bg-[#141414] border-[#2a2a2a] h-full">
                  <CardHeader>
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4">
                      <f.icon className="w-8 h-8 text-black" />
                    </div>
                    <CardTitle className="text-2xl text-white">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-gray-400">{f.desc}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white">{lang === 'ar' ? 'اختر خطتك' : 'Choose Your Plan'}</h2>
            <p className="text-gray-400">{lang === 'ar' ? 'الأسعار بالريال السعودي' : 'Prices in SAR'}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {['basic', 'premium'].map((p) => {
              const isPremium = p === 'premium'
              return (
                <Card key={p} className={`p-6 ${isPremium ? 'bg-white text-black' : 'bg-[#141414] text-white'}`}>
                  <CardHeader>
                    <CardTitle className={`text-3xl ${isPremium ? 'text-black' : 'text-white'}`}>{lang === 'ar' ? (p === 'basic' ? 'أساسي' : 'بريميوم') : p.charAt(0).toUpperCase() + p.slice(1)}</CardTitle>
                    <div className="mt-4">
                      <div className="text-5xl font-bold">{PLANS[p].sar} ر.س</div>
                      <div className="text-sm text-gray-400 mt-1">{lang === 'ar' ? '/ مدى الحياة' : '/ lifetime'}</div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    <ul className="space-y-3 text-gray-400">
                      <li>• {lang === 'ar' ? 'محاكي اختبار' : 'Test simulator'}</li>
                      <li>• {lang === 'ar' ? 'شروحات' : 'Explanations'}</li>
                      <li>• {lang === 'ar' ? 'تتبع الأداء' : 'Progress tracking'}</li>
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button onClick={() => { setFormData({ ...formData, plan: p }); setIsSignUpOpen(true) }} className={`${isPremium ? 'bg-black text-white' : 'bg-white text-black'}`} size="lg">
                      {lang === 'ar' ? 'اشترك' : 'Get Started'} <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-12 md:p-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">{lang === 'ar' ? 'هل أنت جاهز للاختبار؟' : 'Ready to Ace Your STEP Test?'}</h2>
            <p className="text-xl text-gray-700 mb-10">{lang === 'ar' ? 'انضم لمئات الطلاب الذين حسنوا درجاتهم' : 'Join hundreds of students who have improved their scores'}</p>
            <Button size="lg" onClick={() => setIsSignUpOpen(true)} className="bg-black text-white hover:bg-gray-900 px-10 py-6">
              {lang === 'ar' ? 'ابدأ التحضير الآن' : 'Start Preparing Today'} <Zap className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="text-2xl font-bold text-white mb-4">STEP English</div>
          <p className="text-gray-400">© 2025 STEP English Test Platform. All rights reserved.</p>
        </div>
      </footer>

      {/* SIGNUP DIALOG */}
      {isSignUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsSignUpOpen(false)} />
          <div className="relative bg-[#141414] border border-[#2a2a2a] p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-3">{lang === 'ar' ? 'ابدأ رحلتك' : 'Start Your Journey'}</h3>

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
                <Label className="text-gray-300">{t[lang].plan}</Label>
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
                  {loadingSignUp ? '...' : (lang === 'ar' ? 'إكمال التسجيل' : 'Complete Sign Up')}
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
