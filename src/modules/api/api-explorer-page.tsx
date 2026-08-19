'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Send,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Key,
  Loader2,
  Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { METHOD_COLORS } from '@/lib/api-constants';
import { toast } from 'sonner';

// -------------------- Types --------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ResponseState = {
  status: number | null;
  statusText: string;
  duration: number;
  headers: Record<string, string>;
  body: string;
};

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

// -------------------- Constants --------------------

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const STATUS_COLOR_MAP: Record<string, string> = {
  '2': 'text-emerald-600 dark:text-emerald-400',
  '3': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  '4': 'text-amber-600 dark:text-amber-400',
  '5': 'text-red-600 dark:text-red-400',
};

function getStatusColorClass(status: number): string {
  const firstDigit = String(status)[0];
  return STATUS_COLOR_MAP[firstDigit] ?? 'text-muted-foreground';
}

let headerRowIdCounter = 0;
function createHeaderRow(key = '', value = ''): HeaderRow {
  return { id: `h-${++headerRowIdCounter}`, key, value };
}

// -------------------- Code Generation --------------------

function generateCurl(
  method: HttpMethod,
  url: string,
  headers: HeaderRow[],
  body: string
): string {
  const lines: string[] = [`curl -X ${method} '${url}'`];
  headers.forEach((h) => {
    if (h.key.trim()) {
      lines.push(`  -H '${h.key}: ${h.value}'`);
    }
  });
  if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
    lines.push(`  -d '${body}'`);
  }
  return lines.join(' \\\n');
}

function generateJavaScript(
  method: HttpMethod,
  url: string,
  headers: HeaderRow[],
  body: string
): string {
  const headerObj: Record<string, string> = {};
  headers.forEach((h) => {
    if (h.key.trim()) headerObj[h.key] = h.value;
  });

  const options: string[] = [`  method: '${method}'`];
  if (Object.keys(headerObj).length > 0) {
    options.push(`  headers: ${JSON.stringify(headerObj, null, 4)}`);
  }
  if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
    options.push(`  body: JSON.stringify(${body})`);
  }

  return `const response = await fetch('${url}', {\n${options.join(',\n')}\n});\n\nconst data = await response.json();\nconsole.log(data);`;
}

function generatePython(
  method: HttpMethod,
  url: string,
  headers: HeaderRow[],
  body: string
): string {
  const headerObj: Record<string, string> = {};
  headers.forEach((h) => {
    if (h.key.trim()) headerObj[h.key] = h.value;
  });

  let code = `import requests\n\n`;
  if (Object.keys(headerObj).length > 0) {
    const formattedHeaders = JSON.stringify(headerObj, null, 4);
    code += `headers = ${formattedHeaders}\n\n`;
  }
  if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
    code += `payload = ${body}\n\n`;
    code += `response = requests.${method.toLowerCase()}('${url}', headers=headers, json=payload)`;
  } else if (Object.keys(headerObj).length > 0) {
    code += `response = requests.${method.toLowerCase()}('${url}', headers=headers)`;
  } else {
    code += `response = requests.${method.toLowerCase()}('${url}')`;
  }
  code += `\n\nprint(response.status_code)\nprint(response.json())`;
  return code;
}

function generatePhp(
  method: HttpMethod,
  url: string,
  headers: HeaderRow[],
  body: string
): string {
  const headerLines: string[] = [];
  headers.forEach((h) => {
    if (h.key.trim()) {
      headerLines.push(`    "${h.key}: ${h.value}"`);
    }
  });

  let code = `<?php\n\n$ch = curl_init('${url}');`;
  if (headerLines.length > 0) {
    code += `\ncurl_setopt($ch, CURLOPT_HTTPHEADER, [\n${headerLines.join(',\n')}\n]);`;
  }
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    code += `\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');`;
    if (body.trim()) {
      code += `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'")}');`;
    }
  }
  code += `\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n\n$response = curl_exec($ch);`;
  code += `\n$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);`;
  code += `\ncurl_close($ch);\n\necho $httpCode . "\\n";`;
  code += `\necho $response . "\\n";`;
  return code;
}

function generateNodeFetch(
  method: HttpMethod,
  url: string,
  headers: HeaderRow[],
  body: string
): string {
  const headerObj: Record<string, string> = {};
  headers.forEach((h) => {
    if (h.key.trim()) headerObj[h.key] = h.value;
  });

  const options: string[] = [`    method: '${method}'`];
  if (Object.keys(headerObj).length > 0) {
    options.push(`    headers: ${JSON.stringify(headerObj, null, 4).split('\n').join('\n    ')}`);
  }
  if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
    options.push(`    body: JSON.stringify(${body})`);
  }

  return `// node-fetch or native fetch (Node 18+)
const fetch = require('node-fetch');\n\n(async () => {\n  try {\n    const response = await fetch('${url}', {\n${options.join(',\n')}\n    });\n\n    const data = await response.json();\n    console.log(response.status, data);\n  } catch (error) {\n    console.error('Request failed:', error);\n  }\n})();`;
}

