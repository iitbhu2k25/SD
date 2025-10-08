"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import Image from "next/image";
import { Parallax, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

type Slide = {
  title: string;
  body: string;
  position?: string;
  title_type?: string;
  image: string;
  alt?: string;
};

export function SwiperSection({
  heroBg,
  slides = [],
}: {
  heroBg?: string;
  slides?: Slide[];
}) {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const [swiper, setSwiper] = useState<any>(null);

  const tiles = useMemo(() => {
    const slice = (a: number, b: number) => slides.slice(a, b);
    const pick1 = (idx: number) => (slides[idx] ? [slides[idx]] : []);
    const groups = [
      // { type: "single" as const, items: pick1(0) },
      { type: "grid" as const, items: slice(0, 3) },
      { type: "heading" as const, items: pick1(3) },
      { type: "grid" as const, items: slice(4, 8) },
      { type: "grid" as const, items: slice(8, 12) },
      { type: "heading" as const, items: pick1(12) },
      { type: "grid" as const, items: slice(13, 16) },
      { type: "grid" as const, items: slice(16, 20) },
    ];
    return groups;
  }, [slides]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !swiper || tiles.length === 0) return;

    let raf = 0;
    const getBounds = () => {
      const start = el.offsetTop;
      const end = start + el.offsetHeight - window.innerHeight;
      return { start, end };
    };
    const clamp = (v: number, min = 0, max = 1) =>
      Math.min(max, Math.max(min, v));

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { start, end } = getBounds();
        const range = Math.max(1, end - start);
        const progress = clamp((window.scrollY - start) / range);
        const target = Math.round(progress * (tiles.length - 1));
        if (swiper.activeIndex !== target) swiper.slideTo(target, 700);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [swiper, tiles.length]);

  return (
    <section
      ref={wrapperRef as any}
      className="relative w-full"
      style={{ height: `${Math.max(1, tiles.length) * 100}vh` }}
    >
      <div className="sticky top-0 h-screen">
        {/* Parallax background */}
        <div
          className="absolute inset-0 bg-center bg-cover bg-fixed -z-10 pointer-events-none"
          style={{ backgroundImage: `url('${heroBg}')` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10 pointer-events-none -z-10"
          aria-hidden
        />

        {/* Foreground tiles */}
        <div className="relative z-10 h-full w-full">
          <Swiper
            modules={[Parallax, Pagination]}
            onSwiper={setSwiper}
            allowTouchMove={false}
            slidesPerView={1}
            speed={700}
            parallax
            pagination={{ clickable: true }}
            direction="vertical"
            className="h-full"
          >
            {tiles.map((tile, idx) => (
              <SwiperSlide key={idx} className="h-full w-full">
                {tile.type === "heading" && (
                  <div className="h-full w-full flex items-center pt-10 md:pt-14">
                    <div className="w-full px-6 md:px-12 lg:px-16">
                      <div
                        className="mx-auto max-w-5xl text-center"
                        data-swiper-parallax-y="25%"
                        data-swiper-parallax-opacity="0.7"
                      >
                        <div className="inline-block bg-white/80 backdrop-blur-md rounded-2xl shadow-lg ring-1 ring-blue-100 px-8 py-6">
                          <h3 className="text-3xl sm:text-4xl md:text-6xl py-3 px-6 font-bold tracking-tight text-blue-700">
                            {tile.items[0]?.title}
                          </h3>
                          {tile.items[0]?.body ? (
                            <p className="mt-6 text-xl md:text-2xl leading-relaxed text-gray-700">
                              {tile.items[0]?.body}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

               
                {/* Tile type: grid (3 or 4 people) */}
                {tile.type === "grid" && (
                  <div className="h-full w-full flex items-center pt-10 md:pt-14">
                    <div className="w-full px-4 sm:px-6 md:px-12 lg:px-16">
                      <div
                        className="mx-auto max-w-6xl"
                        data-swiper-parallax-y="20%"
                        data-swiper-parallax-opacity="0.7"
                      >
                        {/* Desktop/tablet grid */}
                        <div
                          className={[
                            "hidden lg:grid gap-6 items-start",
                            tile.items.length === 3
                              ? "grid-cols-3"
                              : "grid-cols-4",
                          ].join(" ")}
                        >
                          {tile.items.map((p, k) => (
                            <figure
                              key={k}
                              className="text-white flex flex-col items-start max-w-[18rem]"
                            >
                              <div className="h-80 w-full mx-auto rounded-xl overflow-hidden">
                                {p.image ? (
                                  <Image
                                    src={p.image}
                                    alt={p.alt || p.title || "Portrait"}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gray-200" />
                                )}
                              </div>
                               <figcaption className={`mt-3 w-full bg-white/80 backdrop-blur-md rounded-lg shadow-lg ring-1 ring-blue-100 px-3 py-2 text-xs sm:text-sm md:text-base leading-snug flex items-center justify-center text-center overflow-hidden ${p.title_type === 'normal' ? 'h-16' : 'h-28'}`}>
                                <div>
                                  <span className="text-blue-700 block font-bold">
                                    {p.title}
                                  </span>
                                  {p.position ? (
                                    <div className="text-emerald-600 block font-medium text-sm">
                                      ({p.position})
                                    </div>
                                  ) : null}

                                  {p.body ? (
                                    <span className="text-gray-700 block line-clamp-2">
                                      {p.body}
                                    </span>
                                  ) : null}
                                </div>
                              </figcaption>
                            </figure>
                          ))}
                        </div>

                        {/* Mobile fallback: single horizontal row of cards */}
                        <div className="lg:hidden overflow-x-auto pb-4">
                          <div className="flex gap-4 px-4">
                            {tile.items.map((p, k) => (
                              <figure
                                key={k}
                                className="flex-shrink-0 w-64 text-white flex flex-col items-center"
                              >
                                <div className="h-80 w-full rounded-xl overflow-hidden">
                                  {p.image ? (
                                    <Image
                                      src={p.image}
                                      alt={p.alt || p.title || "Portrait"}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-gray-200" />
                                  )}
                                </div>
                                <figcaption className="mt-2 w-full text-center">
                                  <div className="bg-white/80 h-24 w-full backdrop-blur-md rounded-lg shadow-lg ring-1 ring-blue-100 px-3 py-2 text-sm leading-snug flex items-center justify-center text-center overflow-hidden">
                                    <div>
                                      <span className="block font-bold text-blue-700">
                                        {p.title}
                                      </span>
                                      {p.body ? (
                                        <span className="block text-gray-700 line-clamp-2">
                                          {p.body}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
