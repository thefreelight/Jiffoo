import Image, { type ImageProps } from 'next/image';
import { canOptimizeImage } from '@/lib/image-policy';

export function ShopImage({ alt, ...props }: ImageProps) {
  return <Image {...props} alt={alt} unoptimized={props.unoptimized ?? (typeof props.src === 'string' && !canOptimizeImage(props.src))} />;
}
