'use client'

import { useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, BookOpen, Brain, Trophy, ArrowRight, Target, Clock, Star, Zap } from 'lucide-react'
import { useRef } from 'react'

export default function Landing2() {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', plan: 'basic' })
  const containerRef = useRef(null)
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  })
  
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
    window.location.href = '/dashboard2'
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0a]">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-[#2a2a2a]"
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-bold text-white"
          >
            Project Name
          </motion.div>
          <div className="flex space-x-6 items-center">
            {/* Navigation Links */}
            <a href="#features" className="text-gray-300 hover:text-white transition duration-300">Features</a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition duration-300">Pricing</a>
            <a href="#contact" className="text-gray-300 hover:text-white transition duration-300">Contact</a>
            <Button 
              onClick={() => setIsSignUpOpen(true)}
              className="bg-primary-gh hover:bg-primary-gh/90 text-white font-bold py-2 px-4 rounded-full transition duration-300 shadow-lg hover:shadow-primary-gh/50"
            >
              Get Started
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.header 
        style={{ opacity, scale }}
        className="pt-32 pb-20 text-center relative z-10"
      >
        <div className="container mx-auto px-6">
          <h1 className="text-6xl font-extrabold text-white mb-6 leading-tight">
            The <span className="text-primary-gh">Future</span> of Learning is Here
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto">
            Unlock your potential with our AI-powered platform. Personalized paths, expert insights, and a community to support your growth.
          </p>
          <Button 
            onClick={() => setIsSignUpOpen(true)}
            className="bg-primary-gh hover:bg-primary-gh/90 text-white font-bold py-3 px-8 text-lg rounded-full transition duration-300 shadow-xl hover:shadow-primary-gh/50 transform hover:scale-105"
          >
            Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </motion.header>

      {/* Main Content (Features, Pricing, etc.) */}
      <div className="relative z-20 bg-[#0a0a0a]">
        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="container mx-auto px-6">
            <h2 className="text-4xl font-bold text-center text-white mb-16">
              Features Designed for <span className="text-secondary-gh">Success</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <FeatureCard 
                icon={Brain} 
                title="AI-Powered Personalization" 
                description="Our intelligent engine adapts to your learning style, ensuring maximum retention and efficiency."
              />
              <FeatureCard 
                icon={Trophy} 
                title="Gamified Learning Paths" 
                description="Stay motivated with challenges, badges, and leaderboards. Make learning an exciting journey."
              />
              <FeatureCard 
                icon={BookOpen} 
                title="Vast Content Library" 
                description="Access thousands of courses, articles, and resources curated by industry experts."
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-[#121212]">
          <div className="container mx-auto px-6">
            <h2 className="text-4xl font-bold text-center text-white mb-16">
              Simple, Transparent <span className="text-primary-gh">Pricing</span>
            </h2>
            <div className="flex flex-col md:flex-row justify-center space-y-8 md:space-y-0 md:space-x-8">
              <PricingCard 
                plan="Basic"
                price="$9"
                features={['Access to core courses', 'Community support', 'Monthly progress reports']}
                isFeatured={false}
                onSelect={() => { setFormData(prev => ({ ...prev, plan: 'basic' })); setIsSignUpOpen(true); }}
              />
              <PricingCard 
                plan="Pro"
                price="$29"
                features={['All Basic features', 'Advanced AI insights', '1:1 Expert sessions', 'Priority support']}
                isFeatured={true}
                onSelect={() => { setFormData(prev => ({ ...prev, plan: 'pro' })); setIsSignUpOpen(true); }}
              />
              <PricingCard 
                plan="Enterprise"
                price="Custom"
                features={['All Pro features', 'Dedicated account manager', 'Custom integrations', 'Team analytics dashboard']}
                isFeatured={false}
                onSelect={() => { setFormData(prev => ({ ...prev, plan: 'enterprise' })); setIsSignUpOpen(true); }}
              />
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to <span className="text-secondary-gh">Transform</span> Your Future?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join thousands of learners who are already ahead of the curve.
            </p>
            <Button 
              onClick={() => setIsSignUpOpen(true)}
              className="bg-primary-gh hover:bg-primary-gh/90 text-white font-bold py-3 px-8 text-lg rounded-full transition duration-300 shadow-xl hover:shadow-primary-gh/50 transform hover:scale-105"
            >
              Get Started Now
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-[#2a2a2a]">
          <div className="container mx-auto px-6 text-center text-gray-500">
            <p>&copy; {new Date().getFullYear()} Project Name. All rights reserved.</p>
            <div className="flex justify-center space-x-6 mt-4">
              <a href="#" className="hover:text-white transition duration-300">Privacy Policy</a>
              <a href="#" className="hover:text-white transition duration-300">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>

      {/* Sign Up Dialog */}
      <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Sign Up for {formData.plan} Plan</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your details below to get started with the {formData.plan} plan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right text-gray-300">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3 bg-[#2a2a2a] border-[#3a3a3a] text-white"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3 bg-[#2a2a2a] border-[#3a3a3a] text-white"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="plan" className="text-right text-gray-300">
                Plan
              </Label>
              <Input
                id="plan"
                value={formData.plan}
                className="col-span-3 bg-[#2a2a2a] border-[#3a3a3a] text-white cursor-not-allowed"
                readOnly
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary-gh hover:bg-primary-gh/90 text-white font-bold py-2 rounded-lg transition duration-300 mt-4"
            >
              Sign Up
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const FeatureCard = ({ icon: Icon, title, description }) => (
  <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white shadow-xl hover:shadow-2xl transition duration-500 transform hover:scale-[1.02]">
    <CardHeader className="flex flex-row items-center space-x-4">
      <div className="p-3 rounded-full bg-primary-gh/20 text-primary-gh">
        <Icon className="h-6 w-6" />
      </div>
      <CardTitle className="text-xl font-bold text-white">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-gray-400">
        {description}
      </CardDescription>
    </CardContent>
  </Card>
)

const PricingCard = ({ plan, price, features, isFeatured, onSelect }) => (
  <Card className={`w-full max-w-sm ${isFeatured ? 'bg-[#1a1a1a] border-primary-gh shadow-2xl scale-105' : 'bg-[#121212] border-[#2a2a2a]'} text-white transition duration-500 hover:shadow-primary-gh/50`}>
    <CardHeader className="text-center">
      <CardTitle className={`text-3xl font-bold ${isFeatured ? 'text-primary-gh' : 'text-white'}`}>{plan}</CardTitle>
      <CardDescription className="text-gray-400 mt-2">
        {plan === 'Enterprise' ? 'Contact us for a custom quote' : 'Billed monthly'}
      </CardDescription>
    </CardHeader>
    <CardContent className="text-center">
      <p className="text-5xl font-extrabold text-white mb-6">
        {price === 'Custom' ? price : `${price}/mo`}
      </p>
      <ul className="space-y-3 text-gray-300 text-left">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center">
            <Check className="h-5 w-5 text-primary-gh mr-3" />
            {feature}
          </li>
        ))}
      </ul>
    </CardContent>
    <CardFooter className="pt-6">
      <Button 
        onClick={onSelect}
        className={`w-full font-bold py-2 rounded-lg transition duration-300 ${isFeatured ? 'bg-primary-gh hover:bg-primary-gh/90 text-white shadow-lg' : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white'}`}
      >
        {plan === 'Enterprise' ? 'Contact Sales' : 'Choose Plan'}
      </Button>
    </CardFooter>
  </Card>
)
