'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, User, Zap, Terminal, Eye, Database, Cpu, ArrowRight } from 'lucide-react';

export default function Developers() {
  return (
    <section id="developers" className="py-12 sm:py-16 md:py-24 bg-gradient-to-br from-slate-50 via-slate-100/30 to-slate-200/20 dark:from-slate-950 dark:via-slate-900/20 dark:to-slate-800/10">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-slate-900 dark:bg-white rounded flex items-center justify-center shadow-lg">
              <Code className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white dark:text-slate-900" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-slate-900 dark:text-white">Identify users & track custom events</h2>
          </div>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto px-2 sm:px-0">Pass a user id or email to personalize actions and attach rich context to analytics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-10 mb-10 sm:mb-12 md:mb-16">
          <Card className="group bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl md:text-2xl text-slate-900 dark:text-white mb-1 sm:mb-2">Identify your users</CardTitle>
                  <CardDescription className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400">Send a stable user id with optional attributes like email, name, plan, role.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
                </div>
                <pre className="rounded bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-3 sm:p-4 md:p-6 text-xs sm:text-sm md:text-base overflow-auto border border-slate-700 shadow-inner">{`<!-- Include once, ideally in your site layout -->
<script src="/trackers/tracker.js" data-site-id="YOUR_SITE_ID"></script>

<!-- Identify after login/signup or when info becomes available -->
<script>
  window.seentics?.identify('user_123', {
    email: 'jane@acme.com',
    name: 'Jane Doe',
    plan: 'pro',
    role: 'admin'
  });
</script>`}
                </pre>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <Database className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500" />
                <span>The identification is used to attach identity to analytics events for richer insights and user-level tracking.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="group bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-600 to-violet-600 rounded flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl md:text-2xl text-slate-900 dark:text-white mb-1 sm:mb-2">Track custom events</CardTitle>
                  <CardDescription className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400">Monitor user actions and business metrics with custom event tracking.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
                </div>
                <pre className="rounded bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-3 sm:p-4 md:p-6 text-xs sm:text-sm md:text-base overflow-auto border border-slate-700 shadow-inner">{`// Track page views automatically
// Track custom events manually
window.seentics?.track('button_clicked', {
  button_name: 'signup_cta',
  page: 'landing',
  user_type: 'anonymous'
});

// Track business events
window.seentics?.track('purchase_completed', {
  amount: 99.99,
  currency: 'USD',
  product: 'pro_plan'
});`}
                </pre>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
                <span>Events are processed in real-time and provide detailed insights into user behavior and business metrics.</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full Example Card */}
        <Card className="group bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-orange-600 to-red-600 rounded flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Terminal className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl md:text-2xl text-slate-900 dark:text-white mb-1 sm:mb-2">Complete integration example</CardTitle>
                <CardDescription className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400">See how to implement user identification and event tracking in a real application.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex gap-1 sm:gap-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
              </div>
              <pre className="rounded bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-3 sm:p-4 md:p-6 text-xs sm:text-sm md:text-base overflow-auto border border-slate-700 shadow-inner">{`// 1. Include the tracker script
<script src="/trackers/tracker.js" data-site-id="YOUR_SITE_ID"></script>

// 2. Identify users after login
function onUserLogin(user) {
  window.seentics?.identify(user.id, {
    email: user.email,
    name: user.name,
    plan: user.subscription?.plan,
    signup_date: user.created_at
  });
}

// 3. Track key user actions
function trackUserAction(action, properties = {}) {
  window.seentics?.track(action, {
    ...properties,
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent
  });
}

// 4. Use in your app
document.getElementById('signup-btn').addEventListener('click', () => {
  trackUserAction('signup_attempted', {
    source: 'hero_cta',
    page: 'landing'
  });
});

// 5. Track business metrics
function onPurchaseCompleted(order) {
  trackUserAction('purchase_completed', {
    order_id: order.id,
    amount: order.total,
    items: order.items.length,
    payment_method: order.payment_method
  });}`}
              </pre>
            </div>
            <div className="mt-3 sm:mt-4 flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <Cpu className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
              <span>This setup enables powerful behavioral tracking and business pattern analysis to optimize your website.</span>
            </div>
          </CardContent>
        </Card>

        {/* Call-to-Action Section */}
        <div className="mt-10 sm:mt-12 md:mt-16 text-center">
          <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-slate-900 dark:bg-white rounded text-white dark:text-slate-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <span className="text-base sm:text-lg md:text-xl font-semibold">Ready to integrate?</span>
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 group-hover:translate-x-1 transition-transform duration-300" />
          </div>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400">Get your site ID and start tracking in minutes</p>
        </div>
      </div>
    </section>
  );
}


