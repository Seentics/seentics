
'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X, Bot, Send, MessageCircle, MessageSquareText, Zap, Star, Heart, ArrowRight } from 'lucide-react';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { handleLandingPageAssistant, handleFeedbackSubmit } from '@/app/actions/ai';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

type Message = {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

function FeedbackForm() {
    const [feedback, setFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState<'general' | 'bug' | 'feature' | 'praise'>('general');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback.trim()) return;
        setIsSubmitting(true);
        try {
            await handleFeedbackSubmit(feedback);
            toast({
                title: 'Feedback Sent!',
                description: "Thank you for your thoughts. We appreciate it!",
            });
            setFeedback('');
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Could not send feedback. Please try again later.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="space-y-2">
                <Label htmlFor="feedback-type">Feedback Type</Label>
                <div className="flex flex-wrap gap-2">
                    {[
                        { value: 'general', label: 'General', icon: MessageCircle },
                        { value: 'bug', label: 'Bug Report', icon: Zap },
                        { value: 'feature', label: 'Feature Request', icon: Star },
                        { value: 'praise', label: 'Praise', icon: Heart }
                    ].map((type) => (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => setFeedbackType(type.value as any)}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-all ${
                                feedbackType === type.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary hover:bg-secondary/80'
                            }`}
                        >
                            <type.icon className="h-4 w-4" />
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="feedback-textarea">Your Feedback</Label>
                <Textarea
                    id="feedback-textarea"
                    placeholder="What's on your mind? We'd love to hear from you!"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={6}
                    disabled={isSubmitting}
                    className="resize-none"
                />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Feedback
            </Button>
        </form>
    )
}

export function LandingPageChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState('assistant');

  useEffect(() => {
    // Show the proactive prompt after a delay
    const timer = setTimeout(() => {
      if (!isOpen) {
        setShowPrompt(true);
      }
    }, 3000); // 3-second delay
    return () => clearTimeout(timer);
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleOpenChat = () => {
    setIsOpen(true);
    setShowPrompt(false);
    setActiveTab('assistant');
    if (messages.length === 0) {
      setMessages([{ 
        role: 'assistant', 
        content: "👋 **Welcome to Seentics!** I'm your AI assistant, here to help you discover how we can transform your website with powerful analytics and automation.\n\n**What would you like to know about?**\n\n• 🚀 **Getting Started** - Quick setup guide\n• 💰 **Pricing & Plans** - Find the perfect plan\n• ⚡ **Features** - Analytics & workflows\n• 🔗 **Integrations** - Connect with your tools\n• 🛡️ **Privacy & Security** - GDPR compliant\n• 📞 **Support** - We're here to help",
        timestamp: new Date()
      }]);
    }
  };
 
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const response = await handleLandingPageAssistant({ 
            message: input,
            conversationHistory: messages 
        });
        if (response.error) {
            throw new Error(response.error);
        }
        if (response.response) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: response.response || 'Sorry, I couldn\'t generate a response. Please try again.',
                timestamp: new Date()
            }]);
        }
    } catch (error: any) {
         toast({
            title: 'Error',
            description: error.message || 'Failed to get a response. Please try again.',
            variant: 'destructive',
        });
        console.error(error);
    } finally {
        setIsLoading(false);
    }
  }

  const quickActions = [
    { text: "Tell me about pricing", icon: "💰" },
    { text: "What features do you offer?", icon: "⚡" },
    { text: "How do I get started?", icon: "🚀" },
    { text: "What about privacy?", icon: "🛡️" },
    { text: "Show me workflows", icon: "🔄" },
    { text: "Integration options", icon: "🔗" }
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
        <div className="fixed bottom-6 right-6 z-50">
            <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="w-[380px] h-[600px] sm:w-[420px] sm:h-[650px] origin-bottom-right"
                 >
                    <Card className="h-full flex flex-col shadow-2xl border-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                        <CardHeader className="flex-row items-center justify-between pb-3 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20 rounded-t-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-lg">
                                    <Bot className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">Seentics AI Assistant</CardTitle>
                                    <CardDescription className="text-xs text-slate-600 dark:text-slate-400">Your personal guide to Seentics</CardDescription>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-slate-200/50 dark:hover:bg-slate-700/50" 
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-4 w-4"/>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 flex flex-col">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                                <div className="px-6 pt-2">
                                     <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800">
                                        <TabsTrigger value="assistant" className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4"/> Assistant
                                        </TabsTrigger>
                                        <TabsTrigger value="feedback" className="flex items-center gap-2">
                                            <MessageSquareText className="h-4 w-4"/> Feedback
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value="assistant" className="flex-1 flex flex-col mt-0">
                                    <div className="flex-1 py-4 px-6 space-y-4 overflow-y-auto max-h-[400px]">
                                        {messages.map((msg, index) => (
                                            <motion.div 
                                                key={index} 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                                className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                                            >
                                                {msg.role === 'assistant' && (
                                                    <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-md">
                                                        <Bot className="h-4 w-4 text-white" />
                                                    </div>
                                                )}
                                                <div className={`rounded p-4 max-w-[85%] text-sm shadow-sm ${
                                                    msg.role === 'user' 
                                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                                                        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50'
                                                }`}>
                                                    <div className="whitespace-pre-line leading-relaxed">
                                                        {msg.content.split('**').map((part, index) => 
                                                            index % 2 === 0 ? part : <strong key={index}>{part}</strong>
                                                        )}
                                                    </div>
                                                    {msg.timestamp && (
                                                        <div className={`text-xs mt-2 ${
                                                            msg.role === 'user' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                            {formatTime(msg.timestamp)}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                        {isLoading && (
                                            <motion.div 
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-start gap-3"
                                            >
                                                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-md">
                                                    <Bot className="h-4 w-4 text-white" />
                                                </div>
                                                <div className="rounded p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500"/>
                                                        <span className="text-slate-600 dark:text-slate-400">Thinking...</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                        
                                        {/* Quick Actions */}
                                        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !isLoading && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-3"
                                            >
                                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Quick actions:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {quickActions.map((action, index) => (
                                                        <button
                                                            key={index}
                                                            onClick={() => setInput(action.text)}
                                                            className="flex items-center gap-2 text-xs px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded transition-all cursor-pointer border border-slate-200/50 dark:border-slate-700/50 group"
                                                        >
                                                            <span className="text-base">{action.icon}</span>
                                                            <span className="truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                {action.text}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                        
                                        <div ref={messagesEndRef} />
                                    </div>
                                    <Separator className="mx-6" />
                                    <div className="p-4">
                                         <form onSubmit={handleSendMessage} className="flex w-full items-center gap-3">
                                            <Input
                                                value={input}
                                                onChange={e => setInput(e.target.value)}
                                                placeholder="Ask me anything about Seentics..."
                                                disabled={isLoading}
                                                className="flex-1 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                                            />
                                            <Button 
                                                type="submit" 
                                                size="icon" 
                                                disabled={isLoading || !input.trim()}
                                                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    </div>
                                </TabsContent>
                                <TabsContent value="feedback" className="flex-1 mt-0">
                                    <FeedbackForm />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
            </AnimatePresence>
            
            <AnimatePresence>
            {!isOpen && showPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <button
                  onClick={handleOpenChat}
                  className="group flex items-center gap-4 p-4 rounded bg-white/90 dark:bg-slate-800/90 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xl hover:scale-105"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Questions or Feedback?</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">I'm here to help!</span>
                  </div>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    </>
  );
}
