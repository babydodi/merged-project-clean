'use client'

import { useState, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, BookOpen, Brain, Trophy, ArrowRight, Target, Clock, Star, Zap } from 'lucide-react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

/* Features with icons */
const featuresData = [
  { icon: BookOpen, titleEn: 'Real Test Simulator', titleAr: 'محاكي اختبار حقيقي', descEn: 'Practice with authentic test conditions and interface that mirrors the actual STEP exam', descAr: 'تمرّن في ظروف واجهة مشابهة للاختبار الفعلي' },
  { icon: Brain, titleEn: 'Detailed Explanations', titleAr: 'شروحات مفصّلة', descEn: 'Understand every question with comprehensive explanations that help you learn from mistakes', descAr: 'افهم كل سؤال مع شروحات تساعدك على التعلم من الأخطاء' },
  { icon: Trophy, titleEn: 'Track Your Progress', titleAr: 'تتبع تقدمك', descEn: 'Monitor your improvement with detailed analytics and personalized performance insights', descAr: 'راقب تحسّنك مع تحليلات مفصّلة ورؤى شخصية' }
]

/* Plans with bilingual features */
const plans = [
  {
    name: 'basic', price: 75, titleEn: 'Basic', titleAr: 'الأساسي',
    descriptionEn: 'Essential tools for STEP preparation', descriptionAr: 'أدوات أساسية للتحضير لاختبار STEP',
    features: [
      { en: 'Real test simulator access', ar: 'وصول لمحاكي الاختبار' },
      { en: 'Basic explanations for answers', ar: 'شروحات مختصرة للإجابات' },
      { en: 'Progress tracking', ar: 'تتبع التقدم' },
      { en: 'Standard support', ar: 'دعم قياسي' }
    ],
    popular: false, delay: 0.2
  },
  {
    name: 'premium', price: 85, titleEn: 'Premium', titleAr: 'البريميوم',
    descriptionEn: 'Complete preparation package', descriptionAr: 'حزمة تحضير كاملة',
    features: [
      { en: 'Full test simulator access', ar: 'وصول كامل لمحاكي الاختبار' },
      { en: 'Detailed explanations for every question', ar: 'شروحات مفصّلة لكل سؤال' },
      { en: 'Advanced analytics & insights', ar: 'تحليلات متقدمة ورؤى' },
      { en: 'Priority support', ar: 'دعم أولوية' },
      { en: 'Unlimited practice tests', ar: 'اختبارات غير محدودة' }
    ],
    popular: true, delay: 0.4
  }
]

