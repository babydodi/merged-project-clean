export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="container mx-auto px-6 py-8 text-center">
        <p>&copy; {new Date().getFullYear()} منصة ستيب. جميع الحقوق محفوظة.</p>
        <div className="flex justify-center space-x-4 mt-4">
          <a href="#" className="hover:text-blue-400">سياسة الخصوصية</a>
          <a href="#" className="hover:text-blue-400">شروط الاستخدام</a>
        </div>
      </div>
    </footer>
  );
}
