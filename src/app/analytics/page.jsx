'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/buttonn'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Play, Clock, Trophy, RefreshCw } from 'lucide-react'

export default function StudentAnalyticsPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    subscription: null,           // { plan, is_active, start_date, end_date, status }
    myAttemptsCount: 0,          // عدد المحاولات
    myAvgScore: 0,               // متوسط درجاتي
    recentResults: [],           // أحدث النتائج الشخصية
    recommendedTests: [],        // اختبارات مقترحة (published & available to user & not attempted)
  })

  // loadAnalytics: يجلب بيانات مخصّصة بالمستخدم
  const loadAnalytics = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)
    setError('')
    try {
      const userId = session.user.id

      // 1) حالة الاشتراك الحالية لهذا المستخدم (آخر اشتراك نشط أو آخر صف)
      const { data: subData, error: subErr } = await supabase
        .from('subscriptions')
        .select('id, plan, is_active, start_date, end_date, status, amount')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (subErr) throw subErr
      const subscription = subData?.[0] || null

      // 2) محاولات ونتائج المستخدم: آخر 12 نتيجة (joined via attempt)
      // نأخذ آخر 12 attempt ثم نجيب النتائج المرتبطة
      const { data: attemptsData, error: attemptsErr } = await supabase
        .from('test_attempts')
        .select('id, test_id, started_at, completed_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(12)
      if (attemptsErr) throw attemptsErr

      const attemptIds = (attemptsData || []).map(a => a.id)
      let recentResults = []
      if (attemptIds.length) {
        const { data: resultsData, error: resultsErr } = await supabase
          .from('user_results')
          .select('id, attempt_id, score, total_questions, percentage, created_at')
          .in('attempt_id', attemptIds)
        if (resultsErr) throw resultsErr
        // join results with attempts to include test_id and date
        recentResults = (resultsData || []).map(r => {
          const att = attemptsData.find(a => a.id === r.attempt_id)
          return {
            id: r.id,
            attempt_id: r.attempt_id,
            test_id: att?.test_id || null,
            score: r.score,
            total_questions: r.total_questions,
            percentage: Number(r.percentage) || 0,
            date: r.created_at,
          }
        }).sort((a,b)=> new Date(b.date) - new Date(a.date))
      }

      // 3) إحصاءات شخصية: عدد المحاولات و متوسط الدرجات
      const myAttemptsCount = (await supabase
        .from('test_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      ).count || 0

      const { data: allMyResults, error: myResultsErr } = await supabase
        .from('user_results')
        .select('percentage')
        .in('attempt_id', attemptIds.length ? attemptIds : ['-']) // إذا لا محاولات: تمرير مفتعل لتفادي جلب طويل
      if (myResultsErr) {
        // إذا لم تُرجع نتيجة بسبب طلب غير صالح نسمح بالمتابعة
        console.warn('no personal results or fetch error for personal results', myResultsErr)
      }
      const myAvgScore =
        allMyResults && allMyResults.length
          ? Math.round(allMyResults.reduce((s, r) => s + Number(r.percentage || 0), 0) / allMyResults.length)
          : recentResults.length
          ? Math.round(recentResults.reduce((s, r) => s + Number(r.percentage || 0), 0) / recentResults.length)
          : 0

      // 4) اختبارات مقترحة: اختبارات منشورة متاحة للمستخدم (availability rules)
      // القاعدة: show tests where is_published = true AND
      // - availability = 'all' OR
      // - availability = 'subscribers' and user has active subscription
      // ثم استبعد الاختبارات التي قام المستخدم بمحاولة أي منها
      const { data: publishedTests, error: testsErr } = await supabase
        .from('tests')
        .select('id, title, description, availability')
        .eq('is_published', true)
      if (testsErr) throw testsErr

      const attemptedTestIds = (attemptsData || []).map(a => a.test_id).filter(Boolean)
      const hasActiveSubscription = !!subscription && subscription.is_active === true

      const recommendedTests = (publishedTests || [])
        .filter(t => {
          if (attemptedTestIds.includes(t.id)) return false
          if (t.availability === 'all') return true
          if (t.availability === 'subscribers' && hasActiveSubscription) return true
          if (t.availability === 'non_subscribers' && !hasActiveSubscription) return true
          return false
        })
        .slice(0, 8) // حد عرض صغير للواجهة

      // تحديث الحالة
      setStats({
        subscription,
        myAttemptsCount: Number(myAttemptsCount) || 0,
        myAvgScore,
        recentResults,
        recommendedTests,
      })
    } catch (err) {
      console.error('student analytics fetch error', err)
      setError(err?.message || 'Failed to load analytics / فشل تحميل التحليلات')
    } finally {
      setLoading(false)
    }
  }, [session, supabase])

  // استدعاء أولي
  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // Refresh handler
  const handleRefresh = async () => {
    await loadAnalytics()
  }

  const { subscription, myAttemptsCount, myAvgScore, recentResults, recommendedTests } = stats

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Analytics / تحليلاتي</h1>
            <p className="text-gray-400">Personal progress and recommendations / التقدّم الشخصي والتوصيات</p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/')}>Back / العودة</Button>

            <Button
              onClick={handleRefresh}
              disabled={loading}
              className={loading ? 'opacity-60 pointer-events-none' : ''}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {loading ? 'Updating... / جارٍ التحديث' : 'Refresh / تحديث'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Summary Cards: subscription, attempts, avg score */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-sm text-gray-400">Subscription / الاشتراك</CardTitle>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div>
                  <div className="text-white font-semibold">{subscription.plan ?? '—'}</div>
                  <div className="text-sm text-gray-400">
                    {subscription.is_active ? 'Active / مفعل' : subscription.status || '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {subscription.start_date ? `From ${subscription.start_date}` : ''}
                    {subscription.end_date ? ` • To ${subscription.end_date}` : ''}
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">No subscription / لا يوجد اشتراك</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-sm text-gray-400">Attempts / المحاولات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{myAttemptsCount}</div>
              <CardDescription className="text-gray-400">Total attempts / إجمالي المحاولات</CardDescription>
            </CardContent>
          </Card>
