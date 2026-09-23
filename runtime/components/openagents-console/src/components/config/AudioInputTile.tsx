import {
  BarVisualizer,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";

export const AudioInputTile = ({
  trackRef,
}: {
  trackRef: TrackReferenceOrPlaceholder;
}) => {
  return (
    <div
      className={`flex flex-row gap-2 h-[100px] items-center w-full justify-center border rounded-xl border-white/10 bg-surface-2`}
    >
      <BarVisualizer
        track={trackRef}
        className="h-full w-full"
        barCount={20}
        options={{ minHeight: 0 }}
      />
    </div>
  );
};
