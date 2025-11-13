'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { Button } from '@/components/ui/buttonn'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Users, Award, CircleDollarSign, Clock, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AnalyticsPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscribers: 0,
    activePremium: 0,
    activeBasic: 0,
    avgScore: 0,
    publishedTests: 0,
    testsByAvailability: { all: 0, subscribers: 0, non_subscribers: 0 },
    topTests: [], // [{ test_id, title, attempts_count }]
    recentActivity: [], // [{ id, user_id, action, target_type, created_at }]
  })

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!session?.user?.id) return
      setLoading(true)
      setError('')
      try {
        // USERS: total count
        const { count: usersCount, error: usersErr } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
        if (usersErr) throw usersErr

        // SUBSCRIPTIONS: active counts and by plan
        const { data: subsData, error: subsErr } = await supabase
          .from('subscriptions')
          .select('plan, is_active, status', { count: 'exact' })
          .eq('is_active', true)
        if (subsErr) throw subsErr

        const activeSubscribers = subsData ? subsData.length : 0
        const activePremium = subsData ? subsData.filter(s => s.plan === 'premium').length : 0
        const activeBasic = subsData ? subsData.filter(s => s.plan === 'basic').length : 0

        // AVERAGE SCORE: use user_results
        const { data: avgResData, error: avgErr } = await supabase
          .from('user_results')
          .select('percentage', { head: false })
        if (avgErr) throw avgErr
        const avgScore =
          avgResData && avgResData.length
            ? Math.round(
                avgResData.reduce((sum, r) => sum + Number(r.percentage || 0), 0) /
                  avgResData.length
              )
            : 0

        // TESTS: published counts and by availability
        const { data: testsData, error: testsErr } = await supabase
          .from('tests')
          .select('id, title, availability, is_published')
          .eq('is_published', true)
        if (testsErr) throw testsErr

        const publishedTests = testsData ? testsData.length : 0
        const testsByAvailability = { all: 0, subscribers: 0, non_subscribers: 0 }
        (testsData || []).forEach(t => {
          const a = t.availability || 'all'
          testsByAvailability[a] = (testsByAvailability[a] || 0) + 1
        })

        // TOP TESTS: count attempts grouped by test_id (latest 10)
        // Supabase doesn't support GROUP BY in client SDK nicely, so fetch attempts and aggregate client-side
        const { data: attemptsData, error: attemptsErr } = await supabase
          .from('test_attempts')
          .select('test_id', { head: false })
        if (attemptsErr) throw attemptsErr
        const attemptsByTest = {}
        (attemptsData || []).forEach(a => {
          const tid = a.test_id
          if (!tid) return
          attemptsByTest[tid] = (attemptsByTest[tid] || 0) + 1
        })
        // Attach titles
        const topTests = Object.entries(attemptsByTest)
          .map(([test_id, attempts_count]) => {
            const found = (testsData || []).find(t => t.id === test_id)
            return { test_id, title: found?.title || 'Untitled', attempts_count }
          })
          .sort((a, b) => b.attempts_count - a.attempts_count)
          .slice(0, 6)

        // RECENT ACTIVITY
        const { data: activityData, error: activityErr } = await supabase
          .from('user_activity')
          .select('id, user_id, action, target_type, target_id, created_at, details')
          .order('created_at', { ascending: false })
          .limit(12)
        if (activityErr) throw activityErr

        setStats({
          totalUsers: usersCount || 0,
          activeSubscribers,
          activePremium,
          activeBasic,
          avgScore,
          publishedTests,
          testsByAvailability,
          topTests,
          recentActivity: activityData || [],
        })
      } catch (err) {
        console.error('analytics fetch error', err)
        setError(err.message || 'Failed to load analytics / فشل تحميل التحليلات')
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [session, supabase])

  const { totalUsers, activeSubscribers, activePremium, activeBasic, avgScore, publishedTests, testsByAvailability, topTests, recentActivity } = stats

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics / التحليلات</h1>
            <p className="text-gray-400">Platform overview and recent activity / نظرة عامة على المنصة والنشاط الأخير</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/')}>Back to Dashboard / العودة</Button>
            <Button onClick={() => { setLoading(true); setError(''); /* quick refresh */ supabase.rpc(''); setTimeout(()=>setLoading(false),500) }}>Refresh / تحديث</Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        {loading && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-700 px-3 py-2 text-sm">
            Loading... / جارٍ التحميل...
          </div>
        )}

        {/* Top stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">Total Users / إجمالي المستخدمين</CardTitle>
                <Users className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalUsers}</div>
              <CardDescription className="text-gray-400">Registered users / مستخدمون مسجلون</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">Active Subscribers / المشتركون النشطون</CardTitle>
                <CircleDollarSign className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activeSubscribers}</div>
              <CardDescription className="text-gray-400">Active subscriptions / اشتراكات نشطة</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">Premium / بريميوم</CardTitle>
                <Award className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activePremium}</div>
              <CardDescription className="text-gray-400">Active premium / بريميوم نشط</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">Basic / بيسيك</CardTitle>
                <CircleDollarSign className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activeBasic}</div>
              <CardDescription className="text-gray-400">Active basic / بيسيك نشط</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">Avg Score / متوسط الدرجات</CardTitle>
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{avgScore}%</div>
              <CardDescription className="text-gray-400">Across all results / عبر كل النتائج</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-gray-400">Published Tests / الاختبارات المنشورة</CardTitle>
                <Play className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{publishedTests}</div>
              <CardDescription className="text-gray-400">Available tests / الاختبارات المتاحة</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tests by availability (simple bar) */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Tests by Availability / الاختبارات حسب الوصول</CardTitle>
              <CardDescription className="text-gray-400">Counts for published tests / عدد الاختبارات المنشورة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['all', 'subscribers', 'non_subscribers'].map((k) => {
                  const value = testsByAvailability[k] || 0
                  const pct = publishedTests ? Math.round((value / publishedTests) * 100) : 0
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>{k === 'all' ? 'All / الكل' : k === 'subscribers' ? 'Subscribers / المشتركون' : 'Non subscribers / غير المشتركين'}</span>
                        <span className="text-white">{value}</span>
                      </div>
                      <div className="w-full bg-[#0f0f0f] h-3 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%` }} className="h-full bg-white rounded-full transition-all" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top tests */}
          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Top Tests by Attempts / أعلى الاختبارات حسب عدد المحاولات</CardTitle>
              <CardDescription className="text-gray-400">Based on historical attempts / مبني على المحاولات</CardDescription>
            </CardHeader>
            <CardContent>
              {topTests.length === 0 ? (
                <div className="text-gray-400">No attempts yet / لا توجد محاولات بعد</div>
              ) : (
                <div className="space-y-3">
                  {topTests.map((t, i) => (
                    <div key={t.test_id} className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded-md border border-[#2a2a2a]">
                      <div>
                        <div className="text-sm text-gray-400">{i + 1}. {t.title}</div>
                        <div className="text-xs text-gray-500">Test ID: {t.test_id}</div>
                      </div>
                      <div className="text-white font-semibold">{t.attempts_count}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card className="bg-[#141414] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-lg text-white">Recent Activity / النشاط الأخير</CardTitle>
            <CardDescription className="text-gray-400">Last user actions / آخر تفاعلات المستخدمين</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-gray-400">No recent activity / لا يوجد نشاط حديث</div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start justify-between p-2 bg-[#0a0a0a] rounded-md border border-[#2a2a2a]">
                    <div>
                      <div className="text-sm text-white">{a.action} <span className="text-gray-500 text-xs">({a.target_type || '-'})</span></div>
                      <div className="text-xs text-gray-500">by user {String(a.user_id).slice(0,8)} • {new Date(a.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-gray-400">{a.details ? 'Has details' : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-sm text-gray-500">Note: data shown is fetched live from Supabase tables you provided / ملاحظة: البيانات مستخرجة مباشرة من جداول Supabase المرسلة</div>
      </div>
    </div>
  )
}
