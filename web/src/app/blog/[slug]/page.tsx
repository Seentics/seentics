import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, User, Tag, ArrowLeft } from 'lucide-react';
import { getPostBySlug, getPostSlugs, getAllPosts } from '@/lib/blog';
import { remarkGfm } from 'remark-gfm';

export async function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) {
    return {};
  }
  return {
    title: `${post.meta.title} | Seentics Blog`,
    description: post.meta.description,
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex(p => p.slug === params.slug);
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  return (
    <article className="w-full">
      {/* Header */}
      <section className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to blog
        </Link>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {post.meta.title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {post.meta.description}
            </p>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-muted-foreground border-t border-border/50">
            <div className="flex items-center gap-2 pt-4">
              <Calendar className="w-4 h-4" />
              <time dateTime={post.meta.date}>
                {new Date(post.meta.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <User className="w-4 h-4" />
              <span>{post.meta.author}</span>
            </div>
          </div>

          {/* Tags */}
          {post.meta.tags && post.meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4">
              {post.meta.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-primary/5 text-primary rounded-lg border border-primary/20">
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:text-muted-foreground [&_a]:text-primary [&_a:hover]:underline [&_pre]:bg-muted [&_code]:text-foreground">
          <MDXRemote
            source={post.content}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
              },
            }}
          />
        </div>
      </section>

      {/* Next/Prev Navigation */}
      {(nextPost || prevPost) && (
        <section className="max-w-3xl mx-auto px-6 pb-24 border-t border-border/50 pt-12">
          <h3 className="text-sm font-semibold text-muted-foreground mb-6">Read more</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {prevPost && (
              <Link href={`/blog/${prevPost.slug}`} className="group relative rounded-lg border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/50 hover:bg-card/80">
                <div className="text-xs text-muted-foreground mb-2">Previous post</div>
                <h4 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                  {prevPost.meta.title}
                </h4>
              </Link>
            )}
            {nextPost && (
              <Link href={`/blog/${nextPost.slug}`} className="group relative rounded-lg border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/50 hover:bg-card/80 md:col-start-2">
                <div className="text-xs text-muted-foreground mb-2">Next post</div>
                <h4 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                  {nextPost.meta.title}
                </h4>
              </Link>
            )}
          </div>
        </section>
      )}
    </article>
  );
}
