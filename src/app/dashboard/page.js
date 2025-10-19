'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  BookOpen,
  Calendar,
  Award,
  ChevronLeft,
  Clock,
  CheckCircle2,
  User,
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('guest');
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      // 1. جلب المستخدم
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // جلب البروفايل
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, role')
          .eq('id', user.id)
          .single();

        if (profile) {
          setFullName(profile.full_name || 'طالب');
          setRole(profile.role || 'guest');
        }
      }

      // 2. جلب الاختبارات
      const { data: testsData } = await supabase
        .from('tests')
        .select('id, title, description');

      setTests(testsData || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleInfo = () => {
    if (role === 'admin') {
      return {
        label: 'أدمن',
        color: 'text-slate-700',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-300',
      };
    }
    if (role === 'subscriber') {
      return {
        label: 'مشترك',
        color: 'text-slate-700',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-300',
      };
    }
    return {
      label: 'غير مشترك',
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
    };
  };

  const roleInfo = getRoleInfo();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-700 rounded-lg flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                مرحباً، {fullName || 'طالب'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${roleInfo.bgColor} ${roleInfo.color} ${roleInfo.borderColor}`}
                >
                  {roleInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">
                  إجمالي الاختبارات
                </p>
                <p className="text-3xl font-semibold text-slate-900">
                  {tests.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">
                  حالة الاشتراك
                </p>
                <p className="text-lg font-medium text-slate-900">
                  {roleInfo.label}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">
                  آخر تحديث
                </p>
                <p className="text-base font-medium text-slate-900">
                  {new Date().toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tests */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              الاختبارات المتاحة
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              اختر اختباراً للبدء في تقييم مستواك
            </p>
          </div>

          <div className="p-6">
            {tests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-medium text-slate-700 mb-1">
                  لا توجد اختبارات متاحة حالياً
                </h3>
                <p className="text-sm text-slate-500">
                  سيتم إضافة اختبارات جديدة قريباً
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tests.map((test) => (
                  <div
                    key={test.id}
                    className="border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition-colors flex flex-col justify-between min-h-[200px]"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {test.title}
                      </h3>
                      <p className="text-slate-600 text-sm mb-3 line-clamp-3">
                        {test.description || 'لا يوجد وصف متاح لهذا الاختبار'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>45 دقيقة</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>3 أقسام</span>
                        </div>
                      </div>
                    </div>

                    <button
  onClick={() => router.push(`/test/${test.id}`)}
  className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
>
  <span>ابدأ الاختبار</span>
  <ChevronLeft className="w-4 h-4" />
</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
