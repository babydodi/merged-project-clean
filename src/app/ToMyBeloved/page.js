"use client";

export default function MessagePage() {
  const playMusic = () => {
    const audio = new Audio("/happy-birthday.mp3"); // الملف داخل public/
    audio.play();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-3xl text-center space-y-6 bg-slate-900/80 p-8 rounded-2xl shadow-lg">
        <h2 className="text-4xl font-bold text-pink-400">
          🎉 Happy Birthday Dana 🎉
        </h2>
        <p className="whitespace-pre-line text-lg leading-relaxed">
{`To my beloved Dana,

I hope this message finds you well.
I just want to say that I’m really glad that I got to know you,
and eventually became your beloved one. I am so lucky to be yours.

And just for the record, so you know: you are the one and only person I would do anything for —
the one I would be everything for.
If there was someone I wanted to be with for the rest of my life, and not see anyone else,
it would, without a doubt, be you.
I feel you should know that already… shouldn’t you?

Dana, I want you to know that you mean the world to me. You are my everything, and I love you —
I love you more than you can imagine.
I love your smile, your eyes, your gorgeous lips, and your stunning, pretty face.

I want this anniversary to be unforgettable. I’ll be preparing something special for you;
the upcoming days will reveal it.
I would do anything for you because I love you, and I always love to see you happy and hear your laughs.

My dear Dana,
thank you for being my friend, my soul, my wife, my Barbie, my everything.
You deserve the world, honey.
Smile — it’s your birthday, baby 💗`}
        </p>
        <button
          onClick={playMusic}
          className="px-6 py-3 bg-pink-400 text-black rounded-xl font-bold hover:bg-pink-300 transition"
        >
          Play Music 🎶
        </button>
      </div>
    </main>
  );
}
