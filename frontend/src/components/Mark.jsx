import { markMarkup } from '../scene/marks';

/** A maker's mark as inline SVG, for use inside another <svg>. */
export function Mark({ vendor, color }) {
  return <g dangerouslySetInnerHTML={{ __html: markMarkup(vendor, color) }} />;
}
