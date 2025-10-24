'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Progress } from '../../components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
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
import { useRouter } from 'next/navigation'

// ✅ أنواع البيانات
type Role = 'admin' | 'subscriber' | 'unsubscribed'

type Test = {
  id: string
  title: string
  description: string | null
  availability?: string
  is_published?: boolean
  created_at?: string
}

type Attempt = {
  id: string
  test_id: string
  started_at: string
  completed_at: string | null
}

type Result = {
  attempt_id: string
  percentage: number
}

type StudentData = {
  name: string
  totalTests: number
  completedTests: number
  averageScore: number
  studyHours: number
  currentStreak: number
  recentTests: { id: string; name: string; score: number; date: string }[]
  upcomingTasks: { id: string; name: string; date: string; type: string }[]
  progress: { reading: number; writing: number; speaking: number; listening: number }
  tests: { id: string; title: string; description: string | null }[]
}

export default function Dashboard2() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [studentData, setStudentData] = useState<StudentData>({
    name: '',
    totalTests: 0,
    completedTests: 0,
    averageScore: 0,
    studyHours: 0,
    currentStreak: 0,
    recentTests: [],
    upcomingTasks: [],
    progress: { reading: 0, writing: 0, speaking: 0, listening: 0 },
    tests: [],
  })

  useEffect(() => {
    init()
  }, [])

  async function init() {
    try {
      // 1️⃣ الحصول على المستخدم
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user || null

      // 2️⃣ جلب الاسم والدور
      let name = 'طالب'
      let role: Role = 'unsubscribed'

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, role')
          .eq('id', user.id)
          .single()

        if (profile?.full_name) name = profile.full_name
        if (profile?.role && ['admin', 'subscriber', 'unsubscribed'].includes(profile.role))
          role = profile.role as Role
      }

      // 3️⃣ جلب الاختبارات
      let query = supabase
        .from('tests')
        .select('id, title, description, availability, is_published, created_at')
        .order('created_at', { ascending: false })

      if (role !== 'admin') {
        query = query.eq('is_published', true)
      }

      if (role === 'subscriber') {
        query = query.in('availability', ['all', 'subscribers'])
      } else if (role === 'unsubscribed') {
        query = query.eq('availability', 'all')
      }

      const { data: tests } = await query

      // 4️⃣ محاولات المستخدم ونتائجه
      let attempts: Attempt[] = []
      let results: Result[] = []
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

      // 5️⃣ آخر 4 اختبارات مكتملة
      const recentCompleted = attempts.filter(a => a.completed_at).slice(0, 4)
      const recentTests = recentCompleted.map(a => {
        const t = tests?.find(x => x.id === a.test_id)
        const r = results.find(x => x.attempt_id === a.id)
        return {
          id: a.id,
          name: t?.title || 'اختبار',
          score: r?.percentage || 0,
          date: a.completed_at ? a.completed_at.split('T')[0] : '',
        }
      })

      // 6️⃣ متوسط الدرجات
      const averageScore = results.length
        ? Math.round(results.reduce((sum, r) => sum + Number(r.percentage || 0), 0) / results.length)
        : 0

      // 7️⃣ سلسلة الإنجاز
      const currentStreak = computeCurrentStreak(attempts)

      // 8️⃣ تقدّم المهارات
      const progress = {
        reading: estimateSkillProgress(results),
        writing: estimateSkillProgress(results),
        speaking: 0,
        listening: estimateSkillProgress(results),
      }

      // ✅ تحديث الحالة
      setStudentData({
        name,
        totalTests: tests?.length || 0,
        completedTests: recentCompleted.length,
        averageScore,
        studyHours: 0,
        currentStreak,
        recentTests,
        upcomingTasks: [],
        progress,
        tests: (tests || []).map(t => ({
          id: t.id,
          title: t.title,
          description: t.description ?? '',
        })),
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

  // ✅ Sidebar
  const SidebarItem = ({
    icon: Icon,
    label,
    isActive = false,
  }: {
    icon: any
    label: string
    isActive?: boolean
  }) => (
    <a
      href="#"
      className={`flex items-center p-3 rounded-lg transition-colors ${
        isActive ? 'bg-primary-gh text-white shadow-lg' : 'text-gray-300 hover:bg-[#2a2a2a]'
      }`}
    >
      <Icon className="h-5 w-5 mr-3" />
      <span>{label}</span>
    </a>
  )

  const Sidebar = () => (
    <motion.div
      initial={{ x: -250 }}
      animate={{ x: sidebarOpen ? 0 : -250 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] p-4 flex flex-col z-50"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-primary-gh">EduTrack</h1>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-white">
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

  // ✅ مكونات المحتوى
  const StatCard = ({
    icon: Icon,
    title,
    value,
    color,
  }: {
    icon: any
    title: string
    value: string
    color: string
  }) => (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
      <CardHeader className="flex items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500 mt-1">آخر 30 يوم</p>
      </CardContent>
    </Card>
  )

  const ProgressCard = ({ title, progress }: { title: string; progress: number }) => (
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
      <div className={`flex-grow p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white">مرحباً، {studentData.name}</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-white md:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        {/* البطاقات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Trophy} title="متوسط الدرجات" value={`${studentData.averageScore}%`} color="text-green-400" />
          <StatCard icon={Clock} title="ساعات المذاكرة" value={`${studentData.studyHours}`} color="text-blue-400" />
          <StatCard
            icon={CheckCircle2}
            title="اختبارات مكتملة"
            value={`${studentData.completedTests}/${studentData.totalTests}`}
            color="text-yellow-400"
          />
          <StatCard icon={Zap} title="سلسلة الإنجاز" value={`${studentData.currentStreak} أيام`} color="text-red-400" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-[#2a2a2a] text-white">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">
              النظرة العامة
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">
              التقدم
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">
              المهام
            </TabsTrigger>
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
                        <li
                          key={test.id}
                          className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0"
                        >
                          <div className="flex items-center">
                            <Play className="h-5 w-5 text-primary-gh mr-3" />
                            <div>
                              <p className="font-medium">{test.name}</p>
                              <p className="text-sm text-gray-400">{test.date}</p>
                            </div>
                          </div>
                          <span
                            className={`font-bold ${
                              test.score >= 80 ? 'text-green-400' : 'text-yellow-400'
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
                  <CardDescription className="text-gray-400">مهام وامتحانات قادمة</CardDescription>
                </CardHeader>
                <CardContent>
                  {studentData.upcomingTasks.length === 0 ? (
                    <p className="text-gray-500">لا توجد مهام قادمة.</p>
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

            {/* الاختبارات المتاحة */}
            <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white mt-6">
              <CardHeader>
                <CardTitle>📚 الاختبارات المتاحة</CardTitle>
                <CardDescription className="text-gray-400">
                  قائمة الاختبارات التي يمكنك الدخول عليها
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studentData.tests.length === 0 ? (
                  <p className="text-gray-500">لا توجد اختبارات متاحة حالياً</p>
                ) : (
                  <ul className="space-y-3">
                    {studentData.tests.map(test => (
                      <li
                        key={test.id}
                        className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0"
                      >
                        <div>
                          <p className="font-medium">{test.title}</p>
                          {test.description && <p className="text-sm text-gray-400">{test.description}</p>}
                        </div>
                        <Button onClick={() => router.push(`/tests/${test.id}`)} className="bg-primary-gh text-white">
                          ابدأ
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ✅ توابع مساعدة
function computeCurrentStreak(attempts: Attempt[]): number {
  const completed = attempts.filter(a => a.completed_at).map(a => new Date(a.completed_at!))
  completed.sort((a, b) => b.getTime() - a.getTime())

  let streak = 0
  let prevDate: Date | null = null

  for (const d of completed) {
    if (!prevDate) {
      streak = 1
      prevDate = d
    } else {
      const diff = (prevDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      if (diff <= 1.5) {
        streak++
        prevDate = d
      } else break
    }
  }

  return streak
}

function estimateSkillProgress(results: Result[]): number {
  if (!results.length) return 0
  const avg = results.reduce((a, r) => a + Number(r.percentage || 0), 0) / results.length
  return Math.min(100, Math.round(avg))
}
