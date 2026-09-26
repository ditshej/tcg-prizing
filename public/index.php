<?php
/**
 * The entry point. PHP composes the shell from views outside the
 * docroot (ADR 0004); the docroot itself carries no template, no logic,
 * just this single include.
 */

require dirname(__DIR__) . '/views/shell.php';
