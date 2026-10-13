"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Ruler, X, ChevronLeft, ChevronRight, Minus, Plus, MapPin, ZoomIn } from "lucide-react";
import clsx from "clsx";
import { useCart, useFavorites, useI18n, useToast } from "./providers";
import { ProductImage } from "./product-image";
import { WhatsAppIcon } from "./whatsapp-button";
import { SizeHelper } from "./size-helper";
import { formatPrice, discountPercent } from "@/lib/format";
import { fmt } from "@/i18n";
import { analytics } from "@/lib/analytics";
import type { SizeChartRow } from "@/lib/size-recommender";

export type DetailVariant = {
  id: string;
  sku: string;
  colorCode: string;
  size: string;
  height: string | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  byWarehouse: { name: string; city: string; qty: number }[];
};

type Product = {
  id: string;
  article: string;
  brand: string;
  name: string;
  isDemo: boolean;
  isNew: boolean;
  hasHeights: boolean;
  fit: "SLIM" | "REGULAR" | "RELAXED" | null;
  season: "ALL_SEASON" | "DEMI" | "WINTER" | "SUMMER" | null;
  description: string | null;
  composition: string | null;
  material: string | null;
  care: string | null;
  fitAdvice: string | null;
  videoUrl: string | null;
  category: string;
};

export type ChartInfo = { rows: SizeChartRow[]; notes: string | null; isDemo: boolean; kind: string } | null;

