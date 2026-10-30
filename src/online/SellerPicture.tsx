import { sellerImageAllowed } from './sellerOrigins';

/**
 * A seller's product picture (ADR-160), loaded from the seller's site. Imported lazily and shown only after the user
 * switches seller pictures on (ADR-126); a URL outside the allowed seller origins is never loaded.
 */
export default function SellerPicture({ src, alt }: { src: string; alt: string }) {
  if (!sellerImageAllowed(src)) return null;
  return (
    <img
      className="seller-pic"
      src={src}
      alt={alt}
      width={56}
      height={56}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
