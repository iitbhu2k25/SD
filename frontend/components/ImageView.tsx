"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Direction = "ltr" | "rtl";

type ImageSliderProps = {
  images: string[];
  interval?: number;
  direction?: Direction;
};

const ImageSlider = ({
  images,
  interval = 2000,
  direction = "ltr",
}: ImageSliderProps) => {
  const slides = [images[images.length - 1], ...images, images[0]];

  const [index, setIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (direction === "ltr" ? prev + 1 : prev - 1));
      setAnimate(true);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, direction]);

  useEffect(() => {
    if (!sliderRef.current) return;

    if (index === slides.length - 1) {
      setTimeout(() => {
        setAnimate(false);
        setIndex(1);
      }, 700);
    }

    if (index === 0) {
      setTimeout(() => {
        setAnimate(false);
        setIndex(slides.length - 2);
      }, 700);
    }
  }, [index, slides.length]);

  return (
    <div className="relative w-full h-132 overflow-hidden rounded-xl bg-gray-100 p-1">
      <div
        ref={sliderRef}
        className={`flex h-full ${
          animate ? "transition-transform duration-700 ease-in-out" : ""
        }`}
        style={{
          width: `${slides.length * 100}%`,
          transform: `translateX(-${index * (100 / slides.length)}%)`,
        }}
      >
        {slides.map((src, i) => (
          <div
            key={i}
            className="relative h-full"
            style={{ width: `${100 / slides.length}%` }}
          >
            <Image
              src={src}
              alt={`slide-${i}`}
              fill
              sizes="100vw"
              className="object-cover"
              priority={i === 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageSlider;
