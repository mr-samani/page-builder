/**
 * A single SVG element: [tag, attributes, children?].
 * Plain data (no HTML strings) so it can be rendered without innerHTML/sanitizer.
 */
export type IconNode = readonly [
  tag: string,
  attrs: Readonly<Record<string, string>>,
  children?: readonly IconNode[],
];

export interface IconDefinition {
  /** kebab-case unique name, e.g. 'grip-dots' */
  readonly name: string;
  readonly viewBox: string;
  /** Presentation attributes of the root <svg> (fill, stroke, stroke-width, ...) */
  readonly attrs?: Readonly<Record<string, string>>;
  readonly nodes: readonly IconNode[];
}
