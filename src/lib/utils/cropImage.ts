import type { Area } from "react-easy-crop";
import { STAMP_MASK_HEIGHT, STAMP_MASK_WIDTH } from "@/components/stamps/stampMask";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

// Derived from the mask's own aspect ratio, not a separately hand-picked
// size — this used to be a flat 680x840 (a ~0.81 aspect), left over from
// this app's very first scaffold and never updated across two later mask
// swaps (stampMask.ts is now ~0.69). `cropArea` itself is already shaped
// to the *current* mask (PhotoCropModal's own STAMP_ASPECT, computed the
// same way), so drawing it into a differently-shaped output canvas here
// silently squashed every crop non-uniformly — harmless under "meet"
// (just letterboxed), but under the "slice"/cover fit this app used
// before, that distortion is exactly what pushed part of the photo (e.g.
// a firework's own burst) outside the frame. Keeping this in lockstep
// with the mask means the two can never disagree again, even if the mask
// changes shape once more.
const OUTPUT_WIDTH = 680;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / (STAMP_MASK_WIDTH / STAMP_MASK_HEIGHT));

/** Crops `imageSrc` to `cropArea` (in source-image pixels) and returns a JPEG blob. */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropArea: Area,
  outputWidth = OUTPUT_WIDTH,
  outputHeight = OUTPUT_HEIGHT
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 생성할 수 없습니다.");

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지 변환에 실패했습니다."))),
      "image/jpeg",
      0.92
    );
  });
}
