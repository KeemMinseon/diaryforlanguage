"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/utils/cropImage";

const STAMP_ASPECT = 170 / 210;

export default function PhotoCropModal({
  imageSrc,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    setWorking(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedArea);
      onConfirm(blob);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4">
      <div className="relative mx-auto w-full max-w-md flex-1 overflow-hidden rounded-2xl bg-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={STAMP_ASPECT}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="mx-auto mt-4 w-full max-w-md">
        <label className="mb-1 block text-xs text-white/70">확대 / 축소</label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
        <p className="mt-2 text-center text-xs text-white/60">
          드래그해서 위치를 옮기고, 슬라이더로 확대해 우표 안에 담을 부분을 골라주세요.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/30 py-2.5 text-sm text-white"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="flex-1 rounded-lg bg-[var(--ink)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {working ? "적용 중…" : "이 부분으로 우표 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}
