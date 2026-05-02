import Link from 'next/link';
import { Calendar, User, Tag } from 'lucide-react';
import { getAllPosts } from '@/lib/blog';

export const metadata = {
  title: 'Blog | Seentics',
  description: 'Latest updates, guides, and insights about analytics and product tracking.',
};

function PostCard({ slug, meta }: any) {
  return (
    <Link href={`/blog/${slug}`}>
      <div className="group relative rounded-xl border border-border/50 bg-card/50 p-6 transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-md">
        <div className="space-y-3">
          {/* Title */}
          <h3 className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors line-clamp-2">
            {meta.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {meta.description}
          </p>

          {/* Meta: Date, Author */}
          <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(meta.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{meta.author}</span>
            </div>
          </div>

          {/* Tags */}
          {meta.tags && meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {meta.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-primary/5 text-primary rounded-md border border-primary/20">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hover arrow indicator */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-primary">→</div>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="w-full">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Latest updates, guides, and insights about analytics, user behavior tracking, and product optimization.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <PostCard key={post.slug} slug={post.slug} meta={post.meta} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
