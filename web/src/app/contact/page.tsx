'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, MessageSquare, MapPin, Clock, Send, ExternalLink, Github } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { Logo } from '@/components/ui/logo';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function ContactPage() {
  const { toast } = useToast();
  const t = useT().site.contact;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: 'general',
    message: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: t.invalidTitle,
        description: t.invalidBody,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const subjectLine = `[${formData.subject.toUpperCase()}] ${formData.name}${formData.company ? ` (${formData.company})` : ''}`;

      await api.post('/user/support/contact', {
        name: formData.name,
        email: formData.email,
        message: formData.message,
        subject: subjectLine,
      });

      toast({
        title: t.sentTitle,
        description: t.sentBody,
      });

      setFormData({
        name: '',
        email: '',
        company: '',
        subject: 'general',
        message: ''
      });
    } catch (error: any) {
      toast({
        title: t.errorTitle,
        description: error.message || t.errorBody,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo size="lg" showText={true} textClassName="font-headline text-2xl font-bold" />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/">{t.goHome}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto flex-1 py-8 lg:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="font-headline scroll-m-20 text-4xl font-bold tracking-tight mb-4">
              {t.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t.lead}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    {t.formTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t.name}</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder={t.namePlaceholder}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t.email}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder={t.emailPlaceholder}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">{t.company}</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => handleInputChange('company', e.target.value)}
                        placeholder={t.companyPlaceholder}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">{t.subject}</Label>
                      <Select value={formData.subject} onValueChange={(value) => handleInputChange('subject', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t.subjectPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">{t.subjects.general}</SelectItem>
                          <SelectItem value="technical">{t.subjects.technical}</SelectItem>
                          {isEnterprise && <SelectItem value="billing">{t.subjects.billing}</SelectItem>}
                          <SelectItem value="integration">{t.subjects.integration}</SelectItem>
                          {isEnterprise && <SelectItem value="enterprise">{t.subjects.enterprise}</SelectItem>}
                          <SelectItem value="partnership">{t.subjects.partnership}</SelectItem>
                          <SelectItem value="bug">{t.subjects.bug}</SelectItem>
                          <SelectItem value="feature">{t.subjects.feature}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">{t.message}</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        placeholder={t.messagePlaceholder}
                        rows={6}
                        required
                      />
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full h-16 rounded-lg font-bold text-lg shadow-lg active:scale-[0.98] transition-all">
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          {t.sending}
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-3" />
                          {t.send}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              {/* Contact Details */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.info}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t.emailLabel}</p>
                      <a href="mailto:seentics@gmail.com" className="text-muted-foreground hover:text-primary block">
                        seentics@gmail.com
                      </a>
                      <a href="mailto:shohagmiah2100@gmail.com" className="text-muted-foreground hover:text-primary block">
                        shohagmiah2100@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t.location}</p>
                      <p className="text-muted-foreground">
                        {t.locationValue}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t.responseTime}</p>
                      <p className="text-muted-foreground">
                        {t.responseA}<br />
                        {t.responseB}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.quickLinks}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/docs" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-4 w-4" />
                    {t.docs}
                  </Link>
                  {isEnterprise && (
                    <Link href="/signup" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-4 w-4" />
                      {t.startTrial}
                    </Link>
                  )}
                  {isEnterprise && (
                    <Link href="/pricing" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-4 w-4" />
                      {t.viewPricing}
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Community */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.community}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a href="https://github.com/Seentics/seentics" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                    <Github className="h-4 w-4" />
                    GitHub
                  </a>
                  <a href="https://discord.gg/eHNHR82add" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-[#5865F2]">
                    <FaDiscord className="h-4 w-4" />
                    Discord
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16">
            <h2 className="font-headline text-3xl font-bold text-center mb-8">
              {t.faqTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {t.faq.map((item) => (
                <Card key={item.q}>
                  <CardHeader>
                    <CardTitle className="text-lg">{item.q}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{item.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
