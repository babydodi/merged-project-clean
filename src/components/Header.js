import { BookOpen, LogIn } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">منصة ستيب</span>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          <a href="#features" className="text-gray-600 hover:text-blue-600 transition">المميزات</a>
          <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition">آراء الطلاب</a>
          <a href="#cta" className="text-gray-600 hover:text-blue-600 transition">ابدأ الآن</a>
        </nav>
        <a href="#" className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center space-x-2">
          <LogIn size={18} />
          <span>تسجيل الدخول</span>
        </a>
      </div>
    </header>
  );
}
