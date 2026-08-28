// ============================================================
// POST /api/email-templates/seed — Seed default system email templates
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- email template builder -----------------------------------

function buildEmailHtml(title: string, mainContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style type="text/css">
    /* ---- Reset & Base ---- */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

    /* ---- Responsive ---- */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-content { padding: 20px 16px !important; }
      .email-header { padding: 20px 16px !important; }
      .email-footer { padding: 16px !important; }
      .fluid { width: 100% !important; max-width: 100% !important; height: auto !important; }
      .stack-column, .stack-column-center {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        direction: ltr !important;
      }
      .stack-column-center { text-align: center !important; }
      .center-on-narrow { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
      table.center-on-narrow { display: inline-block !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
      .mobile-full-width { width: 100% !important; min-width: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 8px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">
          <tr>
            <td class="email-header" style="background-color:#18181b;padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="word-break:break-word;">
                    <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">{{site.name}}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:32px;word-break:break-word;">
              ${mainContent}
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="padding:16px 32px;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#71717a;word-break:break-word;">&copy; {{current_year}} {{site.name}}. All rights reserved.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#71717a;">
                <a href="{{unsubscribe_url}}" style="color:#71717a;text-decoration:underline;word-break:break-all;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------- default templates ----------------------------------------

interface TemplateDef {
  name: string;
  slug: string;
  subject: string;
  previewText: string;
  category: string;
  htmlBody: string;
}

const DEFAULT_TEMPLATES: TemplateDef[] = [
  // 1. Welcome Email
  {
    name: 'Welcome Email',
    slug: 'welcome-email',
    subject: 'Welcome to {{site.name}}, {{customer.first_name}}!',
    previewText: 'We\'re thrilled to have you on board. Here\'s what you need to know to get started.',
    category: 'CUSTOMER_EMAILS',
    htmlBody: buildEmailHtml('Welcome', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Welcome aboard, {{customer.first_name}}! 🎉</h2>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">We\'re excited to have you join {{site.name}}. Your account has been successfully created and you\'re ready to explore everything we have to offer.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Here are a few things you can do to get started:</p>
              <ul style="margin:0 0 24px;padding-left:24px;font-size:16px;line-height:1.8;color:#3f3f46;">
                <li>Complete your <a href="{{profile_url}}" style="color:#18181b;font-weight:600;">profile</a></li>
                <li>Explore our <a href="{{features_url}}" style="color:#18181b;font-weight:600;">features</a></li>
                <li>Check out our <a href="{{help_url}}" style="color:#18181b;font-weight:600;">help center</a></li>
              </ul>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:14px;color:#71717a;">If you didn\'t create an account, please ignore this email.</p>
    `),
  },
  // 2. Email Verification
  {
    name: 'Email Verification',
    slug: 'email-verification',
    subject: 'Verify your email address — {{site.name}}',
    previewText: 'Please confirm your email address to activate your account.',
    category: 'AUTHENTICATION',
    htmlBody: buildEmailHtml('Email Verification', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Verify Your Email Address</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, please confirm your email address by clicking the button below. This link will expire in 24 hours.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{verification_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Verify Email Address</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;color:#71717a;">If the button above doesn\'t work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:14px;color:#3f3f46;word-break:break-all;">{{verification_url}}</p>
    `),
  },
  // 3. Password Reset
  {
    name: 'Password Reset',
    slug: 'password-reset',
    subject: 'Reset your password — {{site.name}}',
    previewText: 'We received a request to reset your password. Click the link to set a new one.',
    category: 'AUTHENTICATION',
    htmlBody: buildEmailHtml('Password Reset', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Reset Your Password</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, we received a request to reset your password. Click the button below to choose a new one. This link will expire in 1 hour.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{reset_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;color:#71717a;">If you didn\'t request a password reset, you can safely ignore this email. Your password won\'t be changed.</p>
              <p style="margin:0;font-size:14px;color:#71717a;">If the button doesn\'t work, use this link: {{reset_url}}</p>
    `),
  },
  // 4. Invite User
  {
    name: 'Invite User',
    slug: 'invite-user',
    subject: 'You\'re invited to join {{site.name}}',
    previewText: '{{inviter.name}} has invited you to join their team. Accept the invitation to get started.',
    category: 'AUTHENTICATION',
    htmlBody: buildEmailHtml('Team Invitation', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">You\'re Invited!</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, <strong>{{inviter.name}}</strong> has invited you to join <strong>{{site.name}}</strong> as a team member.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{invite_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#71717a;">This invitation will expire in 7 days. If you don\'t want to join, you can ignore this email.</p>
    `),
  },
  // 5. Newsletter Confirmation
  {
    name: 'Newsletter Confirmation',
    slug: 'newsletter-confirmation',
    subject: 'Confirm your newsletter subscription — {{site.name}}',
    previewText: 'Please confirm your subscription to stay up to date with our latest content.',
    category: 'NEWSLETTER',
    htmlBody: buildEmailHtml('Newsletter Confirmation', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Confirm Your Subscription</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, thanks for subscribing to the {{site.name}} newsletter! Please confirm your subscription by clicking the button below.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{confirm_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Confirm Subscription</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#71717a;">If you didn\'t subscribe, you can safely ignore this email.</p>
    `),
  },
  // 6. Newsletter Welcome
  {
    name: 'Newsletter Welcome',
    slug: 'newsletter-welcome',
    subject: 'You\'re in! Welcome to the {{site.name}} newsletter',
    previewText: 'Your subscription is confirmed. Here\'s what to expect from our newsletter.',
    category: 'NEWSLETTER',
    htmlBody: buildEmailHtml('Newsletter Welcome', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">You\'re In! 📬</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, your subscription to the {{site.name}} newsletter is now confirmed. We\'re glad to have you!</p>
              <h3 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#18181b;">What to Expect</h3>
              <ul style="margin:0 0 24px;padding-left:24px;font-size:16px;line-height:1.8;color:#3f3f46;">
                <li>Curated articles and insights delivered to your inbox</li>
                <li>Exclusive content and early access to new features</li>
                <li>Tips and best practices from our team</li>
              </ul>
              <p style="margin:0;font-size:14px;color:#71717a;">You can unsubscribe at any time using the link at the bottom of any email.</p>
    `),
  },
  // 7. Newsletter Campaign
  {
    name: 'Newsletter Campaign',
    slug: 'newsletter-campaign',
    subject: '{{newsletter.subject}}',
    previewText: '{{newsletter.preview_text}}',
    category: 'NEWSLETTER',
    htmlBody: buildEmailHtml('Newsletter', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">{{newsletter.subject}}</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}},</p>
              <div style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">{{newsletter.content}}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{newsletter.cta_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">{{newsletter.cta_text}}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#71717a;">You\'re receiving this because you subscribed to the {{site.name}} newsletter.</p>
    `),
  },
  // 8. Article Published
  {
    name: 'Article Published',
    slug: 'article-published',
    subject: 'New article published: {{article.title}}',
    previewText: 'A new article has been published on {{site.name}}. Check it out now.',
    category: 'MARKETING',
    htmlBody: buildEmailHtml('Article Published', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">New Article Published 📰</h2>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, a new article has been published on {{site.name}}:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f4f4f5;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <h3 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#18181b;">{{article.title}}</h3>
                    <p style="margin:0 0 12px;font-size:14px;color:#71717a;">By {{article.author}} · {{article.published_at}}</p>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">{{article.excerpt}}</p>
                    <a href="{{article.url}}" style="font-size:14px;font-weight:600;color:#18181b;text-decoration:none;">Read Full Article →</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 9. Article Scheduled
  {
    name: 'Article Scheduled',
    slug: 'article-scheduled',
    subject: 'Article scheduled: "{{article.title}}" will go live on {{article.scheduled_at}}',
    previewText: 'An article has been scheduled for publication. Review the details inside.',
    category: 'MARKETING',
    htmlBody: buildEmailHtml('Article Scheduled', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Article Scheduled ⏰</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">An article has been scheduled for publication on {{site.name}}.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">TITLE</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#18181b;font-weight:600;">{{article.title}}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">SCHEDULED FOR</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#18181b;">{{article.scheduled_at}}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">CATEGORY</p>
                    <p style="margin:0;font-size:16px;color:#18181b;">{{article.category}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{article.edit_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Edit Article</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 10. Article Review Request
  {
    name: 'Article Review Request',
    slug: 'article-review-request',
    subject: 'Review requested: "{{article.title}}"',
    previewText: 'A new article is awaiting your review before it can be published.',
    category: 'NOTIFICATIONS',
    htmlBody: buildEmailHtml('Review Request', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Review Requested 👀</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, an article has been submitted for your review:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">ARTICLE</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#18181b;font-weight:600;">{{article.title}}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">AUTHOR</p>
                    <p style="margin:0;font-size:16px;color:#18181b;">{{article.author}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{article.review_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review Article</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 11. Review Approved
  {
    name: 'Review Approved',
    slug: 'review-approved',
    subject: 'Your article has been approved: "{{article.title}}"',
    previewText: 'Great news! Your article has passed the review and is ready for publishing.',
    category: 'NOTIFICATIONS',
    htmlBody: buildEmailHtml('Review Approved', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Article Approved ✅</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, your article has been approved and is ready for publishing.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">ARTICLE</p>
                    <p style="margin:0;font-size:16px;color:#18181b;font-weight:600;">{{article.title}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{article.edit_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Publish Now</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 12. Review Rejected
  {
    name: 'Review Rejected',
    slug: 'review-rejected',
    subject: 'Your article needs changes: "{{article.title}}"',
    previewText: 'Your article review has been returned with feedback. Please review the comments.',
    category: 'NOTIFICATIONS',
    htmlBody: buildEmailHtml('Review Rejected', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Changes Requested 📝</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, your article has been reviewed and some changes are needed before it can be published.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">ARTICLE</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#18181b;font-weight:600;">{{article.title}}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">FEEDBACK</p>
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#3f3f46;">{{review.feedback}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{article.edit_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Edit Article</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 13. Comment Reply
  {
    name: 'Comment Reply',
    slug: 'comment-reply',
    subject: 'New reply to your comment on "{{article.title}}"',
    previewText: 'Someone has replied to your comment. See their response.',
    category: 'NOTIFICATIONS',
    htmlBody: buildEmailHtml('Comment Reply', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">New Reply to Your Comment 💬</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, <strong>{{comment.author}}</strong> has replied to your comment on <strong>{{article.title}}</strong>.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f4f4f5;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;border-left:3px solid #18181b;">
                    <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;line-height:1.6;">{{comment.content}}</p>
                    <p style="margin:0;font-size:12px;color:#71717a;">— {{comment.author}} · {{comment.created_at}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{comment.url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Reply</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 14. Comment Approved
  {
    name: 'Comment Approved',
    slug: 'comment-approved',
    subject: 'Your comment has been approved on "{{article.title}}"',
    previewText: 'Your comment has been approved and is now visible on the article.',
    category: 'NOTIFICATIONS',
    htmlBody: buildEmailHtml('Comment Approved', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Comment Approved ✅</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, your comment on <strong>{{article.title}}</strong> has been approved and is now publicly visible.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{comment.url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Comment</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 15. Comment Rejected
  {
    name: 'Comment Rejected',
    slug: 'comment-rejected',
    subject: 'Your comment on "{{article.title}}" was not approved',
    previewText: 'Your comment did not meet our community guidelines and was not approved.',
    category: 'NOTIFICATIONS',
    htmlBody: buildEmailHtml('Comment Rejected', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Comment Not Approved</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi {{customer.first_name}}, your comment on <strong>{{article.title}}</strong> was reviewed but could not be approved at this time.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">This may be because it did not meet our community guidelines. If you believe this was in error, please contact our support team.</p>
              <p style="margin:0;font-size:14px;color:#71717a;">Thank you for your understanding.</p>
    `),
  },
  // 16. Backup Completed
  {
    name: 'Backup Completed',
    slug: 'backup-completed',
    subject: 'Backup completed successfully — {{site.name}}',
    previewText: 'Your scheduled backup has been completed. All data has been safely stored.',
    category: 'SYSTEM',
    htmlBody: buildEmailHtml('Backup Completed', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Backup Completed ✅</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">A system backup has been completed successfully for <strong>{{site.name}}</strong>.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Backup ID: <strong style="color:#18181b;">{{backup.id}}</strong></p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Size: <strong style="color:#18181b;">{{backup.size}}</strong></p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Duration: <strong style="color:#18181b;">{{backup.duration}}</strong></p>
                    <p style="margin:0;font-size:14px;color:#71717a;">Completed: <strong style="color:#18181b;">{{backup.completed_at}}</strong></p>
                  </td>
                </tr>
              </table>
    `),
  },
  // 17. Backup Failed
  {
    name: 'Backup Failed',
    slug: 'backup-failed',
    subject: '⚠️ Backup failed — {{site.name}}',
    previewText: 'The scheduled backup encountered an error. Please check the details.',
    category: 'SYSTEM',
    htmlBody: buildEmailHtml('Backup Failed', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">Backup Failed ⚠️</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">The scheduled backup for <strong>{{site.name}}</strong> has failed. Please investigate the issue.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Error: <strong style="color:#dc2626;">{{backup.error}}</strong></p>
                    <p style="margin:0;font-size:14px;color:#71717a;">Attempted: <strong style="color:#18181b;">{{backup.attempted_at}}</strong></p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{backups_url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Backups</a>
                  </td>
                </tr>
              </table>
    `),
  },
  // 18. AI Generation Finished
  {
    name: 'AI Generation Finished',
    slug: 'ai-generation-finished',
    subject: 'AI content generation complete — {{generation.title}}',
    previewText: 'Your AI content generation task has been completed. Review the generated content.',
    category: 'SYSTEM',
    htmlBody: buildEmailHtml('AI Generation Finished', `
              <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;">AI Generation Complete 🤖</h2>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Your AI content generation task has been completed.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">TITLE</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#18181b;">{{generation.title}}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">WORDS GENERATED</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#18181b;">{{generation.words}}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#71717a;font-weight:600;">TOKENS USED</p>
                    <p style="margin:0;font-size:16px;color:#18181b;">{{generation.tokens}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="{{generation.url}}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review Content</a>
                  </td>
                </tr>
              </table>
    `),
  },
];

// =====================================================================
// POST — seed
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    // Parse body to detect scope=platform (platform-admin-only). When the
    // body is empty or not JSON, fall back to legacy client behavior.
    let bodyScope: string | undefined;
    try {
      const body = await request.json();
      bodyScope = typeof body === 'object' && body !== null
        ? (body as { scope?: unknown }).scope as string | undefined
        : undefined;
    } catch {
      // No body — legacy client seed. Default to client behavior.
    }
    const isPlatformScope = bodyScope === 'platform';

    // -------- scope=platform: platform admin can seed system templates
    // (siteId = null). Falls through to legacy client behavior otherwise.
    let platformCreatedById: string | null = null;
    if (isPlatformScope) {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      platformCreatedById = auth.user.id;
    }

    // Find a known user to use as createdById
    const firstUser = await db.user.findFirst({ select: { id: true } });
    if (!firstUser) {
      return NextResponse.json(
        { error: { code: 'NO_USER', message: 'No users found in the database. Create a user first.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const createdById = isPlatformScope && platformCreatedById ? platformCreatedById : firstUser.id;
    let seeded = 0;
    let skipped = 0;

    for (const tpl of DEFAULT_TEMPLATES) {
      const existing = await db.emailTemplate.findUnique({ where: { slug: tpl.slug } });
      if (existing) {
        skipped++;
        continue;
      }

      await db.emailTemplate.create({
        data: {
          // Platform-scope templates are system-level (siteId = null);
          // client-scope templates use the legacy behavior (also null here
          // since the seed route has always created system templates).
          siteId: null,
          name: tpl.name,
          slug: tpl.slug,
          subject: tpl.subject,
          previewText: tpl.previewText,
          htmlBody: tpl.htmlBody,
          defaultBody: tpl.htmlBody,
          category: tpl.category as 'CUSTOMER_EMAILS' | 'AUTHENTICATION' | 'NEWSLETTER' | 'MARKETING' | 'TRANSACTIONAL' | 'NOTIFICATIONS' | 'BILLING' | 'SYSTEM',
          status: 'ENABLED',
          provider: 'SMTP',
          isSystem: true,
          createdById,
        },
      });
      seeded++;
    }

    return NextResponse.json({
      data: { seeded, skipped, total: DEFAULT_TEMPLATES.length },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:SEED] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to seed email templates' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
