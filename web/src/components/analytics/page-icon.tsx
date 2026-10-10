import { BarChart3, CreditCard, DollarSign, FileText, Globe, Home, Info, LogIn, Package, Phone, Settings, Shield, ShoppingCart, Users, Workflow, Zap } from 'lucide-react';

/** The path of a URL, or the string itself minus its query when it is not a full URL. */
export const getPathFromUrl = (url: string) => {
  if (!url) return '/';
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url.split('?')[0];
  }
};

/**
 * An icon for a page, picked from its path — home, blog, pricing and so on — so the same
 * page looks the same in Top Pages, the heatmaps list and a heatmap's toolbar.
 */
export const getPageIcon = (page: string, className = 'w-4 h-4') => {
  if (!page) return <Globe className={`${className} text-gray-500`} />;
  const path = getPathFromUrl(page).toLowerCase();

  if (path === '/') return <Home className={`${className} text-indigo-500`} />;

  // App-specific paths
  if (path.includes('/heatmaps')) return <Zap className={`${className} text-orange-500`} />;
  if (path.includes('/replays')) return <Workflow className={`${className} text-purple-500`} />;
  if (path.includes('/funnels')) return <Workflow className={`${className} text-indigo-500`} />;
  if (path.includes('/automations')) return <Zap className={`${className} text-yellow-500`} />;
  if (path.includes('/revenue')) return <DollarSign className={`${className} text-green-600`} />;
  if (path.includes('/dashboard')) return <BarChart3 className={`${className} text-indigo-500`} />;
  if (path.includes('/admin')) return <Shield className={`${className} text-red-500`} />;
  if (path.includes('/websites')) return <Globe className={`${className} text-indigo-500`} />;
  if (path.includes('/billing') || path.includes('/subscriptions')) return <CreditCard className={`${className} text-indigo-500`} />;
  if (path.includes('/team')) return <Users className={`${className} text-blue-500`} />;
  if (path.includes('/users')) return <Users className={`${className} text-blue-500`} />;
  if (path.includes('/storage')) return <Package className={`${className} text-gray-500`} />;

  // Generic patterns
  if (path.includes('/blog') || path.includes('/post')) return <FileText className={`${className} text-green-500`} />;
  if (path.includes('/about')) return <Info className={`${className} text-indigo-500`} />;
  if (path.includes('/contact')) return <Phone className={`${className} text-orange-500`} />;
  if (path.includes('/pricing')) return <DollarSign className={`${className} text-yellow-500`} />;
  if (path.includes('/products') || path.includes('/product/')) return <Package className={`${className} text-indigo-500`} />;
  if (path.includes('/analytics')) return <BarChart3 className={`${className} text-indigo-500`} />;
  if (path.includes('/auth') || path.includes('/login')) return <LogIn className={`${className} text-gray-500`} />;
  if (path.includes('/settings')) return <Settings className={`${className} text-gray-600`} />;
  if (path.includes('/cart')) return <ShoppingCart className={`${className} text-indigo-600`} />;

  return <Globe className={`${className} text-indigo-500`} />;
};
