// src/components/Message.js
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Message({ text, isError }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`mb-4 p-3 rounded-lg text-center ${
            isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
