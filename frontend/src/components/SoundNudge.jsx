import { Volume2, X } from 'lucide-react';

/** A one-time offer to turn on sound, shown the first time someone asks. */
export default function SoundNudge({ onEnable, onDismiss }) {
  return (
    <div className="fade-up fixed right-4 bottom-4 z-40 md:top-[76px] md:bottom-auto">
      <div className="glass flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
        <span className="text-[13px] text-white/85">The cast talks. Turn on sound?</span>
        <button
          onClick={onEnable}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-black transition hover:bg-white/90 cursor-pointer"
        >
          <Volume2 className="h-3.5 w-3.5" />
          Turn it on
        </button>
        <button
          onClick={onDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:bg-white/10 cursor-pointer"
          title="No thanks"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
