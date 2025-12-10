'use client';

/**
 * Design Style Preview Page
 * 展示不同设计风格的效果，帮助选择最适合的风格
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

type StyleType = 'minimal' | 'gradient' | 'glass' | 'dark-luxury' | 'fluid' | 'stellar';

export default function DesignPreviewPage() {
  const [activeStyle, setActiveStyle] = useState<StyleType>('stellar');

  const styles: { id: StyleType; name: string; description: string }[] = [
    { id: 'stellar', name: 'Stellar 科技', description: '深色SaaS + 星空粒子' },
    { id: 'minimal', name: '现代简约', description: 'Apple/Stripe 风格' },
    { id: 'gradient', name: '渐变霓虹', description: '鲜艳渐变 + 发光效果' },
    { id: 'glass', name: '毛玻璃未来', description: '半透明 + 模糊背景' },
    { id: 'dark-luxury', name: '暗黑奢华', description: '深色 + 金色点缀' },
    { id: 'fluid', name: '流体动态', description: '液态动画 + 波浪效果' },
  ];

  return (
    <div className="min-h-screen">
      {/* Style Selector */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b p-4">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => setActiveStyle(style.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeStyle === style.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>

      {/* Preview Content */}
      <div className="pt-20">
        {activeStyle === 'stellar' && <StellarStyle />}
        {activeStyle === 'minimal' && <MinimalStyle />}
        {activeStyle === 'gradient' && <GradientStyle />}
        {activeStyle === 'glass' && <GlassStyle />}
        {activeStyle === 'dark-luxury' && <DarkLuxuryStyle />}
        {activeStyle === 'fluid' && <FluidStyle />}
      </div>
    </div>
  );
}


// ============================================
// Style 0: Stellar 科技风 (Dark SaaS + Starfield)
// ============================================
function StellarStyle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 星空粒子动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white relative overflow-hidden">
      {/* Starfield Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Gradient Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[80px]" />
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Navbar */}
      <nav className="relative z-20 border-b border-white/5 bg-[#0B0F1A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">J</span>
            </div>
            <span className="font-semibold text-lg">Jiffoo</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-400">
            <span className="text-white cursor-pointer">产品</span>
            <span className="hover:text-white transition-colors cursor-pointer">解决方案</span>
            <span className="hover:text-white transition-colors cursor-pointer">定价</span>
            <span className="hover:text-white transition-colors cursor-pointer">文档</span>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
              登录
            </button>
            <button className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors">
              免费试用
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-300">全新 2.0 版本已发布</span>
            <span className="text-purple-400 text-sm">了解更多 →</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-white">
              构建下一代
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">
              电商体验
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Jiffoo 提供企业级电商解决方案，帮助您快速构建、部署和扩展您的在线业务。
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex gap-4 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative px-8 py-4 rounded-xl font-medium text-white overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600" />
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute inset-0 shadow-[0_0_40px_rgba(139,92,246,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                开始使用
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-4 rounded-xl font-medium text-white border border-white/20 hover:border-white/40 transition-all"
            >
              观看演示
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">为什么选择 Jiffoo</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              我们提供完整的电商解决方案，从店铺搭建到支付处理，一站式满足您的需求。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '⚡',
                title: '极速性能',
                desc: '基于边缘计算的全球 CDN 加速，页面加载速度提升 300%',
                gradient: 'from-purple-500/20 to-blue-500/20',
              },
              {
                icon: '🔒',
                title: '企业级安全',
                desc: 'SOC 2 认证，端到端加密，保护您的数据和客户隐私',
                gradient: 'from-blue-500/20 to-cyan-500/20',
              },
              {
                icon: '📊',
                title: '智能分析',
                desc: 'AI 驱动的数据分析，实时洞察业务趋势和用户行为',
                gradient: 'from-cyan-500/20 to-green-500/20',
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5, borderColor: 'rgba(139, 92, 246, 0.3)' }}
                className="group relative p-8 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden"
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                {/* Glow Effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <section className="relative z-10 py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-purple-400 text-sm font-medium uppercase tracking-wider">精选商品</span>
              <h2 className="text-3xl font-bold mt-2">热门推荐</h2>
            </div>
            <button className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
              查看全部
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8 }}
                className="group cursor-pointer"
              >
                <div className="aspect-square rounded-2xl mb-4 overflow-hidden relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 group-hover:border-purple-500/30 transition-all">
                  {/* Product Image Placeholder */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
                  
                  {/* Hover Glow */}
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Badge */}
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium backdrop-blur-sm">
                    新品
                  </div>

                  {/* Quick Actions */}
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                    <button className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors">
                      加入购物车
                    </button>
                    <button className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-white mb-1 group-hover:text-purple-300 transition-colors">
                    高端商品 Pro {i}
                  </h3>
                  <p className="text-gray-500 text-sm mb-2">限量版 / 全球包邮</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                      ¥1,299
                    </span>
                    <span className="text-gray-500 text-sm line-through">¥1,599</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-12 rounded-3xl overflow-hidden"
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20" />
            <div className="absolute inset-0 border border-white/10 rounded-3xl" />
            
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

            <div className="relative text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                准备好开始了吗？
              </h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                加入超过 10,000+ 商家的行列，使用 Jiffoo 构建您的电商帝国。
              </p>
              <div className="flex gap-4 justify-center">
                <button className="px-8 py-4 rounded-xl font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                  免费开始
                </button>
                <button className="px-8 py-4 rounded-xl font-medium text-white border border-white/20 hover:bg-white/5 transition-all">
                  联系销售
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-blue-500" />
            <span className="text-gray-400 text-sm">© 2025 Jiffoo. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-gray-400 text-sm">
            <span className="hover:text-white cursor-pointer transition-colors">隐私政策</span>
            <span className="hover:text-white cursor-pointer transition-colors">服务条款</span>
            <span className="hover:text-white cursor-pointer transition-colors">联系我们</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// Style 1: 现代简约风 (Premium Blue - Finalized)
