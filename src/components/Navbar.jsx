// src/components/Navbar.jsx
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-black bg-opacity-20 backdrop-blur-lg shadow-lg fixed w-full top-0 z-50 transition-all duration-300 border-b border-white border-opacity-10">
      <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">
        {/* اسم الموقع */}
        <Link
          href="/"
          className="text-2xl font-bold text-white hover:text-primary transition-colors duration-200"
        >
          STEP
        </Link>

        {/* القائمة (للأجهزة الكبيرة) */}
        <ul className="hidden md:flex space-x-8 space-x-reverse text-sm font-medium">
          <li>
            <Link
              href="/"
              className="text-white hover:text-primary transition-colors duration-200"
            >
              الرئيسية
            </Link>
          </li>
          <li>
            <Link
              href="#about"
              className="text-white hover:text-primary transition-colors duration-200"
            >
              من نحن
            </Link>
          </li>
          <li>
            <Link
              href="/pricing"
              className="text-white hover:text-primary transition-colors duration-200"
            >
              الأسعار
            </Link>
          </li>
          <li>
            <Link
              href="#contact"
              className="text-white hover:text-primary transition-colors duration-200"
            >
              اتصل بنا
            </Link>
          </li>
        </ul>

        {/* زر تسجيل الدخول */}
        <div>
          <Link
            href="/login"
            className="bg-white text-black px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>

      {/* القائمة (للأجهزة الصغيرة - هامبرغر) */}
      <div className="md:hidden bg-black bg-opacity-10 px-6 py-2 flex flex-col items-end space-y-2">
        <Link
          href="/"
          className="text-white text-sm hover:text-primary transition-colors"
        >
          الرئيسية
        </Link>
        <Link
          href="#about"
          className="text-white text-sm hover:text-primary transition-colors"
        >
          من نحن
        </Link>
        <Link
          href="/pricing"
          className="text-white text-sm hover:text-primary transition-colors"
        >
          الأسعار
        </Link>
        <Link
          href="#contact"
          className="text-white text-sm hover:text-primary transition-colors"
        >
          اتصل بنا
        </Link>
      </div>
    </nav>
  );
}