'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'
import { Button } from '@/components/ui/buttonn'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen, Clock, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function MyTestsPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()

  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let channel = null
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const { data, error } = await supabase
          .from('tests')
          .select('id, title, description, availability, is_published, created_at')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
        if (error) throw error
        setTests(data || [])
        // اختياري: اشتراك realtime لتحديث القائمة عند الإضافة/التعديل
        channel = supabase
          .channel('public:tests')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tests' },
            (payload) => {
              // عند أي تغيير نعمل إعادة تحميل بسيطة — يمكن تحسينها بمعالجة payload
              // تأكد أن الاختبار منشور
              if (['INSERT', 'UPDATE', 'DELETE'].includes(payload.eventType)) {
                // إعادة جلب البيانات
                supabase
                  .from('tests')
                  .select('id, title, description, availability, is_published, created_at')
                  .eq('is_published', true)
                  .order('created_at', { ascending: false })
                  .then(({ data: d, error: e }) => {
                    if (!e) setTests(d || [])
                  })
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.error(err)
        setError(err.message || 'فشل تحميل الاختبارات')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">My Tests / اختباراتي</h1>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/')} className="bg-white text-black">Back / رجوع</Button>
          </div>
        </div>

        {error && <div className="text-red-400">{error}</div>}
        {loading && <div className="text-yellow-400">Loading... / جارٍ التحميل...</div>}

        <div className="grid md:grid-cols-2 gap-6">
          {tests.length === 0 ? (
            <div className="text-gray-400">No tests available / لا توجد اختبارات حالياً.</div>
          ) : (
            tests.map((test) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-[#141414] rounded-lg border border-[#2a2a2a]"
              >
                <Card className="bg-transparent border-0 shadow-none p-0">
                  <CardHeader className="p-0 mb-2">
                    <CardTitle className="text-white text-lg">{test.title}</CardTitle>
                    <CardDescription className="text-gray-400">{test.description || '—'}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex items-center justify-between">
                    <div className="text-sm text-gray-400 flex items-center gap-4">
                      <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Questions: —</span>
                      <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Duration: —</span>
                    </div>
                    <div>
                      <Button className="bg-white text-black" onClick={() => router.push(`/tests/${test.id}`)}>
                        <Play className="w-4 h-4 mr-2" /> Start / ابدأ
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
