import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, ShoppingCart, TrendingUp, Clock, ArrowRight, CheckCircle } from 'lucide-react';

export default function VisualFunnels() {
  const funnelSteps = [
    {
      title: "User adds to cart",
      description: "Visitor adds items but hasn't purchased yet",
      color: "bg-slate-100 text-slate-700 border-slate-200",
      darkColor: "dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
    },
    {
      title: "Exit intent detected", 
      description: "User tries to leave without buying",
      color: "bg-orange-100 text-orange-700 border-orange-200",
      darkColor: "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
    },
    {
      title: "Show discount popup",
      description: "10% off + free shipping offer appears",
      color: "bg-green-100 text-green-700 border-green-200", 
      darkColor: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
    },
    {
      title: "Purchase completed",
      description: "Customer returns and buys with discount",
      color: "bg-purple-100 text-purple-700 border-purple-200",
      darkColor: "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
    }
  ];

  const results = [
    { label: "Recovery Rate", value: "15-25%", icon: TrendingUp, color: "text-green-600" },
    { label: "Revenue Boost", value: "8-12%", icon: ShoppingCart, color: "text-slate-600" },
    { label: "Setup Time", value: "5 min", icon: Clock, color: "text-purple-600" }
  ];

  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-16">
            <Badge className="mb-6 px-4 py-2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
              <GitBranch className="h-4 w-4 mr-2" />
              Visual Funnel Builder
            </Badge>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white">
              Build Visual Workflows
            </h2>
            
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Create automated customer journeys with our drag-and-drop editor. No coding required.
            </p>
          </div>

          {/* Simple Workflow Visualization */}
          <div className="mb-16">
            <div className="bg-white dark:bg-slate-800 rounded p-8 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 text-center">
                Simple Workflow Structure
              </h3>
              
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Trigger</span>
                </div>
                
                <ArrowRight className="h-5 w-5 text-slate-400" />
                
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Condition</span>
                </div>
                
                <ArrowRight className="h-5 w-5 text-slate-400" />
                
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                  <span className="font-medium text-green-700 dark:text-green-300">Action</span>
                </div>
                
                <ArrowRight className="h-5 w-5 text-slate-400" />
                
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800">
                  <span className="font-medium text-purple-700 dark:text-purple-300">Result</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real Example */}
          <Card className="bg-white dark:bg-slate-800 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">
                    Cart Abandonment Recovery
                  </CardTitle>
                  <p className="text-slate-600 dark:text-slate-400">
                    Automatically recover lost sales
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {/* Funnel Steps */}
              <div className="mb-8">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">
                  How It Works
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {funnelSteps.map((step, index) => (
                    <div key={index} className="relative">
                      {/* Arrow for desktop */}
                      {index < funnelSteps.length - 1 && (
                        <div className="hidden lg:block absolute top-1/2 -right-2 z-10">
                          <ArrowRight className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      
                      <div className={`p-4 rounded border ${step.color} ${step.darkColor} h-full`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                        </div>
                        <h5 className="font-semibold mb-2">{step.title}</h5>
                        <p className="text-sm opacity-80">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">
                  Expected Results
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded">
                      <div className="flex items-center gap-3">
                        <result.icon className={`h-5 w-5 ${result.color} dark:${result.color.replace('600', '400')}`} />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {result.label}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {result.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tip */}
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-950/30 rounded border border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      <strong>Pro tip:</strong> Test different discount amounts (5% vs 10%) 
                      to find what works best for your audience.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </section>
  );
}