// ============================================
function MinimalStyle() {
  return (
    <div className="bg-[#FAFAFA] min-h-screen font-sans text-[#0F172A]">
      {/* Navbar */}
      <nav className="border-b border-blue-50/50 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-xl tracking-tight text-blue-600">JIFFOO</span>
          <div className="flex gap-8 text-sm font-medium text-slate-500">
            <span className="text-blue-600 font-semibold cursor-pointer">首页</span>
            <span className="hover:text-blue-600 transition-colors cursor-pointer">新品</span>
            <span className="hover:text-blue-600 transition-colors cursor-pointer">男士</span>
            <span className="hover:text-blue-600 transition-colors cursor-pointer">女士</span>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50/30 to-white pt-32 pb-24 border-b border-blue-50/50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="inline-block py-1.5 px-4 rounded-full bg-blue-100/50 text-blue-600 text-xs font-bold tracking-wide mb-8 uppercase border border-blue-100">
              New Collection 2025
            </span>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 tracking-tight leading-[1.1] text-slate-900">
              Less is <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">More</span>.
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed font-normal">
              重新定义极简主义。不仅是设计，更是一种生活方式。<br />
              体验极致的纯净与<span className="text-blue-600 font-medium">科技之美</span>。
            </p>
            <div className="flex gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(37, 99, 235, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                className="bg-blue-600 text-white px-10 py-4 rounded-full font-medium text-lg hover:bg-blue-700 transition-all shadow-[0_10px_30px_-10px_rgba(37,99,235,0.3)]"
              >
                立即选购
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "#F1F5F9" }}
                whileTap={{ scale: 0.98 }}
                className="bg-white text-slate-700 border border-slate-200 px-10 py-4 rounded-full font-medium text-lg hover:border-blue-200 hover:text-blue-600 transition-all"
              >
                观看视频
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">本周精选</h2>
              <p className="text-slate-500">为您精心挑选的当季必备单品。</p>
            </div>
            <a href="#" className="text-blue-600 font-medium hover:text-blue-700 transition-colors flex items-center gap-1 group">
              查看全部
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -8 }}
                className="group cursor-pointer"
              >
                <div className="aspect-[4/5] bg-slate-50 rounded-2xl mb-6 overflow-hidden relative shadow-sm transition-all duration-300 group-hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.15)] border border-transparent group-hover:border-blue-100">
                  {/* Placeholder Image Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-blue-600 shadow-sm">
                    NEW
                  </div>
                  <motion.div
                    className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">极简主义 T 恤 No.{i}</h3>
                <p className="text-slate-500 text-sm mb-3">100% 有机棉 / 经典剪裁</p>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-slate-900">¥299</p>
                  <button className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:shadow-blue-500/30">
                    +
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-slate-50/50 border-t border-blue-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { title: "品质保证", desc: "每一件商品都经过严格的质量检测，确保完美无瑕。", icon: "M5 13l4 4L19 7" },
              { title: "极速配送", desc: "全球 24 小时内发货，让美好无需等待。", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
              { title: "无忧退换", desc: "30 天无理由退换货，购物从未如此安心。", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" }
            ].map((item, idx) => (
              <div key={idx} className="group">
                <div className="w-14 h-14 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center text-blue-600 shadow-sm group-hover:shadow-lg group-hover:shadow-blue-500/10 group-hover:scale-110 transition-all duration-300 border border-blue-50">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
                </div>
                <h3 className="font-bold text-lg mb-2 text-slate-900">{item.title}</h3>
                <p className="text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================
// Style 2: 渐变霓虹风 (Gradient Neon)
// ============================================
function GradientStyle() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Animated gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Hero */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            炫彩未来
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            大胆、前卫、充满活力。让购物成为一场视觉盛宴。
          </p>
          <button className="relative group px-8 py-4 rounded-full font-semibold text-white overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 blur-lg opacity-75 group-hover:opacity-100 transition-opacity" />
            <span className="relative">立即探索</span>
          </button>
        </div>
      </section>

      {/* Products */}
      <section className="relative py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-8">热门商品</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:border-purple-500/50 transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl mb-4" />
                <h3 className="font-medium text-white">商品名称</h3>
                <p className="text-gray-400 text-sm mb-2">简短描述</p>
                <p className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">¥299</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}


// ============================================
// Style 3: 毛玻璃未来风 (Glassmorphism 2.0 - Upgraded)
// ============================================
function GlassStyle() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-900">
      {/* Colorful background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400" />

      {/* Noise Texture Overlay - 关键升级：增加真实质感 */}
      <div className="fixed inset-0 opacity-[0.05] pointer-events-none z-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      {/* Floating shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-20 w-64 h-64 bg-white/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 30, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-300/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/2 left-1/3 w-48 h-48 bg-yellow-300/30 rounded-full blur-3xl"
        />
      </div>

      {/* Hero */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-block bg-white/10 backdrop-blur-xl rounded-3xl px-12 py-16 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] relative overflow-hidden group"
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <h1 className="text-5xl font-bold text-white mb-6 drop-shadow-lg">
              透明之境
            </h1>
            <p className="text-xl text-white/80 mb-10 max-w-xl">
              轻盈、通透、梦幻。在虚实之间创造独特体验。
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-full font-medium border border-white/30 hover:bg-white/30 transition-all shadow-lg"
            >
              进入商城
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Products */}
      <section className="relative py-16 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-8 drop-shadow">热门商品</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="group bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 hover:bg-white/20 transition-all shadow-lg hover:shadow-2xl relative overflow-hidden"
              >
                {/* Shimmer on Hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                <div className="aspect-square bg-white/10 rounded-2xl mb-4 backdrop-blur-sm border border-white/10" />
                <h3 className="font-medium text-white">商品名称</h3>
                <p className="text-white/70 text-sm mb-2">简短描述</p>
                <p className="text-lg font-semibold text-white">¥299</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================
// Style 4: 暗黑奢华风 (Dark Luxury)
// ============================================
function DarkLuxuryStyle() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      {/* Hero */}
      <section className="relative py-32 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6">
            <span className="text-amber-400 text-sm tracking-[0.3em] uppercase font-medium">Premium Collection</span>
          </div>
          <h1 className="text-6xl font-light text-white mb-6 tracking-tight">
            奢华<span className="text-amber-400">典藏</span>
          </h1>
          <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto font-light">
            精选臻品，彰显不凡品味。每一件都是艺术与工艺的完美结合。
          </p>
          <button className="group relative px-10 py-4 font-medium text-zinc-950 overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-500" />
            <span className="absolute inset-0 bg-gradient-to-r from-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative tracking-wider uppercase text-sm">探索臻品</span>
          </button>
        </div>
      </section>

      {/* Products */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-xl font-light text-white tracking-wide">精选商品</h2>
            <span className="text-amber-400 text-sm">查看全部 →</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="group">
                <div className="aspect-[3/4] bg-zinc-900 rounded-sm mb-6 overflow-hidden border border-zinc-800 group-hover:border-amber-400/30 transition-colors">
                  <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-light text-white mb-1">臻品名称</h3>
                    <p className="text-zinc-500 text-sm">限量典藏</p>
                  </div>
                  <p className="text-amber-400 font-light">¥2,999</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}


