import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Calendar, Clock, User, ArrowRight } from "lucide-react";

import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { RegistrationProvider, useRegistration } from "@/components/site/registration-context";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import milanHeadshot from "@/assets/milan-headshot-transparent.png";
import { track, trackOutboundCredibilityClick } from "@/lib/analytics";

export interface BlogArticleViewProps {
  title: string;
  leadParagraph: ReactNode;
  category: string;
  author?: string;
  publishDate?: string;
  isoDate?: string;
  readingTime?: string;
  tags?: string[];
  breadcrumbTitle?: string;
  children: ReactNode;
  contentTrackingName?: string;
}

export function BlogArticleView({
  title,
  leadParagraph,
  category,
  author = "Milan Dodhia",
  publishDate = "October 13, 2026",
  readingTime = "5 min read",
  tags = [],
  breadcrumbTitle,
  children,
  contentTrackingName,
}: BlogArticleViewProps) {
  useEffect(() => {
    if (contentTrackingName) {
      track("ViewContent", {
        content_name: contentTrackingName,
        content_type: "article",
      });
    }
  }, [contentTrackingName]);

  return (
    <RegistrationProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <article className="mx-auto max-w-3xl px-4">
            {/* Breadcrumb Navigation */}
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/blog">Blog</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{breadcrumbTitle || title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Header / Meta */}
            <header className="space-y-4 border-b border-border pb-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-caps rounded-full border border-[var(--brass)]/60 bg-[var(--brass)]/10 px-3 py-1 text-[var(--brass)]">
                  {category}
                </span>
                {tags.length > 0 ? (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{tags[0]}</span>
                  </>
                ) : null}
              </div>

              <h1 className="text-[clamp(2rem,4.5vw,3rem)] leading-[1.14] font-bold tracking-tight text-foreground text-balance">
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground sm:text-sm">
                <div className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4 text-[var(--brass)]" />
                  <span>{author}</span>
                </div>
                <span>·</span>
                <div className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[var(--brass)]" />
                  <time dateTime="2026-10-13">{publishDate}</time>
                </div>
                <span>·</span>
                <div className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-[var(--brass)]" />
                  <span>{readingTime}</span>
                </div>
              </div>
            </header>

            {/* Article Content */}
            <div className="pt-8 text-foreground/90 leading-relaxed text-base sm:text-lg space-y-6">
              <div className="font-semibold text-lg sm:text-xl leading-relaxed text-foreground">
                {leadParagraph}
              </div>

              {children}

              {/* Author Attribution & More Insights from Milan Dodhia */}
              <div className="mt-12 rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                    <img
                      src={milanHeadshot}
                      alt="Milan Dodhia"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-display text-base font-bold text-foreground">{author}</p>
                    <p className="text-xs text-muted-foreground">Founder, OnePagePlan | Financial Educator</p>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/60 pt-4">
                  <h4 className="font-display text-base font-bold text-foreground">
                    More insights from Milan Dodhia
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    Explore more perspectives on financial clarity, family wealth and informed financial decisions.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <a
                      href="https://substack.com/@themilanaireletter"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Read The Milanaire Letter on Substack (opens in a new tab)"
                      onClick={() => trackOutboundCredibilityClick("substack", "article_footer")}
                      className="inline-flex items-center font-medium text-primary underline underline-offset-4 transition-colors hover:text-[var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      Read The Milanaire Letter →
                    </a>
                    <a
                      href="https://www.linkedin.com/in/milanaire-me"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Follow Milan on LinkedIn (opens in a new tab)"
                      onClick={() => trackOutboundCredibilityClick("linkedin", "article_footer")}
                      className="inline-flex items-center font-medium text-primary underline underline-offset-4 transition-colors hover:text-[var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      Follow Milan on LinkedIn →
                    </a>
                  </div>
                </div>
              </div>

              {/* Primary One Page Plan CTA Box */}
              <ArticleCtaBox />

              {/* Article Footer & Tags */}
              <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4 hover:text-[var(--highlight)]"
                >
                  ← Back to all articles
                </Link>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </main>
        <Footer />
      </div>
    </RegistrationProvider>
  );
}

function ArticleCtaBox() {
  const { open } = useRegistration();

  const handleCtaClick = () => {
    track("Contact", { content_name: "blog_primary_cta" });
    open();
  };

  return (
    <div className="my-12 rounded-xl border border-[var(--brass)]/40 bg-card p-6 sm:p-8 shadow-xs">
      <div className="space-y-3">
        <p className="label-caps text-xs text-[var(--brass)]">For One Page Plan readers</p>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Know where your family&apos;s finances stand.
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Explore One Page Plan to see how a clear financial overview can help you identify what
          deserves your attention.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Button
          onClick={handleCtaClick}
          className="h-auto bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground hover:bg-[var(--highlight)] transition-colors"
        >
          See your financial life as a whole →
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Before doing more with your money, understand what you already have.
      </p>
    </div>
  );
}
