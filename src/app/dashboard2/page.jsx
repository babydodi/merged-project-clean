'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  BookOpen,
  Trophy,
  Clock,
  Target,
  Play,
  CheckCircle2,
  Calendar,
  Activity,
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
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

  async function init() {
    try {
      // 1) احصل على المستخدم
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user || null

      // 2) جلب الاسم من جدول users
      let name = 'طالب'
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (profile?.full_name) name = profile.full_name
      }

      // 3) جلب كل الاختبارات
      const { data: tests } = await supabase
        .from('tests')
        .select('id, title, description, created_at')
        .order('created_at', { ascending: false })

      // 4) جلب المحاولات والنتائج للمستخدم
      let attempts = []
      let results = []
      if (user) {
        const { data: userAttempts } = await supabase
          .from('test_attempts')
          .select('id, test_id, started_at, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })

        const { data: userResults } = await supabase
          .from('user_results')
          .select('attempt_id, percentage')

        attempts = userAttempts || []
        results = userResults || []
      }

      // 5) ربط آخر 4 محاولات مكتملة مع بيانات الاختبارات
      const recentCompleted = attempts.filter(a => a.completed_at).slice(0, 4)
      const recentTests = recentCompleted.map(a => {
        const t = tests?.find(x => x.id === a.test_id)
        const r = results.find(x => x.attempt_id === a.id)
        return {
          id: a.id,
          name: t?.title || 'اختبار',
          score: r?.percentage || 0,
          date: a.completed_at.split('T')[0],
        }
      })

      // 6) حساب متوسط الدرجات
      const averageScore = results.length
        ? Math.round(
            results.reduce((sum, r) => sum + Number(r.percentage || 0), 0) /
              results.length
          )
        : 0

      // 7) سلسلة الإنجاز
      const currentStreak = computeCurrentStreak(attempts)

      // 8) تقدّم المهارات
      const progress = {
        reading: estimateSkillProgress(results),
        writing: estimateSkillProgress(results),
        speaking: 0,
        listening: estimateSkillProgress(results),
      }

      setStudentData({
        name,
        totalTests: tests?.length || 0,
        completedTests: recentCompleted.length,
        averageScore,
        studyHours: 0, // لو عندك جدول تتبع الوقت
        currentStreak,
        recentTests,
        upcomingTasks: [], // إذا أضفت جدول tasks لاحقًا
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
          <div className="w-12 h-12 border-4 border-[#2a2a2a] border-t-primary-gh rounded-full animate-spin mx-auto mb-4" />
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
      className="fixed top-0 left-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] p-4 flex flex-col z-50"
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
      className={`flex items-center p-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary-gh text-white shadow-lg'
          : 'text-gray-300 hover:bg-[#2a2a2a] hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 mr-3" />
      <span>{label}</span>
    </a>
  )

  // ---------- MainContent ----------
  const MainContent = () => (
    <div
      className={`flex-grow p-8 transition-all duration-300 ${
        sidebarOpen ? 'ml-64' : 'ml-0'
      }`}
    >
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">
          مرحباً، {studentData.name}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-white hover:bg-[#2a2a2a] md:hidden"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Trophy}
          title="متوسط الدرجات"
          value={`${studentData.averageScore}%`}
          color="text-green-400"
        />
        <StatCard
          icon={Clock}
          title="ساعات المذاكرة"
          value={`${studentData.studyHours}`}
          color="text-blue-400"
        />
        <StatCard
          icon={CheckCircle2}
          title="اختبارات مكتملة"
          value={`${studentData.completedTests}/${studentData.totalTests}`}
          color="text-yellow-400"
        />
        <StatCard
          icon={Zap}
          title="سلسلة الإنجاز"
          value={`${studentData.currentStreak} أيام`}
          color="text-red-400"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-[#2a2a2a] text-white">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-primary-gh data-[state=active]:text-white"
          >
            النظرة العامة
          </TabsTrigger>
          <TabsTrigger
            value="progress"
            className="data-[state=active]:bg-primary-gh data-[state=active]:text-white"
          >
            التقدم
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="data-[state=active]:bg-primary-gh data-[state=active]:text-white"
          >
            المهام
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <CardHeader>
                <CardTitle>آخر النشاطات</CardTitle>
                <CardDescription className="text-gray-400">
                  آخر 4 اختبارات مكتملة
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {studentData.recentTests.length === 0 ? (
                    <li className="text-gray-400">
                      لا توجد اختبارات مكتملة بعد.
                    </li>
                  ) : (
                    studentData.recentTests.map(test => (
                      <li
                        key={test.id}
                        className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <Play className="h-5 w-5 text-primary-gh mr-3" />
                          <div>
                            <p className="font-medium">{test.name}</p>
                            <p className="text-sm text-gray-400">
                              {test.date}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-bold ${
                            test.score >= 80
                              ? 'text-green-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {Math.round(test.score)}%
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <CardHeader>
                <CardTitle>المهام القادمة</CardTitle>
                <CardDescription className="text-gray-400">
                  مهام وامتحانات قادمة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studentData.upcomingTasks.length === 0 ? (
                  <p className="text-gray-500">
                    لا توجد مهام قادمة. أضف جدول tasks إن رغبت.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {studentData.upcomingTasks.map(task => (
                      <li
                        key={task.id}
                        className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 text-blue-400 mr-3" />
                          <div>
                            <p className="font-medium">{task.name}</p>
                            <p className="text-sm text-gray-400">{task.date}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold bg-[#2a2a2a] px-2 py-1 rounded-full text-gray-300">
                          {task.type}
                        </span>
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
            <ProgressCard
              title="Reading Skills"
              progress={studentData.progress.reading}
            />
            <ProgressCard
              title="Writing Skills"
              progress={studentData.progress.writing}
            />
            <ProgressCard
              title="Speaking Skills"
              progress={studentData.progress.speaking}
            />
            <ProgressCard
              title="Listening Skills"
              progress={studentData.progress.listening}
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
            <CardHeader>
              <CardTitle>جميع المهام والامتحانات</CardTitle>
              <CardDescription className="text-gray-400">
                أضف جدول tasks لعرض التفاصيل هنا
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">
                يمكنك إنشاء جدول tasks وإدارته وربطه بالمستخدمين.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
      <CardHeader className="flex items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">
          {title}
        </CardTitle>
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
          {progress < 50
            ? 'Needs improvement'
            : progress < 80
            ? 'Good progress'
            : 'Excellent!'}
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

function computeCurrentStreak(attempts) {
  if (!attempts || attempts.length === 0) return 0
  const days = Array.from(
    new Set(
      attempts
        .filter(a => a.completed_at)
        .map(a => a.completed_at.split('T')[0])
    )
  ).sort((a, b) => (a > b ? -1 : 1))
  if (!days.length) return 0

  let streak = 0
  const today = new Date()
  let prevDate = new Date(days[0])
  const isTodayOrYesterday =
    prevDate.toDateString() === today.toDateString() ||
    prevDate.toDateString() ===
      new Date(today.getTime() - 864e5).toDateString()
  if (!isTodayOrYesterday) return 0

  streak = 1
  for (let i = 1; i < days.length; i++) {
    const curr = new Date(days[i])
    if (
      (prevDate.getTime() - curr.getTime()) / 864e5 ===
      1
    ) {
      streak++
      prevDate = curr
    } else {
      break
    }
  }
  return streak
}

function estimateSkillProgress(results) {
  if (!results || !results.length) return 0
  const sum = results.reduce((s, r) => s + Number(r.percentage || 0), 0)
  return Math.round(sum / results.length)
}