// -------------------- Copy Button --------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Button
      variant='ghost'
      size='icon'
      className='h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground'
      onClick={handleCopy}
    >
      {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
    </Button>
  );
}

// -------------------- Main Component --------------------

export function ApiExplorerPage() {
  // Request state
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('/api/content');
  const [apiKey, setApiKey] = useState('');
  const [customHeaders, setCustomHeaders] = useState<HeaderRow[]>([]);
  const [body, setBody] = useState('{\n  "key": "value"\n}');

  // Response state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState('curl');

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  // Validate JSON body
  const validateBody = useCallback((value: string) => {
    if (!hasBody || !value.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [hasBody]);

  const handleBodyChange = useCallback(
    (value: string) => {
      setBody(value);
      validateBody(value);
    },
    [validateBody]
  );

  // Update validation when method changes
  React.useEffect(() => {
    validateBody(body);
  }, [method, body, validateBody]);

  // Header management
  const addHeader = useCallback(() => {
    setCustomHeaders((prev) => [...prev, createHeaderRow()]);
  }, []);

  const removeHeader = useCallback((id: string) => {
    setCustomHeaders((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const updateHeader = useCallback((id: string, field: 'key' | 'value', val: string) => {
    setCustomHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  }, []);

  // Build all headers for request & code generation
  const allHeaders = useMemo<HeaderRow[]>(() => {
    const base: HeaderRow[] = [];
    if (apiKey.trim()) {
      base.push(createHeaderRow('Authorization', `Bearer ${apiKey.trim()}`));
    }
    if (hasBody) {
      base.push(createHeaderRow('Content-Type', 'application/json'));
    }
    // Dedupe by key — custom headers override base
    const map = new Map<string, HeaderRow>();
    base.forEach((h) => { if (h.key) map.set(h.key.toLowerCase(), h); });
    customHeaders.forEach((h) => { if (h.key) map.set(h.key.toLowerCase(), h); });
    return Array.from(map.values());
  }, [apiKey, hasBody, customHeaders]);

  // Code snippets
  const codeSnippets = useMemo(() => {
    return {
      curl: generateCurl(method, url, allHeaders, body),
      javascript: generateJavaScript(method, url, allHeaders, body),
      python: generatePython(method, url, allHeaders, body),
      php: generatePhp(method, url, allHeaders, body),
      nodejs: generateNodeFetch(method, url, allHeaders, body),
    };
  }, [method, url, allHeaders, body]);

  // Send request
  const sendRequest = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    if (hasBody && jsonError) {
      toast.error('Please fix JSON errors before sending');
      return;
    }

    setLoading(true);
    setResponse(null);
    const startTime = performance.now();

    try {
      const headers: Record<string, string> = {};
      allHeaders.forEach((h) => {
        if (h.key.trim()) headers[h.key.trim()] = h.value;
      });

      const fetchOptions: RequestInit = {
        method,
        headers,
        credentials: 'include',
      };

      if (hasBody && body.trim()) {
        fetchOptions.body = body;
      }

      const res = await fetch(url, fetchOptions);
      const duration = Math.round(performance.now() - startTime);

      // Collect response headers
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      // Parse response body
      let bodyText: string;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const json = await res.json();
          bodyText = JSON.stringify(json, null, 2);
        } catch {
          bodyText = '(Failed to parse JSON response)';
        }
      } else {
        bodyText = await res.text();
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        duration,
        headers: resHeaders,
        body: bodyText,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      setResponse({
        status: 0,
        statusText: 'Network Error',
        duration,
        headers: {},
        body: err instanceof Error ? err.message : 'An unknown error occurred',
      });
      toast.error('Request failed');
    } finally {
      setLoading(false);
    }
  }, [url, method, hasBody, body, jsonError, allHeaders]);

  // Keyboard shortcut
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        sendRequest();
      }
    },
    [sendRequest]
  );

  return (
    <div className='space-y-6' onKeyDown={handleKeyDown}>
      {/* Page Header */}
      <div className='flex items-center gap-3'>
        <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10'>
          <Code2 className='h-5 w-5 text-primary' />
        </div>
        <div>
          <h2 className='text-xl font-bold tracking-tight'>API Explorer</h2>
          <p className='text-sm text-muted-foreground'>
            Test API endpoints interactively  •  <kbd className='rounded border bg-muted px-1.5 py-0.5 text-xs font-mono'>⌘↩</kbd> to send
          </p>
        </div>
      </div>

      {/* Request Builder */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>Request</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Method + URL Row */}
          <div className='flex gap-2'>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as HttpMethod)}
            >
              <SelectTrigger className='w-[130px] shrink-0'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className='flex items-center gap-2'>
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold',
                          METHOD_COLORS[m]
                        )}
                      >
                        {m}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type='text'
              placeholder='/api/content?page=1&pageSize=10'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className='font-mono text-sm'
            />
            <Button
              onClick={sendRequest}
              disabled={loading || !url.trim()}
              className='shrink-0'
            >
              {loading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Send className='h-4 w-4' />
              )}
              <span className='ml-2 hidden sm:inline'>Send</span>
            </Button>
          </div>

          {/* Authorization */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <Key className='h-4 w-4 text-muted-foreground' />
              <Label className='text-sm font-medium'>Authorization</Label>
              <span className='text-xs text-muted-foreground'>
                (Auto-prepends &quot;Bearer &quot;)
              </span>
            </div>
            <Input
              type='text'
              placeholder='cms_live_xxxxxxxxxxxxxxxxxxxx'
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className='font-mono text-sm'
            />
          </div>

          <Separator />

          {/* Custom Headers */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-medium'>Headers</Label>
              <Button
                variant='outline'
                size='sm'
                onClick={addHeader}
                className='h-7 text-xs'
              >
                <Plus className='mr-1 h-3 w-3' />
                Add Header
              </Button>
            </div>
            <div className='space-y-2'>
              {customHeaders.length === 0 && (
                <p className='text-xs text-muted-foreground py-1'>
                  No custom headers. Authorization and Content-Type headers are added automatically.
                </p>
              )}
              {customHeaders.map((h) => (
                <div key={h.id} className='flex items-center gap-2'>
                  <Input
                    type='text'
                    placeholder='Header name'
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                    className='flex-1 font-mono text-xs h-8'
                  />
                  <Input
                    type='text'
                    placeholder='Header value'
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                    className='flex-1 font-mono text-xs h-8'
                  />
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive'
                    onClick={() => removeHeader(h.id)}
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Request Body */}
          {hasBody && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label className='text-sm font-medium'>Request Body</Label>
                {jsonError && (
                  <span className='flex items-center gap-1 text-xs text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {jsonError}
                  </span>
                )}
              </div>
              <Textarea
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder='{ "key": "value" }'
                className={cn(
                  'min-h-[160px] font-mono text-sm resize-y',
                  jsonError && 'border-destructive focus-visible:ring-destructive'
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader className='pb-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <CardTitle className='text-base'>Response</CardTitle>
              <div className='flex items-center gap-3'>
                {(response.status ?? 0) > 0 ? (
                  <Badge
                    variant='outline'
                    className={cn(
                      'font-mono text-xs font-bold tabular-nums',
                      getStatusColorClass(response.status ?? 0)
                    )}
                  >
                    {response.status ?? 0} {response.statusText}
                  </Badge>
                ) : (
                  <Badge variant='destructive' className='font-mono text-xs font-bold'>
                    Error
                  </Badge>
                )}
                <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <Clock className='h-3 w-3' />
                  {response.duration}ms
                </span>
                {response.body && (
                  <CopyButton text={response.body} />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Response Headers (collapsible) */}
            {Object.keys(response.headers).length > 0 && (
              <details className='mb-3 group'>
                <summary className='cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors'>
                  Response Headers ({Object.keys(response.headers).length})
                </summary>
                <div className='mt-2 max-h-32 overflow-y-auto rounded-md bg-muted/50 p-3'>
                  <div className='space-y-1'>
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className='flex gap-2 text-xs'>
                        <span className='font-mono font-medium text-foreground min-w-[140px] shrink-0'>{key}:</span>
                        <span className='font-mono text-muted-foreground break-all'>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
            {/* Response Body */}
            <div className='relative'>
              <pre className='max-h-[400px] overflow-auto rounded-lg bg-muted/50 p-4'>
                <code className='text-sm font-mono leading-relaxed whitespace-pre-wrap break-all'>
                  {response.body || '(empty response)'}
                </code>
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code Snippets */}
      <Card>
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base'>Code Snippets</CardTitle>
            <CopyButton text={codeSnippets[activeCodeTab as keyof typeof codeSnippets]} />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCodeTab} onValueChange={setActiveCodeTab}>
            <TabsList className='mb-3 h-8'>
              <TabsTrigger value='curl' className='text-xs px-3'>cURL</TabsTrigger>
              <TabsTrigger value='javascript' className='text-xs px-3'>JavaScript</TabsTrigger>
              <TabsTrigger value='python' className='text-xs px-3'>Python</TabsTrigger>
              <TabsTrigger value='php' className='text-xs px-3'>PHP</TabsTrigger>
              <TabsTrigger value='nodejs' className='text-xs px-3'>Node.js</TabsTrigger>
            </TabsList>
            {(['curl', 'javascript', 'python', 'php', 'nodejs'] as const).map((lang) => (
              <TabsContent key={lang} value={lang} className='mt-0'>
                <pre className='max-h-[300px] overflow-auto rounded-lg bg-muted/50 p-4'>
                  <code className='text-xs font-mono leading-relaxed whitespace-pre-wrap break-all'>
                    {codeSnippets[lang]}
                  </code>
                </pre>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
