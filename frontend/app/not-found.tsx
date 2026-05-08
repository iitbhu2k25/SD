"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { HomeIcon } from "@heroicons/react/24/outline";

export default function NotFound() {
  const [particles, setParticles] = useState<
    { top: number; left: number; duration: number; size: number }[]
  >([]);

  useEffect(() => {
    const generated = [...Array(120)].map(() => ({
      top: Math.random() * 100,   // percentage
      left: Math.random() * 100,  // percentage
      duration: 5 + Math.random() * 5,
      size: 2 + Math.random() * 4,
    }));
    setParticles(generated);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-6">

      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-gray-900 dark:via-gray-800 dark:to-black" />

      {/* Particle Layer */}
      <div className="absolute inset-0">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute bg-white/30 rounded-full"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{ y: [-20, 20] }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Glass Card */}
      <motion.div
        initial={{ rotateY: -20, opacity: 0, scale: 0.9 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl rounded-2xl p-12 text-center max-w-xl w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.h1
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 10 }}
          className="text-8xl font-extrabold text-white"
        >
          404
        </motion.h1>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Page Not Found
        </h2>

        <p className="mt-3 text-white/80">
          Go back to the home page.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white text-gray-900 px-6 py-3 text-sm font-medium transition-all duration-300 hover:scale-105 hover:bg-gray-200"
        >
          <HomeIcon className="h-5 w-5" />
          Go Now
        </Link>
      </motion.div>
    </div>
  );
}