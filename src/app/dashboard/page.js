'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/buttonn'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, CheckCircle2, Trophy, Clock, Zap, BookOpen, Clock as ClockIcon, Home, Settings, LogOut, Menu, X, BarChart3 } from 'lucide-react'

export default function Dashboard() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Single source of truth for fetched data
  // مصدر واحد للبيانات المجلوبة
  const [userProfile, setUserProfile] = useState({ id: '', full_name: '', role: '' })
  const [tests, setTests] = useState([]) // from public.tests  // من جدول tests
  const [attempts, setAttempts] = useState([]) // from public.test_attempts  // من جدول test_attempts
  const [results, setResults] = useState([]) // from public.user_results  // من جدول user_results

  // Derived UI model to fit your current design
  // نموذج واجهة مبني من البيانات لتوافق التصميم الحالي
  const studentData = useMemo(() => {
    const name = userProfile.full_name || ''
    const totalTests = tests.length
    const completedTests = attempts.filter(a => !!a.completed_at).length
    const averageScore = results.length
      ? Math.round(results.reduce((s, r) => s + (Number(r.percentage) || 0), 0) / results.length)
      : 0
    const studyHours = 0 // No study hours column yet  // لا يوجد عمود لساعات الدراسة الآن
    const currentStreak = 0 // Could be derived from user_activity later // ممكن لاحقاً عبر user_activity
    const recentTests = results
      .slice(0, 4)
      .map(r => {
        const a = attempts.find(x => x.id === r.attempt_id)
        const t = tests.find(tt => tt.id === a?.test_id)
        return {
          id: r.id,
          name: t?.title || `Attempt ${r.attempt_id}`, // عنوان الاختبار أو محاولة
          score: Number(r.percentage) || 0,
          date: r.created_at?.slice(0, 10) || '',
        }
      })

    // Available tests: reshape for UI
    // الاختبارات المتاحة: إعادة تشكيل لتوافق الواجهة
    const availableTests = tests.map(t => ({
      id: t.id,
      name: t.title,
      questions: '—', // not in schema  // غير متوفر في المخطط
      duration: '—', // not in schema  // غير متوفر في المخطط
      difficulty: t.availability, // show availability as a badge // نعرض availability كوسم
    }))
    return {
      name,
      totalTests,
      completedTests,
      averageScore,
      studyHours,
      currentStreak,
      recentTests,
      availableTests,
    }
  }, [userProfile, tests, attempts, results])

  const stats = [
    { title: 'Tests Completed / المكتمل', value: studentData.completedTests, total: studentData.totalTests, icon: CheckCircle2, change: '' },
    { title: 'Average Score / المتوسط', value: `${studentData.averageScore}%`, icon: Trophy, change: '' },
    { title: 'Study Hours / ساعات الدراسة', value: studentData.studyHours, icon: Clock, change: '' },
    { title: 'Current Streak / السلسلة الحالية', value: `${studentData.currentStreak} days`, icon: Zap, change: '' }
  ]

  useEffect(() => {
    const loadData = async () => {
      if (!session?.user?.id) return
      setLoading(true)
      setError('')
      try {
        const userId = session.user.id

        // users: id, full_name, role
        // جلب بيانات المستخدم الأساسية
        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('id', userId)
          .single()
        if (userErr) throw userErr
        setUserProfile(user || { id: userId, full_name: '', role: '' })

        // tests: published only
        // جلب الاختبارات المنشورة فقط
        const { data: testsData, error: testsErr } = await supabase
          .from('tests')
          .select('id, title, description, availability, is_published, created_at')
          .eq('is_published', true)
        if (testsErr) throw testsErr
        setTests(testsData || [])

        // attempts: latest 10 for this user
        // محاولات الاستخدام: آخر 10 محاولات للمستخدم
        const { data: attemptsData, error: attemptsErr } = await supabase
          .from('test_attempts')
          .select('id, test_id, started_at, completed_at, current_chapter_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        if (attemptsErr) throw attemptsErr
        setAttempts(attemptsData || [])

        // results for those attempts
        // نتائج تلك المحاولات
        const attemptIds = (attemptsData || []).map(a => a.id)
        if (attemptIds.length) {
          const { data: resData, error: resultsErr } = await supabase
            .from('user_results')
            .select('id, attempt_id, score, total_questions, percentage, created_at')
            .in('attempt_id', attemptIds)
          if (resultsErr) throw resultsErr
          setResults(resData || [])
        } else {
          setResults([])
        }
      } catch (err) {
        console.error('dashboard fetch error', err)
        setError(err.message || 'Failed to load dashboard / فشل تحميل لوحة التحكم')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [session, supabase])

  // Sidebar items with navigation
  const sidebarItems = [
    { icon: Home, label: 'Dashboard / لوحة التحكم', action: () => router.push('/') , active: true },
    { icon: BookOpen, label: 'My Tests / اختباراتى', action: () => router.push('/test/') , active: false },
    { icon: BarChart3, label: 'Analytics / تحليلات', action: () => router.push('/analytics') , active: false },
    { icon: ClockIcon, label: 'Schedule / الجدول', action: () => router.push('/schedule') , active: false },
    { icon: Settings, label: 'Settings / الإعدادات', action: () => router.push('/settings') , active: false },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Sidebar / الشريط الجانبي */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className="fixed left-0 top-0 h-screen w-64 bg-[#141414] border-r border-[#2a2a2a] z-40"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">STEP English / ستب إنجليش</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item, index) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  item.active
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </motion.button>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <Button
            variant="outline"
            className="w-full border-[#2a2a2a] text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout / تسجيل خروج
          </Button>
        </div>
      </motion.aside>

      {/* Mobile Menu Button / زر القائمة في الجوال */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className={`fixed top-4 left-4 z-30 lg:hidden ${sidebarOpen ? 'hidden' : 'block'} text-gray-400`}
      >
        <Menu className="w-6 h-6" />
      </Button>

      {/* Main Content / المحتوى الرئيسي */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Header / رأس الصفحة */}
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#141414]/80 backdrop-blur-lg border-b border-[#2a2a2a] sticky top-0 z-30"
        >
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {loading ? 'Loading... / جارٍ التحميل...' : `Welcome back / مرحبًا${studentData.name ? `, ${studentData.name}` : '!' }`}
                </h1>
                <p className="text-gray-400">
                  Role / الدور: {userProfile.role || '—'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Today's Progress / تقدم اليوم</div>
                  <div className="text-lg font-bold text-white">—</div>
                </div>
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black font-bold text-lg">
                  {studentData.name ? studentData.name.charAt(0).toUpperCase() : 'S'}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Dashboard Content / محتوى الصفحة */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {loading && (
            <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-700 px-3 py-2 text-sm">
              Loading... / جارٍ التحميل...
            </div>
          )}

          {/* Stats Grid / شبكة الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <Card className="bg-[#141414] border-[#2a2a2a] overflow-hidden relative hover:border-[#3a3a3a] transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-400">
                        {stat.title}
                      </CardTitle>
                      <div className="p-2 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                        <stat.icon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div className="text-3xl font-bold text-white">{stat.value}</div>
                      {stat.total ? (
                        <div className="text-sm text-gray-500">/ {stat.total}</div>
                      ) : null}
                    </div>
                    {stat.change && (
                      <div className="mt-2 text-sm text-gray-400">{stat.change}</div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Main Content Grid / شبكة المحتوى الرئيسية */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Available Tests / الاختبارات المتاحة */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2"
            >
              <Card className="bg-[#141414] border-[#2a2a2a]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl text-white">Available Tests / الاختبارات المتاحة</CardTitle>
                      <CardDescription className="text-gray-400">Continue your preparation journey / اكمل رحلتك التحضيرية</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2a2a2a] text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                      onClick={() => router.push('/test/')}
                    >
                      View All / عرض الكل
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentData.availableTests.length === 0 ? (
                    <div className="text-gray-400">No tests available yet. / لا توجد اختبارات متاحة حالياً.</div>
                  ) : (
                    studentData.availableTests.map((test, index) => (
                      <motion.div
                        key={test.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        whileHover={{ x: 5, transition: { duration: 0.2 } }}
                        className="p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-2">{test.name}</h4>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                {test.questions} Questions / أسئلة
                              </span>
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-4 h-4" />
                                {test.duration} min / دقيقة
                              </span>
                              <span className="px-2 py-1 rounded-full text-xs border bg-[#1a1a1a] border-[#2a2a2a] text-gray-400">
                                {test.difficulty}
                              </span>
                            </div>
                          </div>
                          <Button className="bg-white text-black hover:bg-gray-200 transition-colors" onClick={() => router.push(`/test/${test.id}`)}>
                            <Play className="w-4 h-4 mr-2" />
                            Start / ابدأ
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Test Results / نتائج الاختبارات الأخيرة */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-[#141414] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Recent Test Results / نتائج الاختبارات الأخيرة</CardTitle>
                  <CardDescription className="text-gray-400">Your latest performance history / أحدث سجل للأداء</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {studentData.recentTests.length === 0 ? (
                      <div className="text-gray-400">No recent tests. / لا توجد اختبارات حديثة.</div>
                    ) : (
                      studentData.recentTests.map((test, index) => (
                        <motion.div
                          key={test.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 + index * 0.1 }}
                          whileHover={{ x: 5, transition: { duration: 0.2 } }}
                          className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${
                              test.score >= 85 ? 'bg-white border-white' : 'bg-[#1a1a1a] border-[#2a2a2a]'
                            }`}>
                              {test.score >= 85 ? (
                                <Trophy className="w-6 h-6 text-black" />
                              ) : (
                                <Play className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{test.name}</h4>
                              <p className="text-sm text-gray-400">{test.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-white">{test.score}%</div>
                            <div className="text-xs text-gray-500">Score / الدرجة</div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Quick Actions simplified: kept as navigation cards or removed per request */}
          {/* Removed: Set Goals, Achievements, Study Plan, Weekly Progress, Strengths, Areas to Improve */}
        </div>
      </div>
    </div>
  )
}
