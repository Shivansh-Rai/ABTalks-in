"use client";

import { useState } from "react";
import Image from "next/image";

const PLACEHOLDER = "/marketplace/placeholder.png";

type Props = {
  src: string | null;
  alt: string;
};

export function ProductImage({ src, alt }: Props) {
  const [imgSrc, setImgSrc] = useState(src ?? PLACEHOLDER);

  return (
    <div className="relative aspect-square w-full bg-zinc-800">
      <Image
        src={imgSrc}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 50vw, 25vw"
        onError={() => setImgSrc(PLACEHOLDER)}
      />
    </div>
  );
}
