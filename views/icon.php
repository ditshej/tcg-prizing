<?php
/**
 * The icons (#142): Lucide, vendored as single SVG files under
 * `public/vendor/lucide-1.53.0/` with their ISC licence beside them — pinned
 * by the version in the path, the way Alpine is, no package and no build step.
 *
 * PHP inlines the file rather than pointing an `<img>` at it, so the stroke
 * takes `currentColor` and the icon is the colour of the text beside it in
 * both modes. Every icon is a decoration: the word or the `aria-label` of its
 * button says what it does (#61, "Icon und Wort, nie Icon allein" for the
 * foot; the label for a button that only carries an icon).
 *
 * The size is the stylesheet's (`.icon`, 1em), not the file's 24 px.
 */

const LUCIDE_DIR = __DIR__ . '/../public/vendor/lucide-1.53.0/';

function icon(string $name, string $class = ''): string
{
    static $cache = [];
    if (!isset($cache[$name])) {
        $svg = file_get_contents(LUCIDE_DIR . $name . '.svg');
        if ($svg === false) {
            throw new RuntimeException("Lucide icon {$name} is not vendored");
        }
        $svg = preg_replace('/<!--.*?-->\s*/s', '', $svg);
        $svg = preg_replace('/\s+(class|width|height)="[^"]*"/', '', $svg);
        $svg = preg_replace('/\s+/', ' ', trim($svg));
        $svg = str_replace('> <', '><', $svg);
        $cache[$name] = $svg;
    }
    $classes = trim("icon icon-{$name} {$class}");
    return preg_replace('/^<svg /', '<svg class="' . $classes . '" aria-hidden="true" focusable="false" ', $cache[$name]);
}
