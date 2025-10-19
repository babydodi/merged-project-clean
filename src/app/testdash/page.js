// src/app/testdash/page.js
"use client"

import { useEffect, useRef, useState } from "react"

/*
  Apple-like horizontal cards + featured panel
  - Replace sampleData with real data (from Supabase)
  - Works RTL (dir="rtl" set in root layout)
*/

const sampleData = [
  {
    id: "1",
    title: "iPhone Series 11",
    subtitle: "الطريقة الأمثل للتدريب",
    price: "1,799 ر.س",
    image: "/images/sample1.jpg",
  },
  {
    id: "2",
    title: "iPhone 17",
    subtitle: "ملك جمال اللون",
    price: "3,799 ر.س",
    image: "/images/sample2.jpg",
  },
  {
    id: "3",
    title: "iPhone Air",
    subtitle: "أخف iPhone على الإطلاق",
    price: "4,699 ر.س",
    image: "/images/sample3.jpg",
  },
  {
    id: "4",
    title: "iPhone 17 Pro",
    subtitle: "كله على البعض Pro.",
    price: "5,199 ر.س",
    image: "/images/sample4.jpg",
  },
]

export default function TestDash() {
  const [items, setItems] = useState(sampleData)
  const [activeIndex, setActiveIndex] = useState(items.length - 1) // featured on the rightmost by default
  const scrollRef = useRef(null)

  useEffect(() => {
    // when activeIndex changes, ensure the horizontal list scrolls so the selected card is nicely visible
    const container = scrollRef.current
    if (!container) return
    const children = Array.from(container.children)
    const node = children[activeIndex]
    if (node) {
      // center the clicked element in view (smooth)
      node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
  }, [activeIndex])

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      {/* header */}
      <div className="flex items-start justify-between mb-8 gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">تعرّف على جديدنا الآن.</h1>
          <p className="text-sm text-gray-500">تصفح، اضغط، وشاهد البطاقة المميزة على اليمين</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-sm px-4 py-2 rounded-lg border border-gray-200 bg-white/70 shadow-sm">عرض الكل</button>
        </div>
      </div>

      {/* content: left carousel + right featured */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: horizontal cards strip */}
        <div className="lg:col-span-8">
          <div className="relative">
            <div
              ref={scrollRef}
              className="h-snap overflow-x-auto flex gap-6 py-4 px-2 snap-x"
              role="list"
            >
              {items.map((it, i) => (
                <div
                  key={it.id}
                  role="listitem"
                  onClick={() => setActiveIndex(i)}
                  className={`
                    min-w-[320px] lg:min-w-[360px] h-[420px] rounded-[18px] bg-white card-shadow border border-gray-100 cursor-pointer
                    transform transition duration-300
                    ${i === activeIndex ? "scale-105 shadow-2xl" : "hover:translate-y-[-4px]"}
                    flex flex-col
                  `}
                >
                  {/* Top area: black large image on the right side of the card like apple */}
                  <div className="relative flex-1 overflow-hidden rounded-t-[18px]">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/40 opacity-40 pointer-events-none" />
                    <img
                      src={it.image}
                      alt={it.title}
                      className="w-full h-full object-contain p-6"
                    />
                  </div>

                  {/* Info */}
                  <div className="px-6 py-4 border-t border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">{it.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{it.subtitle}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600">{it.price}</span>
                      <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700">عرض</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* subtle left/right shadows to mimic masked carousel */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-l from-white/0 to-white"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-r from-white/0 to-white"></div>
          </div>
        </div>

        {/* RIGHT: Featured (big) */}
        <div className="lg:col-span-4">
          <div className="sticky top-28">
            <div className="bg-white rounded-[22px] overflow-hidden border border-gray-100 card-shadow">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">{items[activeIndex]?.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">{items[activeIndex]?.subtitle}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">{items[activeIndex]?.price}</span>
                  </div>
                </div>
              </div>

              <div className="w-full h-[420px] bg-black flex items-center justify-center">
                {/* big product image */}
                <img
                  src={items[activeIndex]?.image}
                  alt={items[activeIndex]?.title}
                  className="featured-img w-full h-full object-contain"
                />
              </div>

              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button className="flex-1 py-3 rounded-lg bg-gray-900 text-white font-medium">تفاصيل المنتج</button>
                <button className="px-4 py-3 rounded-lg border border-gray-200">احفظ</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
