import Image, { type ImageProps } from "next/image";

/** Обёртка над next/image: SVG-заглушки и внешние URL отдаются без оптимизатора */
export function ProductImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  const unoptimized = src.endsWith(".svg") || props.unoptimized;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} unoptimized={unoptimized} />;
}