// ============================================
// Style 5: 流体动态风 (Fluid Motion - Upgraded)
// ============================================
function FluidStyle() {
  // Mouse Parallax Effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden relative">
      {/* Animated wave background - 使用 framer-motion 实现更平滑的物理流动 */}
      <div className="fixed inset-0">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-30"
          style={{
            background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.4), transparent 70%)',
          }}
        />

        {/* Floating particles with Parallax */}
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => {
            const x = useTransform(mouseX, [0, window.innerWidth], [20, -20]);
            const y = useTransform(mouseY, [0, window.innerHeight], [20, -20]);
            return (
              <motion.div
                key={i}
                style={{ x, y }}
                className="absolute w-2 h-2 bg-white/20 rounded-full"
                initial={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  scale: Math.random() * 0.5 + 0.5
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.2, 0.8, 0.2]
                }}
                transition={{
                  duration: 3 + Math.random() * 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: Math.random() * 2
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Hero */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-6xl mx-auto text-center">
          <div className="relative inline-block">
            <motion.h1
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, type: "spring" }}
              className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 mb-6"
            >
              流动之美
            </motion.h1>
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -inset-4 bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 rounded-full blur-3xl opacity-30 -z-10"
            />
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto relative"
          >
            动感、流畅、充满生命力。让每一次滚动都成为享受。
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group px-10 py-4 rounded-full font-semibold text-white overflow-hidden border-2 border-transparent bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500"
          >
            <span className="relative z-10">开始体验</span>
          </motion.button>
        </div>
      </section>

      {/* Products with 3D Tilt Effect */}
      <section className="relative py-16 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8">热门商品</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <TiltCard key={i} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// 3D Tilt Card Component
function TiltCard({ index }: { index: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct * 200);
    y.set(yPct * 200);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.2 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10 hover:border-cyan-400/50 transition-colors duration-300"
    >
      <div
        style={{ transform: "translateZ(50px)" }}
        className="relative"
      >
        <div className="aspect-square bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl mb-4 overflow-hidden shadow-lg">
          <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20" />
        </div>
        <h3 className="font-semibold text-white mb-1">商品名称</h3>
        <p className="text-slate-400 text-sm mb-3">简短描述</p>
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">¥299</p>
          <button className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
            加入购物车
          </button>
        </div>
      </div>
    </motion.div>
  );
}
