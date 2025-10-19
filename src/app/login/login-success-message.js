'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginSuccessMessage() {
  const [successMessage, setSuccessMessage] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'registration_success') {
      setSuccessMessage('تم إرسال رابط التفعيل إلى ايميلك');
    }
  }, [searchParams]);

  if (!successMessage) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-green-900/50 border border-green-800 rounded-lg text-green-200 text-sm text-center">
      {successMessage}
    </div>
  );
}
