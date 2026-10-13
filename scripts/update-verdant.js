const fs = require('fs');

// 1. Update schema.prisma
const schemaPath = 'C:\\Users\\ABDELLAH AIT-SI\\Desktop\\Verdant\\prisma\\schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('status      String   @default("PENDING")')) {
  schema = schema.replace(
    /model Comment\s*\{[\s\S]*?\}/,
    `model Comment {
  id          String   @id @default(cuid())
  articleSlug String
  name        String
  email       String
  content     String
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())

  @@index([articleSlug, status])
}`
  );
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('Updated schema.prisma successfully');
} else {
  console.log('schema.prisma already updated');
}

// 2. Update types.ts
const typesPath = 'C:\\Users\\ABDELLAH AIT-SI\\Desktop\\Verdant\\src\\lib\\types.ts';
let types = fs.readFileSync(typesPath, 'utf8');
if (!types.includes('status?: string;')) {
  types = types.replace(
    /export interface Comment\s*\{([\s\S]*?)\}/,
    `export interface Comment {
  id: string;
  articleSlug: string;
  name: string;
  email: string;
  content: string;
  status?: string;
  createdAt: string;
}`
  );
  fs.writeFileSync(typesPath, types, 'utf8');
  console.log('Updated types.ts successfully');
} else {
  console.log('types.ts already updated');
}

// 3. Update src/app/api/comments/route.ts
const apiRoutePath = 'C:\\Users\\ABDELLAH AIT-SI\\Desktop\\Verdant\\src\\app\\api\\comments\\route.ts';
const newApiRoute = `import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const articleSlug = searchParams.get("articleSlug");

  if (!articleSlug) {
    return NextResponse.json(
      { error: "articleSlug is required" },
      { status: 400 }
    );
  }

  // Check global comment toggle setting
  const enableSetting = await db.siteSetting.findUnique({
    where: { key: "enable_comments" },
  });
  const commentsEnabled = enableSetting ? enableSetting.value !== "false" : true;

  // CANONICAL SECURITY & MODERATION RULE:
  // Public website MUST ONLY render comments that are APPROVED!
  const comments = await db.comment.findMany({
    where: {
      articleSlug,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      articleSlug: c.articleSlug,
      name: c.name,
      email: "",
      content: c.content,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Comments-Enabled": String(commentsEnabled),
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    // 1. Check if comments are enabled
    const enableSetting = await db.siteSetting.findUnique({
      where: { key: "enable_comments" },
    });
    if (enableSetting && enableSetting.value === "false") {
      return NextResponse.json(
        { error: "Comments are closed for this article." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { articleSlug, name, email, content } = body;

    if (!articleSlug || !name || !email || !content) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (content.trim().length < 5) {
      return NextResponse.json(
        { error: "Comment must be at least 5 characters" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // 2. Auto Spam Detection
    let initialStatus = "PENDING";

    const spamSetting = await db.siteSetting.findUnique({
      where: { key: "comment_auto_spam_detection" },
    });
    const autoSpamEnabled = spamSetting ? spamSetting.value !== "false" : true;

    if (autoSpamEnabled) {
      const cleanContent = content.trim().toLowerCase();
      const spamKeywords = [
        "viagra", "cialis", "casino", "poker", "slot machine", "free spins",
        "crypto giveaway", "bitcoin profit", "telegram @", "whatsapp +",
        "buy followers", "seo ranking", "backlinks", "loan offer", "porn",
        "hookup", "dating service", "investment opportunity"
      ];
      
      const linkCount = (content.match(/https?:\\/\\//gi) || []).length;
      const hasSpamKeyword = spamKeywords.some((kw) => cleanContent.includes(kw));

      if (linkCount >= 3 || hasSpamKeyword) {
        initialStatus = "SPAM";
      }
    }

    const comment = await db.comment.create({
      data: {
        articleSlug,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        content: content.trim(),
        status: initialStatus,
      },
    });

    return NextResponse.json({
      id: comment.id,
      articleSlug: comment.articleSlug,
      name: comment.name,
      email: "",
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt.toISOString(),
      message:
        initialStatus === "SPAM"
          ? "Your comment was flagged for moderator review."
          : "Thank you! Your comment has been submitted and is awaiting approval by a moderator.",
    });
  } catch (error) {
    console.error("POST /api/comments error:", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }
}
`;
fs.writeFileSync(apiRoutePath, newApiRoute, 'utf8');
console.log('Updated Verdant api/comments/route.ts successfully');

// 4. Update src/components/blog/CommentSection.tsx
const commentSectionPath = 'C:\\Users\\ABDELLAH AIT-SI\\Desktop\\Verdant\\src\\components\\blog\\CommentSection.tsx';
const newCommentSection = `"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, User, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Comment } from "@/lib/types";

function formatCommentDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="py-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-foreground">{comment.name}</span>
            <span className="text-xs text-muted-foreground">says:</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">{comment.content}</p>
          <time
            dateTime={comment.createdAt}
            className="mt-2 block text-xs text-muted-foreground"
          >
            {formatCommentDate(comment.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}

export function CommentSection({ articleSlug }: { articleSlug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(\`/api/comments?articleSlug=\${encodeURIComponent(articleSlug)}\`, {
        cache: "no-store",
      });
      if (res.ok) {
        const isEnabledHeader = res.headers.get("X-Comments-Enabled");
        if (isEnabledHeader !== null) {
          setCommentsEnabled(isEnabledHeader !== "false");
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setComments(data);
        }
      }
    } catch {
      // Silently fail — comments are non-critical
    }
  }, [articleSlug]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleSlug, name, email, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      const data = await res.json();
      setSuccessMessage(
        data.message || "Thank you! Your comment has been submitted and is awaiting moderation."
      );
      setName("");
      setEmail("");
      setContent("");
    } catch {
      setError("Failed to post comment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2
        id="comments-heading"
        className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl"
      >
        {comments.length > 0
          ? \`\${comments.length} Comment\${comments.length !== 1 ? "s" : ""}\`
          : "Leave a Reply"}
      </h2>

      {comments.length === 0 && commentsEnabled && (
        <p className="mt-2 text-sm text-muted-foreground">
          Your email address will not be published. Required fields are marked{" "}
          <span className="text-destructive">*</span>
        </p>
      )}

      {/* Closed comments notice */}
      {!commentsEnabled ? (
        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Comments are closed for this article.
        </div>
      ) : (
        /* Comment Form */
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {successMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div>
            <label htmlFor="comment-text" className="sr-only">Comment *</label>
            <Textarea
              id="comment-text"
              placeholder="Comment *"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="comment-name" className="sr-only">Name *</label>
              <Input
                id="comment-name"
                placeholder="Name *"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="comment-email" className="sr-only">Email *</label>
              <Input
                id="comment-email"
                type="email"
                placeholder="Email *"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Posting..." : "Post Comment"}
            <Send className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      )}

      {/* Comments List — only approved comments */}
      {comments.length > 0 && (
        <div className="mt-10 divide-y">
          <h3 className="font-serif text-xl tracking-tight text-foreground sm:text-2xl mb-4">
            {comments.length} Comment{comments.length !== 1 ? "s" : ""}
          </h3>
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </section>
  );
}
`;
fs.writeFileSync(commentSectionPath, newCommentSection, 'utf8');
console.log('Updated Verdant CommentSection.tsx successfully');
