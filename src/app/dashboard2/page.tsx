'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  Target,
  CheckCircle2,
  Calendar,
  Activity,
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  Play
} from 'lucide-react'

export default function Dashboard2() {
  const supabase = createClientComponentClient()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  const [studentData, setStudentData] = useState({
    name: '',
    totalTests: 0,
    completedTests: 0,
    averageScore: 0,
    studyHours: 0,
    currentStreak: 0,
    recentTests: [],
    upcomingTasks: [],
    progress: { reading: 0, writing: 0, speaking: 0, listening: 0 }
  })

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    try {
      // 1. المستخدم
      const { data: { user } } = await supabase.auth.getUser()
      let name = 'طالب'
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (profile) name = profile.full_name
      }

      // 2. الاختبارات
      const { data: tests } = await supabase
        .from('tests')
        .select('id, title, description, created_at')

      // 3. المحاولات الأخيرة
      const { data: attempts } = await supabase
        .from('test_attempts')
        .select('id, test_id, completed_at')
        .order('completed_at', { ascending: false })
        .limit(4)

      // 4. النتائج
      const { data: results } = await supabase
        .from('user_results')
        .select('attempt_id, score, percentage')

      // ربط المحاولات بالاختبارات
      const recentTests = attempts?.map(a => {
        const test = tests?.find(t => t.id === a.test_id)
        const result = results?.find(r => r.attempt_id === a.id)
        return {
          id: a.id,
          name: test?.title || 'اختبار',
          score: result?.percentage || 0,
          date: a.completed_at?.split('T')[0],
          status: 'completed'
        }
      }) || []

      setStudentData({
        name,
        totalTests: tests?.length || 0,
        completedTests: recentTests.length,
        averageScore: results?.length ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0,
        studyHours: 0, // تحتاج منطق إضافي
        currentStreak: 0, // تحتاج منطق إضافي
        recentTests,
        upcomingTasks: [], // تحتاج جدول tasks لو تبغى
        progress: { reading: 0, writing: 0, speaking: 0, listening: 0 } // ممكن تحسبها من user_results
      })
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-white p-10">جاري التحميل...</div>

  // ---------------- Sidebar ----------------
  const Sidebar = () => (
    <motion.div
      initial={{ x: -250 }}
      animate={{ x: sidebarOpen ? 0 : -250 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] z-50 p-4 flex flex-col"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-primary-gh">EduTrack</h1>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-white hover:bg-[#2a2a2a]">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-grow space-y-2">
        <SidebarItem icon={Home} label="Dashboard" isActive={true} />
        <SidebarItem icon={BookOpen} label="Courses" />
        <SidebarItem icon={Target} label="Goals" />
        <SidebarItem icon={Activity} label="Activity" />
        <SidebarItem icon={Settings} label="Settings" />
      </nav>
      <div className="mt-auto border-t border-[#2a2a2a] pt-4">
        <SidebarItem icon={LogOut} label="Logout" />
      </div>
    </motion.div>
  )

  const SidebarItem = ({ icon: Icon, label, isActive }) => (
    <a 
      href="#" 
      className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
        isActive 
          ? 'bg-primary-gh text-white shadow-lg' 
          : 'text-gray-300 hover:bg-[#2a2a2a] hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 mr-3" />
      <span>{label}</span>
    </a>
  )

  // ---------------- Main Content ----------------
  const MainContent = () => (
    <div className={`flex-grow p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">مرحباً، {studentData.name}</h2>
        <Button onClick={() => setSidebarOpen(true)} variant="ghost" size="icon" className="text-white hover:bg-[#2a2a2a] md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Trophy} title="متوسط الدرجات" value={`${studentData.averageScore}%`} color="text-green-400" />
        <StatCard icon={Clock} title="ساعات المذاكرة" value={`${studentData.studyHours}`} color="text-blue-400" />
        <StatCard icon={CheckCircle2} title="اختبارات مكتملة" value={`${studentData.completedTests}/${studentData.totalTests}`} color="text-yellow-400" />
        <StatCard icon={Zap} title="سلسلة الإنجاز" value={`${studentData.currentStreak} أيام`} color="text-red-400" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-[#2a2a2a] text-white">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">النظرة العامة</TabsTrigger>
          <TabsTrigger value="progress" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">التقدم</TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">المهام</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
            <CardHeader>
              <CardTitle>آخر النشاطات</CardTitle>
              <CardDescription className="text-gray-400">آخر 4 اختبارات مكتملة</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {studentData.recentTests.map(test => (
                  <li key={test.id} className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0">
                    <div className="flex items-center">
                      <Play className="h-5 w-5 text-primary-gh mr-3" />
                      <div>
                        <p className="font-medium">{test.name}</p>
