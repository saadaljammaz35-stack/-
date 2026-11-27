import { themeScript } from '@/components/site/ThemeToggle';

/**
 * Applies a saved light/dark preference before first paint. It sits at the end of <body>: a classic inline
 * script waits for pending stylesheets, and placing it in <head> paused the HTML parser early enough for
 * hydration to start on a partial document (intermittent React #418). At the end of <body> the document is
 * complete when the parser pauses, and paint is still blocked by the same stylesheets, so there is no flash.
 */
export function ThemeScript() {
  return <script id="wared-theme" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
