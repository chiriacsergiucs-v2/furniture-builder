import { useState } from 'react';
import { sellerImageAllowed } from './sellerOrigins';

/**
 * A seller's product picture (ADR-161), loaded from the seller's site. Imported lazily; a URL outside the allowed
 * seller origins is never loaded, and a picture that fails (offline) leaves no broken image behind.
 */
export default function SellerPicture({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !sellerImageAllowed(src)) return null;
  return (
    <img
      className="seller-pic"
      src={src}
      alt={alt}
      width={72}
      height={72}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
