import React, { memo, useMemo } from "react";

/** Deliberately limited adapter for the existing pure SVG renderers. */
export const SvgMarkup = memo(function SvgMarkup({
  html,
  className,
  onClick,
  onKeyDown,
}) {
  const markup = useMemo(() => ({ __html: html }), [html]);
  return (
    <span
      className={className}
      onClick={onClick}
      onKeyDown={onKeyDown}
      dangerouslySetInnerHTML={markup}
    />
  );
});
