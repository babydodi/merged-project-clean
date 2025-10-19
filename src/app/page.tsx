"use client"
import { motion } from "framer-motion"

export default function LandingPage() {
  return (
    <main className="relative w-full h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      {/* خلفية متحركة */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-white/10 blur-3xl"
        animate={{ y: [0, -40, 0], x: [0, 40, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* المحتوى */}
      <div className="relative z-10 text-center text-white px-6">
        <motion.h1
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-5xl md:text-6xl font-extrabold mb-6 drop-shadow-lg"
        >
          منصّة اختبارات STEP
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-white/90 mb-10"
        >
          تدرب على اختبار ستيب بتجربة تفاعلية، واجهة أنيقة، ونتائج دقيقة تساعدك تتطور خطوة بخطوة.
        </motion.p>

        {/* الأزرار */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <a
            href="/signup"
            className="px-8 py-3 rounded-lg bg-white text-indigo-600 font-semibold shadow-lg hover:scale-105 hover:shadow-2xl transition transform duration-300"
          >
            ابدأ الآن
          </a>
          <a
            href="/pricing"
            className="px-8 py-3 rounded-lg border border-white/70 text-white font-medium hover:bg-white/10 hover:scale-105 transition transform duration-300"
          >
            شوف الخطط
          </a>
        </motion.div>
      </div>
    </main>
  )
}
