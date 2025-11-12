'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { Button } from '@/components/ui/buttonr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/carm'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabsu'
import {
  BookOpen,
  Brain,
  Trophy,
  Clock,
  Target,
  Play,
  CheckCircle2,
  BarChart3,
  Calendar,
  Award,
  Activity,
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  Zap
} from 'lucide-react'

export default function Dashboard() {
  const supabase = useSupabaseClient()
  const session = useSession()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Single source of truth for fetched data
  const [userProfile, setUserProfile] = useState({ id: '', full_name: '', role: '' })
  const [tests, setTests] = useState([]) // from public.tests
  const [attempts, setAttempts] = useState([]) // from public.test_attempts
  const [results, setResults] = useState([]) // from public.user_results

  // Derived UI model to fit your current design
  const studentData = useMemo(() => {
    const name = userProfile.full_name || ''
    const totalTests = tests.length
    const completedTests = attempts.filter(a => !!a.completed_at).length
    const averageScore = results.length
      ? Math.round(results.reduce((s, r) => s + (Number(r.percentage) || 0), 0) / results.length)
      : 0
    const studyHours = 0 // لا يوجد عمود لساعات الدراسة في الـ schema الآن
    const currentStreak = 0 // ممكن لاحقاً عبر user_activity
    const recentTests = results
      .slice(0, 4)
      .map(r => {
        const a = attempts.find(x => x.id === r.attempt_id)
        const t = tests.find(tt => tt.id === a?.test_id)
        return {
          id: r.id,
          name: t?.title || `Attempt ${r.attempt_id}`,
          score: Number(r.percentage) || 0,
          date: r.created_at?.slice(0, 10) || '',
        }
      })
    // Weekly progress (بسيط: أول 7 نتائج)
    const weeklyProgress = results.slice(0, 7).map((r, i) => ({
      day: `#${i + 1}`,
      score: Number(r.percentage) || 0,
    }))
    // Available tests: نعيد تشكيل لتتوافق مع تصميمك الحالي
    const availableTests = tests.map(t => ({
      id: t.id,
      name: t.title,
      questions: '—', // غير متوفر في schema الحالي
      duration: '—', // غير متوفر في schema الحالي (قد يُستمد من chapters لاحقاً)
      difficulty: t.availability, // نستخدم availability كوسم ظاهر
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
      weeklyProgress,
    }
  }, [userProfile, tests, attempts, results])

  const stats = [
    { title: 'Tests Completed', value: studentData.completedTests, total: studentData.totalTests, icon: CheckCircle2, change: '' },
    { title: 'Average Score', value: `${studentData.averageScore}%`, icon: Trophy, change: '' },
    { title: 'Study Hours', value: studentData.studyHours, icon: Clock, change: '' },
    { title: 'Current Streak', value: `${studentData.currentStreak} days`, icon: Zap, change: '' }
  ]

  useEffect(() => {
    const loadData = async () => {
      if (!session?.user?.id) return
      setLoading(true)
      setError('')
      try {
        const userId = session.user.id

        // users: id, full_name, role
        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('id', userId)
          .single()
        if (userErr) throw userErr
        setUserProfile(user || { id: userId, full_name: '', role: '' })

        // tests: published only
        const { data: testsData, error: testsErr } = await supabase
          .from('tests')
          .select('id, title, description, availability, is_published, created_at')
          .eq('is_published', true)
        if (testsErr) throw testsErr
        setTests(testsData || [])

        // attempts: latest 10 for this user
        const { data: attemptsData, error: attemptsErr } = await supabase
          .from('test_attempts')
          .select('id, test_id, started_at, completed_at, current_chapter_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        if (attemptsErr) throw attemptsErr
        setAttempts(attemptsData || [])

        // results for those attempts
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
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [session, supabase])

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className="fixed left-0 top-0 h-screen w-64 bg-[#141414] border-r border-[#2a2a2a] z-40"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">STEP English</h2>
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
            {[
              { icon: Home, label: 'Dashboard', active: true },
              { icon: BookOpen, label: 'My Tests', active: false },
              { icon: BarChart3, label: 'Analytics', active: false },
              { icon: Calendar, label: 'Schedule', active: false },
              { icon: Settings, label: 'Settings', active: false },
            ].map((item, index) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
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
            Logout
          </Button>
        </div>
      </motion.aside>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className={`fixed top-4 left-4 z-30 lg:hidden ${sidebarOpen ? 'hidden' : 'block'} text-gray-400`}
      >
        <Menu className="w-6 h-6" />
      </Button>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Header */}
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#141414]/80 backdrop-blur-lg border-b border-[#2a2a2a] sticky top-0 z-30"
        >
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {loading ? 'Loading...' : `Welcome back${studentData.name ? `, ${studentData.name}` : '!' }`}
                </h1>
                <p className="text-gray-400">
                  Role: {userProfile.role || '—'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Today's Progress</div>
                  <div className="text-lg font-bold text-white">—</div>
                </div>
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black font-bold text-lg">
                  {studentData.name ? studentData.name.charAt(0).toUpperCase() : 'S'}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Dashboard Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {loading && (
            <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-700 px-3 py-2 text-sm">
              Loading...
            </div>
          )}

          {/* Stats Grid */}
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

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Available Tests */}
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
                      <CardTitle className="text-2xl text-white">Available Tests</CardTitle>
                      <CardDescription className="text-gray-400">Continue your preparation journey</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2a2a2a] text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentData.availableTests.length === 0 ? (
                    <div className="text-gray-400">No tests available yet.</div>
                  ) : (
                    studentData.availableTests.map((test, index) => (
                      <motion.div
                        key={test.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        whileHover={{ x: 5, transition={{ duration: 0.2 } }}
                        className="p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-2">{test.name}</h4>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                {test.questions} Questions
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {test.duration} min
                              </span>
                              <span className="px-2 py-1 rounded-full text-xs border bg-[#1a1a1a] border-[#2a2a2a] text-gray-400">
                                {test.difficulty}
                              </span>
                            </div>
                          </div>
                          <Button className="bg-white text-black hover:bg-gray-200 transition-colors">
                            <Play className="w-4 h-4 mr-2" />
                            Start
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Weekly Progress */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-[#141414] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Weekly Progress</CardTitle>
                  <CardDescription className="text-gray-400">Your performance this week</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentData.weeklyProgress.length === 0 ? (
                    <div className="text-gray-400">No progress data yet.</div>
                  ) : (
                    studentData.weeklyProgress.map((day, index) => (
                      <motion.div
                        key={day.day}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 + index * 0.05 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">{day.day}</span>
                          <span className="text-white font-semibold">{day.score}%</span>
                        </div>
                        <div className="relative h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${day.score}%` }}
                            transition={{ duration: 1, delay: 0.8 + index * 0.05 }}
                            className="absolute h-full bg-white rounded-full"
                          />
                        </div>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-[#141414] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Recent Test Results</CardTitle>
                <CardDescription className="text-gray-400">Your latest performance history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {studentData.recentTests.length === 0 ? (
                    <div className="text-gray-400">No recent tests.</div>
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
                              <Activity className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{test.name}</h4>
                            <p className="text-sm text-gray-400">{test.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">{test.score}%</div>
                          <div className="text-xs text-gray-500">Score</div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid md:grid-cols-3 gap-6"
          >
            <Card className="bg-[#141414] border-[#2a2a2a] hover:border-[#3a3a3a] transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center mb-2 group-hover:bg-white group-hover:border-white transition-all">
                  <Target className="w-6 h-6 text-white group-hover:text-black transition-colors" />
                </div>
                <CardTitle className="text-lg text-white">Set Goals</CardTitle>
                <CardDescription className="text-gray-400">Define your study targets</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-[#141414] border-[#2a2a2a] hover:border-[#3a3a3a] transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center mb-2 group-hover:bg-white group-hover:border-white transition-all">
                  <Award className="w-6 h-6 text-white group-hover:text-black transition-colors" />
                </div>
                <CardTitle className="text-lg text-white">Achievements</CardTitle>
                <CardDescription className="text-gray-400">View your badges & awards</CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-[#141414] border-[#2a2a2a] hover:border-[#3a3a3a] transition-all cursor-pointer group">
              <CardHeader>
                <div className="w-12 h-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center mb-2 group-hover:bg-white group-hover:border-white transition-all">
                  <Brain className="w-6 h-6 text-white group-hover:text-black transition-colors" />
                </div>
                <CardTitle className="text-lg text-white">Study Plan</CardTitle>
                <CardDescription className="text-gray-400">Get personalized recommendations</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Performance Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="grid md:grid-cols-2 gap-6"
          >
            <Card className="bg-[#141414] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-xl text-white">Strengths</CardTitle>
                <CardDescription className="text-gray-400">Your best performing areas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-gray-400">No strengths data yet.</div>
              </CardContent>
            </Card>

            <Card className="bg-[#141414] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-xl text-white">Areas to Improve</CardTitle>
                <CardDescription className="text-gray-400">Focus on these topics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-gray-400">No improvement data yet.</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