export default function Landing2() {
  const supabase = useSupabaseClient()
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', plan: 'basic' })
  const [dialogMode, setDialogMode] = useState('signup') // 'signup' | 'trial'
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const containerRef = useRef(null)

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  const openDialog = (mode, presetPlan) => {
    if (presetPlan) setFormData((prev) => ({ ...prev, plan: presetPlan }))
    setDialogMode(mode)
    setIsSignUpOpen(true)
    setErrorMsg('')
    setSuccessMsg('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    if (!formData.name || !formData.email || !formData.password) {
      setErrorMsg('Please fill name, email, and password / الرجاء إدخال الاسم والبريد وكلمة المرور')
      setLoading(false)
      return
    }

    try {
      const res = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.name, plan: formData.plan },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined
        }
      })

      const error = res?.error || (res?.data && res.data?.error) || null
      const data = res?.data || res

      if (error) {
        setErrorMsg(error.message || JSON.stringify(error))
        setLoading(false)
        return
      }

      if (data?.user && !data?.session) {
        setSuccessMsg('Check your email to confirm your account / تفقد بريدك لتأكيد الحساب')
        setLoading(false)
        return
      }

      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Unexpected signup error', err)
      setErrorMsg('Unexpected error, please try again / حدث خطأ غير متوقع، حاول مرة أخرى')
      setLoading(false)
    }
  }

  const planDurationEn = '/ 50 day'
  const planDurationAr = '/ 50 يوم'

  return (
    <div className="landing" ref={containerRef}>
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]"
      >
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-bold text-white">
            STEP Online / منصة STEP
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Button onClick={() => openDialog('signup')} className="bg-white text-black hover:bg-gray-200 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                <span>Get Started</span>
                <span className="text-sm text-gray-600"> / ابدأ الآن</span>
              </div>
            </Button>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section style={{ opacity, scale }} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
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
              <span className="text-sm text-gray-400">Professional Test Preparation / تحضير احترافي للاختبارات</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Master the STEP English Test</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              <div className="space-y-2">
                <div>Experience a real test simulator with detailed explanations for every question. Prepare with confidence and achieve your target score.</div>
                <div className="text-gray-300">اختبر محاكي اختبار حقيقي مع شروحات مفصّلة لكل سؤال. استعد بثقة وحقق الدرجة المستهدفة.</div>
              </div>
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }} className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" onClick={() => openDialog('signup')} className="bg-white text-black hover:bg-gray-200 transition-all transform hover:scale-105 text-lg px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                  <span>Start Your Journey</span>
                  <span className="text-sm text-gray-600"> / ابدأ رحلتك</span>
                </div>
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <Button size="lg" variant="outline" className="border-[#2a2a2a] text-white hover:bg-[#1a1a1a] text-lg px-8 py-6" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                  <span>View Pricing</span>
                  <span className="text-sm text-gray-600"> / عرض الأسعار</span>
                </div>
              </Button>
            </motion.div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }} className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-6 h-10 border-2 border-[#2a2a2a] rounded-full flex justify-center pt-2">
            <motion.div className="w-1.5 h-1.5 bg-white rounded-full" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features */}
      <section className="py-32 relative border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Why Choose Our Platform? / لماذا تختار منصتنا؟</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">Experience the most comprehensive STEP test preparation / اختبر أكثر تحضير شامل لاختبار STEP</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {featuresData.map((feature, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 + index * 0.2 }} viewport={{ once: true }} whileHover={{ y: -10, transition: { duration: 0.3 } }}>
                <Card className="bg-[#141414] border-[#2a2a2a] hover:border-white transition-all duration-300 h-full">
                  <CardHeader>
                    <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4">
                      {feature.icon && <feature.icon className="w-8 h-8 text-black" />}
                    </motion.div>
                    <CardTitle className="text-2xl text-white">
                      <div className="flex flex-col">
                        <span>{feature.titleEn}</span>
                        <span className="text-sm text-gray-300">{feature.titleAr}</span>
                      </div>
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <CardDescription className="text-gray-400 text-base leading-relaxed">
                      <div className="space-y-2">
                        <div>{feature.descEn}</div>
                        <div className="text-gray-300">{feature.descAr}</div>
                      </div>
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Choose Your Plan / اختر خطتك</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">Select the perfect plan for your STEP test preparation journey / اختر الخطة المناسبة لرحلة تحضيرك لاختبار STEP</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: plan.delay }} viewport={{ once: true }} whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}>
                <Card className={`relative overflow-hidden h-full ${plan.popular ? 'bg-white border-white' : 'bg-[#141414] border-[#2a2a2a]'}`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-black text-white px-4 py-1 text-sm font-semibold">MOST POPULAR / الأكثر شيوعاً</div>
                    </div>
                  )}

                  <CardHeader className="pt-8">
                    <CardTitle className={`text-3xl ${plan.popular ? 'text-black' : 'text-white'}`}>
                      <div className="flex flex-col">
                        <span>{plan.titleEn}</span>
                        <span className="text-sm text-gray-500">{plan.titleAr}</span>
                      </div>
                    </CardTitle>
                    <CardDescription className={plan.popular ? 'text-gray-600' : 'text-gray-400'}>
                      <div>{plan.descriptionEn}</div>
                      <div className="text-gray-500">{plan.descriptionAr}</div>
                    </CardDescription>

                    <div className="mt-6">
                      <span className={`text-5xl font-bold ${plan.popular ? 'text-black' : 'text-white'}`}>﷼{plan.price}</span>
                      <span className={`ml-2 ${plan.popular ? 'text-gray-600' : 'text-gray-400'}`}>
                        <span className="block">{planDurationEn}</span>
                        <span className="block text-gray-400">{planDurationAr}</span>
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    <ul className="space-y-4">
                      {plan.features.map((feature, idx) => (
                        <motion.li key={idx} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: plan.delay + 0.1 * idx }} viewport={{ once: true }} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${plan.popular ? 'bg-black' : 'bg-white'}`}>
                            <Check className={`w-4 h-4 ${plan.popular ? 'text-white' : 'text-black'}`} />
                          </div>
                          <div>
                            <div className={plan.popular ? 'text-gray-700' : 'text-gray-400'}>{feature.en}</div>
                            <div className="text-gray-500 text-sm">{feature.ar}</div>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="pt-6">
                    <Button className={`w-full transition-all transform hover:scale-105 ${plan.popular ? 'bg-black text-white hover:bg-gray-900' : 'bg-white text-black hover:bg-gray-200'}`} size="lg" onClick={() => openDialog('trial', plan.name)}>
                      <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                        <span>Get Started</span>
                        <span className="text-sm text-gray-600"> / ابدأ</span>
                      </div>
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="max-w-4xl mx-auto bg-white rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
            <div className="relative z-10">
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} viewport={{ once: true }} className="text-4xl md:text-5xl font-bold text-black mb-6">
                Ready to Ace Your STEP Test?
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} viewport={{ once: true }} className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto">
                Join hundreds of students who have improved their scores with our comprehensive preparation platform
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} viewport={{ once: true }}>
                <Button size="lg" onClick={() => openDialog('signup')} className="bg-black text-white hover:bg-gray-900 transition-all transform hover:scale-105 text-lg px-10 py-6">
                  Start Preparing Today
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
            <div className="text-2xl font-bold text-white mb-4">STEP English</div>
            <p className="text-gray-400">© 2025 STEP English Test Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Sign Up Dialog */}
      <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Start Your Journey / ابدأ رحلتك</DialogTitle>
            <DialogDescription className="text-gray-400">Sign up now and begin your STEP test preparation / سجّل الآن وابدأ تحضيرك لاختبار STEP</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {dialogMode === 'trial' && (
              <div className="bg-[#0b0b0b] p-4 rounded-md border border-[#2a2a2a] text-gray-200">
                جرب الاختبار التجريبي قبل ما تشترك — بعد التسجيل ستنتقل للداشبورد (بدون دفع).
              </div>
            )}

            {errorMsg && <div className="bg-red-500/10 border border-red-500 text-red-300 rounded p-3">{errorMsg}</div>}
            {successMsg && <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 rounded p-3">{successMsg}</div>}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Full Name / الاسم الكامل</Label>
              <Input id="name" placeholder="Enter your name / أدخل اسمك" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email Address / البريد الإلكتروني</Label>
              <Input id="email" type="email" placeholder="Enter your email / أدخل بريدك الإلكتروني" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password / كلمة المرور</Label>
              <Input id="password" type="password" placeholder="Enter a password / أدخل كلمة المرور" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white" />
            </div>

            {dialogMode === 'trial' && (
              <div className="space-y-2">
                <Label className="text-white">Selected Plan / الخطة المختارة</Label>
                <div className="flex gap-4">
                  {plans.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, plan: p.name })}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${formData.plan === p.name ? 'border-white bg-white/10' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}
                    >
                      <div className="font-semibold text-white">
                        <div>{p.titleEn}</div>
                        <div className="text-sm text-gray-300">{p.titleAr}</div>
                      </div>
                      <div className="text-2xl font-bold text-white">﷼{p.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 transition-colors" size="lg" disabled={loading}>
              {loading ? 'Creating account… / جاري إنشاء الحساب…' : 'Complete Sign Up / إكمال التسجيل'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
