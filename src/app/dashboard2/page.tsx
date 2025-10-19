'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Play,
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
    progress: { reading: 0, writing: 0, speaking: 0, listening: 0 },
  })

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    try {
      // 1) المستخدم
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user || null

      let name = 'طالب'
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (profile?.full_name) name = profile.full_name
      }

      // 2) الاختبارات
      const { data: tests } = await supabase
        .from('tests')
        .select('id, title, description, created_at')
        .order('created_at', { ascending: false })

      // 3) المحاولات والنتائج للمستخدم الحالي
      // لو ما في مستخدم، نعرض بيانات فارغة
      let attempts: any[] = []
      let results: any[] = []
      if (user) {
        const { data: userAttempts } = await supabase
          .from('test_attempts')
          .select('id, test_id, started_at, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })

        const { data: userResults } = await supabase
          .from('user_results')
          .select('attempt_id, score, total_questions, percentage, created_at')

        attempts = userAttempts || []
        results = userResults || []
      }

      // 4) ربط المحاولات الأخيرة بالاختبارات
      const recentCompleted = attempts
        .filter(a => !!a.completed_at)
        .slice(0, 4)

      const recentTests = recentCompleted.map(a => {
        const test = tests?.find(t => t.id === a.test_id)
        const result = results?.find(r => r.attempt_id === a.id)
        return {
          id: a.id,
          name: test?.title || 'اختبار',
          score: result?.percentage ?? 0,
          date: a.completed_at ? a.completed_at.split('T')[0] : '',
          status: 'completed',
        }
      })

      // 5) حساب متوسط الدرجات
      const averageScore =
        results.length > 0
          ? Math.round(
              results.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) /
                results.length
            )
          : 0

      // 6) حساب سلسلة الإنجاز (currentStreak) من test_attempts
      const currentStreak = computeCurrentStreak(attempts)

      // 7) تقدّم المهارات (تقدير مبدئي إن أردت تقسيم حسب نوع الفصل)
      // بإمكاننا لاحقًا ربطها من user_results أو question_attempts حسب النوع
      const progress = {
        reading: estimateSkillProgress(results, 'reading'),
        writing: estimateSkillProgress(results, 'grammar'), // كبديل للـ writing الآن
        speaking: 0, // لا يوجد بيانات واضحة في الـ schema
        listening: estimateSkillProgress(results, 'listening'),
      }

      setStudentData({
        name,
        totalTests: tests?.length || 0,
        completedTests: recentCompleted.length,
        averageScore,
        studyHours: 0, // تحتاج منطق/جدول خاص إن أردت تتبع الوقت
        currentStreak,
        recentTests,
        upcomingTasks: [], // غير موجودة في الـ schema. أضف جدول tasks إن رغبت.
        progress,
      })
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div>
          <div className="w-12 h-12 border-4 border-[#2a2a2a] border-t-primary-gh rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  // ---------- Sidebar ----------
  const Sidebar = () => (
    <motion.div
      initial={{ x: -250 }}
      animate={{ x: sidebarOpen ? 0 : -250 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] z-50 p-4 flex flex-col"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-primary-gh">EduTrack</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(false)}
          className="text-white hover:bg-[#2a2a2a]"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-grow space-y-2">
        <SidebarItem icon={Home} label="Dashboard" isActive />
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

  const SidebarItem = ({ icon: Icon, label, isActive = false }) => (
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

  // ---------- Main ----------
  const MainContent = () => (
    <div className={`flex-grow p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">مرحباً، {studentData.name}</h2>
        <Button
          onClick={() => setSidebarOpen(true)}
          variant="ghost"
          size="icon"
          className="text-white hover:bg-[#2a2a2a] md:hidden"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      {/* Stats */}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <CardHeader>
                <CardTitle>آخر النشاطات</CardTitle>
                <CardDescription className="text-gray-400">آخر 4 اختبارات مكتملة</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {studentData.recentTests.length === 0 ? (
                    <li className="text-gray-400">لا توجد اختبارات مكتملة بعد.</li>
                  ) : (
                    studentData.recentTests.map(test => (
                      <li key={test.id} className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0">
                        <div className="flex items-center">
                          <Play className="h-5 w-5 text-primary-gh mr-3" />
                          <div>
                            <p className="font-medium">{test.name}</p>
                            <p className="text-sm text-gray-400">{test.date}</p>
                          </div>
                        </div>
                        <span className={`font-bold ${test.score >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>{Math.round(test.score)}%</span>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <CardHeader>
                <CardTitle>المهام القادمة</CardTitle>
                <CardDescription className="text-gray-400">مهام وامتحانات قادمة</CardDescription>
              </CardHeader>
              <CardContent>
                {studentData.upcomingTasks.length === 0 ? (
                  <p className="text-gray-500">لا توجد مهام قادمة. أضف جدول tasks إن رغبت.</p>
                ) : (
                  <ul className="space-y-4">
                    {studentData.upcomingTasks.map(task => (
                      <li key={task.id} className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0">
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 text-blue-400 mr-3" />
                          <div>
                            <p className="font-medium">{task.name}</p>
                            <p className="text-sm text-gray-400">{task.date}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold bg-[#2a2a2a] px-2 py-1 rounded-full text-gray-300">{task.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProgressCard title="Reading Skills" progress={studentData.progress.reading} />
            <ProgressCard title="Writing Skills" progress={studentData.progress.writing} />
            <ProgressCard title="Speaking Skills" progress={studentData.progress.speaking} />
            <ProgressCard title="Listening Skills" progress={studentData.progress.listening} />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
            <CardHeader>
              <CardTitle>جميع المهام والامتحانات</CardTitle>
              <CardDescription className="text-gray-400">أضف جدول tasks لعرض التفاصيل هنا</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">
                يمكنك إنشاء جدول tasks وإدارته (name, type, due_date) وربطه بالمستخدمين.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500 mt-1">آخر 30 يوم</p>
      </CardContent>
    </Card>
  )

  const ProgressCard = ({ title, progress }) => (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <Progress value={progress} className="w-full h-3 bg-[#2a2a2a]" />
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {progress < 50 ? 'Needs improvement' : progress < 80 ? 'Good progress' : 'Excellent!'}
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <Sidebar />
      <MainContent />
    </div>
  )
}

/* ---------------- Helpers ---------------- */

// يحسب سلسلة الإنجاز بناءً على الأيام المتتالية التي فيها completed_at
function computeCurrentStreak(attempts: any[]): number {
  if (!attempts || attempts.length === 0) return 0
  // نأخذ فقط المحاولات المكتملة ونحوّلها إلى تواريخ يومية (YYYY-MM-DD)
  const days = Array.from(
    new Set(
      attempts
        .filter(a => !!a.completed_at)
        .map(a => a.completed_at.split('T')[0])
    )
  ).sort((a, b) => (a > b ? -1 : 1)) // تنازلياً: اليوم الأحدث أولاً

  if (days.length === 0) return 0

  let streak = 0
  let current = new Date(days[0]) // أحدث يوم
  const today = new Date()
  // لو أحدث يوم هو اليوم أو أمس، نبدأ العد. غير ذلك، السلسلة صفر
  const isToday =
    current.toDateString() === today.toDateString()
  const isYesterday =
    new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString() ===
    current.toDateString()
  if (!isToday && !isYesterday) return 0

  streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diff = Math.round(
      (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000)
    )
    if (diff === 1) {
      streak += 1
    } else {
      break
    }
  }
  return streak
}

// تقدير بسيط لتقدم المهارة اعتماداً على نوع الفصل/الأسئلة (placeholder)
// حالياً نستخدم نوعاً تقريبيًا: reading/listening/grammar من الـ schema
function estimateSkillProgress(results: any[], kind: 'reading' | 'listening' | 'grammar'): number {
  if (!results || results.length === 0) return 0
  // بدون ربط مباشر بين النتيجة ونوع المهارة، سنستخدم المتوسط العام مؤقتاً
  // بإمكاننا تحسين هذا لاحقاً بربط attempts بـ chapters.type
  const avg =
    Math.round(
      results.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / results.length
    ) || 0
  return avg
}
