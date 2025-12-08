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

export default function Landing2() {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    plan: 'basic'
  })
  const [showPlansInDialog, setShowPlansInDialog] = useState(false)
  const containerRef = useRef(null)
  const supabase = useSupabaseClient()

  // useScroll يقيس بالنسبة للعنصر المشار إليه بالـ ref
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { name: formData.name, plan: formData.plan }
        }
      })
      if (error) {
        console.error('Sign up error:', error.message)
        return
      }
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Sign up exception:', err)
    }
  }

  return (
    <>
      {/* Navigation */}
      <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-bold text-white">
          STEP Online
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Button
            onClick={() => {
              setShowPlansInDialog(false)
              setIsSignUpOpen(true)
            }}
            className="bg-white text-black hover:bg-gray-200 transition-colors"
          >
            Get Started
          </Button>
        </motion.div>
      </motion.nav>

      {/* Hero Section */}
      {/* مهم: الـ ref موضوع على الـ motion.section حتى يقيس useScroll بالنسبة للهيرو كما في التصميم الأصلي */}
      <motion.section
        ref={containerRef}
        style={{ opacity, scale }}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
      >
        {/* Animated background grid */}
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
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-6"
            >
              <Star className="w-4 h-4 text-white" />
              <span className="text-sm text-gray-400">Professional Test Preparation</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              <span className="text-white">Master the </span>
              <span className="text-white border-b-4 border-white pb-2">
                STEP English Test
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Experience a real test simulator with detailed explanations for every question.
              Prepare with confidence and achieve your target score.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex gap-4 justify-center flex-wrap"
            >
              <Button
                size="lg"
                onClick={() => {
                  setShowPlansInDialog(false)
                  setIsSignUpOpen(true)
                }}
                className="bg-white text-black hover:bg-gray-200 transition-all transform hover:scale-105 text-lg px-8 py-6"
              >
                Start Your Journey
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="border-[#2a2a2a] text-white hover:bg-[#1a1a1a] text-lg px-8 py-6"
                onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}
              >
                View Pricing
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-[#2a2a2a] rounded-full flex justify-center pt-2"
          >
            <motion.div
              className="w-1.5 h-1.5 bg-white rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section className="py-32 relative border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Why Choose Our Platform?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Experience the most comprehensive STEP test preparation
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: BookOpen,
                title: 'Real Test Simulator',
                description: 'Practice with authentic test conditions and interface that mirrors the actual STEP exam',
                delay: 0.2
              },
              {
                icon: Brain,
                title: 'Detailed Explanations',
                description: 'Understand every question with comprehensive explanations that help you learn from mistakes',
                delay: 0.4
              },
              {
                icon: Trophy,
                title: 'Track Your Progress',
                description: 'Monitor your improvement with detailed analytics and personalized performance insights',
                delay: 0.6
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: feature.delay }}
                viewport={{ once: true }}
                whileHover={{
                  y: -10,
                  transition: { duration: 0.3 }
                }}
              >
                <Card className="bg-[#141414] border-[#2a2a2a] hover:border-white transition-all duration-300 h-full">
                  <CardHeader>
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                      className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4"
                    >
                      <feature.icon className="w-8 h-8 text-black" />
                    </motion.div>
                    <CardTitle className="text-2xl text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-400 text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 border-t border-[#1a1a1a]">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Select the perfect plan for your STEP test preparation journey
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Basic',
                price: 75,
                description: 'Essential tools for STEP preparation',
                features: [
                  'Real test simulator access',
                  'Basic explanations for answers',
                  'Progress tracking',
                  'Standard support'
                ],
                popular: false,
                delay: 0.2
              },
              {
                name: 'Premium',
                price: 85,
                description: 'Complete preparation package',
                features: [
                  'Full test simulator access',
                  'Detailed explanations for every question',
                  'Advanced analytics & insights',
                  'Priority support',
                  'Personalized study plan',
                  'Unlimited practice tests'
                ],
                popular: true,
                delay: 0.4
              }
            ].map((plan) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: plan.delay }}
                viewport={{ once: true }}
                whileHover={{
                  scale: 1.05,
                  transition: { duration: 0.3 }
                }}
              >
                <Card className={`relative overflow-hidden h-full ${plan.popular ? 'bg-white border-white' : 'bg-[#141414] border-[#2a2a2a]'}`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-black text-white px-4 py-1 text-sm font-semibold">
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  <CardHeader className="pt-8">
                    <CardTitle className={`text-3xl ${plan.popular ? 'text-black' : 'text-white'}`}>
                      {plan.name}
                    </CardTitle>
                    <CardDescription className={plan.popular ? 'text-gray-600' : 'text-gray-400'}>
                      {plan.description}
                    </CardDescription>

                    <div className="mt-6">
                      <span className={`text-5xl font-bold ${plan.popular ? 'text-black' : 'text-white'}`}>
                        ﷼{plan.price}
                      </span>
                      <span className={`ml-2 ${plan.popular ? 'text-gray-600' : 'text-gray-400'}`}>
                        / 50 days
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    <ul className="space-y-4">
                      {plan.features.map((feature, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: plan.delay + 0.1 * index }}
                          viewport={{ once: true }}
                          className="flex items-start gap-3"
                        >
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${plan.popular ? 'bg-black' : 'bg-white'}`}>
                            <Check className={`w-4 h-4 ${plan.popular ? 'text-white' : 'text-black'}`} />
                          </div>
                          <span className={plan.popular ? 'text-gray-700' : 'text-gray-400'}>
                            {feature}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="pt-6">
                    <Button
                      className={`w-full transition-all transform hover:scale-105 ${plan.popular ? 'bg-black text-white hover:bg-gray-900' : 'bg-white text-black hover:bg-gray-200'}`}
                      size="lg"
                      onClick={() => {
                        setFormData({ ...formData, plan: plan.name.toLowerCase() })
                        setShowPlansInDialog(true)
                        setIsSignUpOpen(true)
                      }}
                    >
                      Get Started
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto bg-white rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
          >
            <div className="relative z-10">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-bold text-black mb-6"
              >
                Ready to Ace Your STEP Test?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto"
              >
                Join hundreds of students who have improved their scores with our comprehensive preparation platform
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
              >
                <Button
                  size="lg"
                  onClick={() => {
                    setShowPlansInDialog(true)
                    setIsSignUpOpen(true)
                  }}
                  className="bg-black text-white hover:bg-gray-900 transition-all transform hover:scale-105 text-lg px-10 py-6"
                >
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
            <div className="text-2xl font-bold text-white mb-4">
              STEP English
            </div>
            <p className="text-gray-400">
              © 2025 STEP English Test Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Sign Up Dialog */}
      <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Start Your Journey</DialogTitle>
            <DialogDescription className="text-gray-400">
              Sign up now and begin your STEP test preparation
            </DialogDescription>
            {showPlansInDialog && (
              <div className="text-gray-300 mt-4">
                جرب الاختبار التجريبي قبل ماتشترك
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-white"
              />
            </div>

            {showPlansInDialog && (
              <div className="space-y-2">
                <Label className="text-white">Selected Plan</Label>
                <div className="flex gap-4">
                  {['basic', 'premium'].map((planType) => (
                    <button
                      key={planType}
                      type="button"
                      onClick={() => setFormData({ ...formData, plan: planType })}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        formData.plan === planType
                          ? 'border-white bg-white/10'
                          : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                      }`}
                    >
                      <div className="font-semibold text-white capitalize">{planType}</div>
                      <div className="text-2xl font-bold text-white">
                        {planType === 'basic' ? '﷼75' : '﷼85'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-gray-200 transition-colors"
              size="lg"
            >
              Complete Sign Up
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
