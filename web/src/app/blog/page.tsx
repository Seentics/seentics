import Link from 'next/link';
import { Calendar, User, Tag } from 'lucide-react';
import { getAllPosts } from '@/lib/blog';
import BlogCover from '@/components/blog/BlogCover';

export const metadata = {
  title: 'Blog | Seentics',
  description: 'Latest updates, guides, and insights about analytics and product tracking.',
};

function PostCard({ slug, meta }: any) {
  return (
    <Link href={`/blog/${slug}`} className="group flex flex-col rounded-lg overflow-hidden bg-card/50 hover:bg-card/80 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
      {/* Cover image */}
      <BlogCover
        slug={slug}
        tags={meta.tags}
        coverImage={meta.cover_image}
        title={meta.title}
        className="h-44 w-full"
      />

      {/* Card body */}
      <div className="flex flex-col flex-1 p-5 space-y-3">
        {/* Tags */}
        {meta.tags && meta.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meta.tags.slice(0, 2).map((tag: string) => (
              <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-primary/8 text-primary rounded-lg font-medium">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {meta.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
          {meta.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(meta.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>{meta.author}</span>
          </div>
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
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-12 md:pt-28 md:pb-14">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Guides, insights, and updates on analytics, user behavior, and product optimization.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.slug} slug={post.slug} meta={post.meta} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