export function ProductDetail({
  product,
  images,
  colors,
  variants,
  sizeChart,
  whatsapp,
}: {
  product: Product;
  images: { url: string; alt: string; colorCode: string | null }[];
  colors: { code: string; name: string; hex: string }[];
  variants: DetailVariant[];
  sizeChart: ChartInfo;
  whatsapp: string;
}) {
  const { t, locale } = useI18n();
  const cart = useCart();
  const fav = useFavorites();
  const toast = useToast();
  const router = useRouter();

  const firstAvailableColor = colors.find((c) => variants.some((v) => v.colorCode === c.code && v.stock > 0))?.code ?? colors[0]?.code;
  const [color, setColor] = useState(firstAvailableColor);
  const [size, setSize] = useState<string | null>(null);
  const [height, setHeight] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [panel, setPanel] = useState<"chart" | "helper" | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  const colorVariants = variants.filter((v) => v.colorCode === color);
  const sizes = Array.from(new Set(colorVariants.map((v) => v.size)));
  const heights = Array.from(new Set(colorVariants.filter((v) => v.height).map((v) => v.height!))).sort();
  const needsHeight = product.hasHeights && heights.length > 0;

  const sizeStock = (s: string) => colorVariants.filter((v) => v.size === s && (!needsHeight || !height || v.height === height)).reduce((a, v) => a + v.stock, 0);
  const heightStock = (h: string) => colorVariants.filter((v) => v.height === h && (!size || v.size === size)).reduce((a, v) => a + v.stock, 0);

  const selected = colorVariants.find((v) => v.size === size && (!needsHeight || v.height === height)) ?? null;
  const priceSource = selected ?? [...colorVariants].sort((a, b) => a.price - b.price)[0] ?? variants[0];
  const inCartQty = selected ? (cart.items.find((i) => i.variantId === selected.id)?.quantity ?? 0) : 0;
  const maxQty = selected ? Math.max(0, Math.min(20, selected.stock - inCartQty)) : 0;

  const gallery = useMemo(() => {
    const own = images.filter((i) => i.colorCode === color);
    const common = images.filter((i) => !i.colorCode);
    const list = own.length ? [...own, ...common] : images;
    return list.length ? list : [];
  }, [images, color]);

  useEffect(() => {
    setActiveImage(0);
  }, [color]);

  useEffect(() => {
    analytics.viewItem({ item_id: product.article, item_name: product.name, price: priceSource?.price ?? 0, item_category: product.category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, maxQty || 1)));
  }, [maxQty]);

  const validate = (): DetailVariant | null => {
    if (!size) {
      setError(t.product.chooseSize);
      return null;
    }
    if (needsHeight && !height) {
      setError(t.product.chooseHeight);
      return null;
    }
    if (!selected || selected.stock <= 0) {
      setError(t.product.notAvailable);
      return null;
    }
    if (maxQty <= 0) {
      setError(t.product.maxQtyReached);
      return null;
    }
    setError(null);
    return selected;
  };

  const addToCart = (goCheckout = false) => {
    const v = validate();
    if (!v) return;
    cart.add(v.id, Math.min(qty, maxQty), v.stock);
    analytics.addToCart({ item_id: product.article, item_name: product.name, price: v.price, quantity: qty, item_variant: `${color}/${v.size}${v.height ? "/" + v.height : ""}` });
    if (goCheckout) router.push(`/${locale}/checkout`);
    else toast(t.cart.added, { label: t.cart.view, href: `/${locale}/cart` });
  };

  const colorName = colors.find((c) => c.code === color)?.name ?? "";
  const extra = [colorName && `, ${t.product.color.toLowerCase()}: ${colorName}`, size && `, ${t.product.size.toLowerCase()}: ${size}`, height && `/${height}`].filter(Boolean).join("");
  const waText = fmt(t.product.whatsappAsk, { name: product.name, article: product.article, extra });
  const waDigits = whatsapp.replace(/\D/g, "");
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText + (typeof window !== "undefined" ? `\n${window.location.href}` : ""))}` : null;
  const liked = fav.has(product.id);
  const disc = priceSource ? discountPercent(priceSource.price, priceSource.oldPrice) : 0;

  return (
    <div className="mt-4 md:mt-6 grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-8 lg:gap-14">
      {/* Галерея */}
      <div>
        {/* мобильная карусель */}
        <div className="lg:hidden -mx-4">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
            onScroll={(e) => {
              const el = e.currentTarget;
              setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {(gallery.length ? gallery : [null]).map((img, i) => (
              <button key={i} className="relative shrink-0 w-full aspect-[3/4] snap-center bg-milk" onClick={() => img && setLightbox(i)} aria-label={t.product.zoom}>
                {img && <ProductImage src={img.url} alt={img.alt} fill sizes="100vw" priority={i === 0} className="object-cover" />}
              </button>
            ))}
          </div>
          {gallery.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {gallery.map((_, i) => (
                <span key={i} className={clsx("h-1 rounded-full transition-all", i === activeImage ? "w-6 bg-ink" : "w-1.5 bg-ink/25")} />
              ))}
            </div>
          )}
        </div>
        {/* десктоп: сетка */}
        <div className="hidden lg:grid grid-cols-2 gap-2">
          {gallery.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setLightbox(i)}
              className={clsx("group relative bg-milk aspect-[3/4] overflow-hidden cursor-zoom-in", i === 0 && gallery.length % 2 === 1 && "col-span-2 aspect-[4/5]")}
              aria-label={t.product.zoom}
            >
              <ProductImage src={img.url} alt={img.alt} fill sizes="(max-width:1280px) 30vw, 420px" priority={i < 2} className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              <ZoomIn className="absolute right-3 bottom-3 w-5 h-5 opacity-0 group-hover:opacity-70 transition-opacity" />
            </button>
          ))}
          {product.videoUrl && (
            <video src={product.videoUrl} controls playsInline className="col-span-2 w-full bg-black" preload="none" aria-label={t.product.video} />
          )}
        </div>
      </div>

      {/* Информация и покупка */}
      <div className="lg:sticky lg:top-24 self-start">
        {product.isDemo && (
          <div className="mb-5 border border-danger/30 bg-danger/5 text-danger text-xs leading-relaxed p-3">
            <b className="tracking-[0.14em]">{t.product.demoBadge}.</b> {t.product.demoNotice}
          </div>
        )}
        <div className="eyebrow">{product.brand} · {t.product.article} {product.article}</div>
        <h1 className="font-display text-3xl md:text-[40px] leading-[1.1] mt-2">{product.name}</h1>

        <div className="mt-4 flex items-baseline gap-3">
          {priceSource && (
            <>
              <span className={clsx("text-2xl", priceSource.oldPrice && "text-wood-dark")}>{formatPrice(priceSource.price, locale)}</span>
              {priceSource.oldPrice && (
                <>
                  <span className="text-ink-muted line-through">{formatPrice(priceSource.oldPrice, locale)}</span>
                  <span className="bg-ink text-white text-xs px-2 py-0.5">−{disc}%</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Цвет */}
        {colors.length > 0 && (
          <div className="mt-8">
            <div className="text-sm mb-3">
              <span className="text-ink-muted">{t.product.color}:</span> {colorName}
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {colors.map((c) => {
                const available = variants.some((v) => v.colorCode === c.code && v.stock > 0);
                return (
                  <button
                    key={c.code}
                    onClick={() => {
                      setColor(c.code);
                      setSize(null);
                      setHeight(null);
                      setError(null);
                    }}
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={c.code === color}
                    className={clsx(
                      "w-9 h-9 rounded-full border border-black/10 relative transition-shadow",
                      c.code === color && "ring-1 ring-ink ring-offset-[3px]",
                      !available && "opacity-40",
                    )}
                    style={{ background: c.hex }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Размер */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm">
              <span className="text-ink-muted">{t.product.size}:</span> {size ?? "—"}
            </span>
            <div className="flex gap-4">
              {sizeChart && (
                <button onClick={() => setPanel("chart")} className="text-xs underline underline-offset-4 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5" /> {t.product.sizeGuide}
                </button>
              )}
              <button onClick={() => setPanel("helper")} className="text-xs underline underline-offset-4">
                {t.product.sizeHelper}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
            {sizes.map((s) => {
              const stock = sizeStock(s);
              return (
                <button
                  key={s}
                  disabled={stock <= 0}
                  onClick={() => {
                    setSize(s);
                    setError(null);
                    if (needsHeight && height && !colorVariants.some((v) => v.size === s && v.height === height && v.stock > 0)) setHeight(null);
                  }}
                  className={clsx(
                    "h-11 border text-sm transition-colors relative",
                    s === size ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    stock <= 0 && "text-ink-muted/50 hover:border-line cursor-not-allowed line-through decoration-ink-muted/40",
                  )}
                  aria-pressed={s === size}
                  aria-label={`${t.product.size} ${s}${stock <= 0 ? ` — ${t.product.outOfStock}` : ""}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ростовка */}
        {needsHeight && (
          <div className="mt-6">
            <div className="text-sm mb-3">
              <span className="text-ink-muted">{t.product.height}:</span> {height ?? "—"}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {heights.map((h) => {
                const stock = heightStock(h);
                return (
                  <button
                    key={h}
                    disabled={stock <= 0}
                    onClick={() => {
                      setHeight(h);
                      setError(null);
                    }}
                    className={clsx(
                      "h-11 px-4 border text-sm",
                      h === height ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                      stock <= 0 && "text-ink-muted/50 line-through cursor-not-allowed hover:border-line",
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Наличие */}
        <div className="mt-5 min-h-[20px] text-sm">
          {selected ? (
            selected.stock > 0 ? (
              <div className="space-y-1">
                <span className={clsx(selected.stock <= 2 ? "text-wood-dark" : "text-success")}>
                  ● {fmt(t.product.availableQty, { n: selected.stock })}
                  {selected.stock <= 2 && ` · ${t.product.lowStock}`}
                </span>
                {selected.byWarehouse.length > 0 && (
                  <div className="text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3 h-3" />
                    {selected.byWarehouse.map((w) => `${w.city}: ${w.qty}`).join(" · ")}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-danger">{t.product.notAvailable}</span>
            )
          ) : (
            !variants.some((v) => v.stock > 0) && <span className="text-danger">{t.product.outOfStock}</span>
          )}
        </div>

        {/* Количество и кнопки */}
        <div className="mt-5 flex gap-2">
          <div className="flex items-center border border-line h-12">
            <button className="w-10 h-full flex items-center justify-center disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="-">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm" aria-live="polite">{qty}</span>
            <button className="w-10 h-full flex items-center justify-center disabled:opacity-30" onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))} disabled={!selected || qty >= maxQty} aria-label="+">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <button className="btn-primary flex-1" onClick={() => addToCart(false)}>
            {t.product.addToCart}
          </button>
          <button
            className="w-12 h-12 border border-line flex items-center justify-center hover:border-ink shrink-0"
            onClick={() => fav.toggle(product.id)}
            aria-label={liked ? t.product.inFavorites : t.product.toFavorites}
            aria-pressed={liked}
          >
            <Heart className={clsx("w-5 h-5", liked && "fill-ink")} strokeWidth={1.4} />
          </button>
        </div>
        <button className="btn-outline w-full mt-2" onClick={() => addToCart(true)}>
          {t.product.buyNow}
        </button>
        {error && <p className="text-sm text-danger mt-3" role="alert">{error}</p>}

        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-4 h-12 w-full flex items-center justify-center gap-2 text-sm border border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/5">
            <WhatsAppIcon className="w-5 h-5" /> {t.product.askSize}
          </a>
        )}

        {/* Характеристики */}
        <dl className="mt-10 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-muted">{t.product.article}</dt>
          <dd>{product.article}{selected && <span className="text-ink-muted"> · SKU {selected.sku}</span>}</dd>
          <dt className="text-ink-muted">{t.product.brand}</dt>
          <dd>{product.brand}</dd>
          {product.fit && (
            <>
              <dt className="text-ink-muted">{t.product.fit}</dt>
              <dd>{t.fit[product.fit]}</dd>
            </>
          )}
          {product.season && (
            <>
              <dt className="text-ink-muted">{t.product.season}</dt>
              <dd>{t.season[product.season]}</dd>
            </>
          )}
          {product.material && (
            <>
              <dt className="text-ink-muted">{t.product.material}</dt>
              <dd>{product.material}</dd>
            </>
          )}
          {product.composition && (
            <>
              <dt className="text-ink-muted">{t.product.composition}</dt>
              <dd>{product.composition}</dd>
            </>
          )}
        </dl>

        <div className="mt-8 border-t border-line">
          {product.description && <Accordion title={t.product.description} open>{product.description}</Accordion>}
          {product.fitAdvice && <Accordion title={t.product.fitAdvice}>{product.fitAdvice}</Accordion>}
          {product.care && <Accordion title={t.product.care}>{product.care}</Accordion>}
          <Accordion title={t.product.delivery}>{t.product.deliveryText}</Accordion>
        </div>
      </div>

      {/* Лайтбокс */}
      {lightbox !== null && gallery[lightbox] && (
        <div className="fixed inset-0 z-[80] bg-white flex items-center justify-center animate-fade-in" role="dialog" aria-modal>
          <button className="absolute right-4 top-4 p-2 z-10" onClick={() => setLightbox(null)} aria-label={t.nav.close}>
            <X className="w-7 h-7" strokeWidth={1.3} />
          </button>
          {gallery.length > 1 && (
            <>
              <button className="absolute left-2 md:left-6 p-3 z-10" onClick={() => setLightbox((lightbox - 1 + gallery.length) % gallery.length)} aria-label="prev">
                <ChevronLeft className="w-8 h-8" strokeWidth={1} />
              </button>
              <button className="absolute right-2 md:right-6 p-3 z-10" onClick={() => setLightbox((lightbox + 1) % gallery.length)} aria-label="next">
                <ChevronRight className="w-8 h-8" strokeWidth={1} />
              </button>
            </>
          )}
          <ZoomableImage src={gallery[lightbox].url} alt={gallery[lightbox].alt} />
        </div>
      )}

      {/* Панели размеров */}
      {panel && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setPanel(null)} />
          <div className="absolute right-0 inset-y-0 w-full sm:w-[520px] bg-white overflow-y-auto animate-slide-in">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 h-14 border-b border-line z-10">
              <div className="flex gap-5 text-[12px] uppercase tracking-[0.14em]">
                <button onClick={() => setPanel("helper")} className={clsx(panel === "helper" ? "text-ink" : "text-ink-muted")}>{t.product.sizeHelper}</button>
                {sizeChart && <button onClick={() => setPanel("chart")} className={clsx(panel === "chart" ? "text-ink" : "text-ink-muted")}>{t.product.sizeGuide}</button>}
              </div>
              <button onClick={() => setPanel(null)} className="p-2 -mr-2" aria-label={t.nav.close}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {panel === "helper" ? (
                <SizeHelper
                  chart={sizeChart}
                  fit={product.fit}
                  waHref={waHref}
                  onPick={(s, h) => {
                    if (sizes.includes(s)) setSize(s);
                    if (h && heights.includes(h)) setHeight(h);
                  }}
                />
              ) : (
                sizeChart && <SizeChartTable chart={sizeChart} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Accordion({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-b border-line" open={open}>
      <summary className="flex items-center justify-between py-4 cursor-pointer list-none text-[12px] uppercase tracking-[0.14em]">
        {title}
        <Plus className="w-4 h-4 transition-transform group-open:rotate-45" strokeWidth={1.4} />
      </summary>
      <div className="pb-5 text-sm leading-relaxed text-ink-soft whitespace-pre-line">{children}</div>
    </details>
  );
}

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  return (
    <div
      className={clsx("relative w-full h-full overflow-hidden", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
      onClick={() => setZoom((z) => !z)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
    >
      <ProductImage src={src} alt={alt} fill sizes="100vw" className="object-contain transition-transform duration-300" style={{ transform: zoom ? "scale(2.2)" : "scale(1)", transformOrigin: origin }} />
    </div>
  );
}

export function SizeChartTable({ chart }: { chart: NonNullable<ChartInfo> }) {
  const { t } = useI18n();
  const cols: { key: keyof SizeChartRow; label: string; range?: [keyof SizeChartRow, keyof SizeChartRow] }[] = [
    { key: "size", label: t.product.size },
    { key: "height", label: t.product.height },
    { key: "chestMin", label: t.sizeHelper.chest, range: ["chestMin", "chestMax"] },
    { key: "waistMin", label: t.sizeHelper.waist, range: ["waistMin", "waistMax"] },
    { key: "hipsMin", label: "Hips, cm", range: ["hipsMin", "hipsMax"] },
    { key: "heightMin", label: t.sizeHelper.height, range: ["heightMin", "heightMax"] },
    { key: "weightMin", label: t.sizeHelper.weight, range: ["weightMin", "weightMax"] },
  ];
  const visible = cols.filter((c) => chart.rows.some((r) => (c.range ? r[c.range[0]] ?? r[c.range[1]] : r[c.key]) != null && (c.range ? true : r[c.key] !== "")));
  const cell = (r: SizeChartRow, c: (typeof cols)[number]) => {
    if (!c.range) return r[c.key] ?? "—";
    const a = r[c.range[0]];
    const b = r[c.range[1]];
    if (a == null && b == null) return "—";
    return a === b || b == null ? a : a == null ? b : `${a}–${b}`;
  };
  return (
    <div>
      {chart.isDemo && <p className="text-xs text-danger mb-4">{t.sizeHelper.chartDemo}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse">
          <thead>
            <tr className="bg-milk">
              {visible.map((c) => (
                <th key={c.key} className="px-2 py-2.5 font-medium text-xs whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((r, i) => (
              <tr key={i} className="border-b border-line">
                {visible.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 whitespace-nowrap">{String(cell(r, c))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chart.notes && <p className="text-sm text-ink-muted mt-4 whitespace-pre-line">{chart.notes}</p>}
      <div className="mt-6 bg-milk p-4 text-sm">
        <div className="font-medium mb-1">{t.sizeHelper.howToMeasure}</div>
        <p className="text-ink-muted">{t.sizeHelper.howToMeasureText}</p>
      </div>
    </div>
  );
}
