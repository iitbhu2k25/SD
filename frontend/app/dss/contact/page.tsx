'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  User,
  AtSign,
} from 'lucide-react';

const StaticBackground = React.memo(() => (
  <>
    <Image
      src="/Images/main_page.jpeg"
      alt="Contact background"
      fill
      priority
      className=""
    />
    <div className="absolute inset-0 bg-black/40" />
  </>
));

export default function ContactPage() {
  const [activeTab, setActiveTab] = useState<'contact' | 'message'>('contact');
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleChange = (e: any) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* ================= PAGE BACKGROUND ================= */}
      <StaticBackground />
      <div className="absolute inset-0 bg-black/40" />

      {/* ================= CONTENT WRAPPER ================= */}
      <div className="relative z-10 max-w-[1200px] mx-auto my-20 px-6">
        <div className="rounded-3xl overflow-hidden shadow-2xl border bg-white/95 backdrop-blur">

          {/* ================= HERO ================= */}
          <section className="relative h-[340px] text-white">
            {/* GIF overlay */}
            <div className="absolute inset-0 opacity-25">
              <Image
                src="/Images/header/header_bg.gif"
                alt="Animated header"
                fill
                className="object-cover"
              />
            </div>

            {/* Color overlay */}
            <div className="absolute inset-0 bg-[#0f4c81]/85" />

            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
              <h1 className="text-4xl font-bold mb-3 tracking-tight">
                Let’s Talk
              </h1>
              <p className="max-w-xl text-white/90">
                Questions, collaborations, or research inquiries — we’d love to hear from you.
              </p>

              {/* Tabs */}
              <div className="mt-8 bg-white/15 backdrop-blur-lg p-1 rounded-full flex">
                {['contact', 'message'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all
                      ${
                        activeTab === tab
                          ? 'bg-white text-[#0f4c81] shadow'
                          : 'text-white hover:bg-white/20'
                      }`}
                  >
                    {tab === 'contact' ? 'Contact Info' : 'Send Message'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ================= CONTENT ================= */}
          <section className="p-10">
            {activeTab === 'contact' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid md:grid-cols-2 gap-10"
              >
                {/* Info Cards */}
                <div className="space-y-6">
                  <InfoCard icon={<Mail />} title="Email">
                    coordinator.gtac@itbhu.ac.in
                    <br />
                    slcr.varanasi@gmail.com
                  </InfoCard>

                  <InfoCard icon={<Phone />} title="Phone">
                    +91-542-257-5389
                  </InfoCard>

                  <InfoCard icon={<MapPin />} title="Location">
                    Smart Laboratory for Clean Rivers (SLCR)
                    <br />
                    Dept. of Civil Engineering
                    <br />
                    IIT (BHU), Varanasi – 221005
                  </InfoCard>

                  <InfoCard icon={<Clock />} title="Office Hours">
                    Mon – Fri: 9:00 AM – 6:00 PM
                    <br />
                    Sat: 9:00 AM – 1:00 PM
                  </InfoCard>
                </div>

                {/* Map */}
                <div className="rounded-2xl overflow-hidden shadow-lg border h-[500px]">
                  <iframe
                    className="w-full h-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3608.218529759872!2d82.99154878507075!3d25.26323320476016!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x398e322a6031e99d%3A0x962763bc1a36226!2sDepartment%20of%20Civil%20Engineering%2C%20IIT%20(BHU)!5e0!3m2!1sen!2sin!4v1739171130935!5m2!1sen!2sin"
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'message' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
              >
                {submitted ? (
                  <div className="text-center bg-green-50 border rounded-2xl p-10">
                    <Send className="mx-auto mb-4 text-green-600" size={32} />
                    <h3 className="text-xl font-semibold">
                      Message Sent Successfully
                    </h3>
                    <p className="text-gray-600 mt-2">
                      We’ll get back to you shortly.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <Input
                        icon={<User />}
                        name="name"
                        placeholder="Your Name"
                        value={formData.name}
                        onChange={handleChange}
                      />
                      <Input
                        icon={<AtSign />}
                        name="email"
                        placeholder="Email Address"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>

                    <Input
                      name="subject"
                      placeholder="Subject"
                      value={formData.subject}
                      onChange={handleChange}
                    />

                    <textarea
                      name="message"
                      rows={5}
                      placeholder="Write your message..."
                      value={formData.message}
                      onChange={handleChange}
                      required
                      className="w-full rounded-xl border px-4 py-3 focus:ring-2 focus:ring-[#0f4c81]/40 focus:outline-none"
                    />

                    <button
                      type="submit"
                      className="w-full bg-[#0f4c81] hover:bg-[#0b3a63] text-white py-3 rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <Send size={18} />
                      Send Message
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ================= COMPONENTS ================= */

function InfoCard({ icon, title, children }: any) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="flex gap-4 bg-gray-50 hover:bg-white rounded-2xl p-5 border shadow-sm"
    >
      <div className="p-3 rounded-full bg-[#0f4c81]/10 text-[#0f4c81]">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="text-gray-600 text-sm mt-1">{children}</p>
      </div>
    </motion.div>
  );
}

function Input({ icon, ...props }: any) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </span>
      )}
      <input
        {...props}
        required
        className={`w-full rounded-xl border py-3 px-4 ${
          icon ? 'pl-10' : ''
        } focus:ring-2 focus:ring-[#0f4c81]/40 focus:outline-none`}
      />
    </div>
  );
}
