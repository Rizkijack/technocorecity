'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { IconArrowLeft } from './icons';
import { useWorldStore } from '@/stores/world-store';

/**
 * Fixed-position "back to map" affordance. Visible only when a room is
 * selected, so the global canvas HUD (Hud/Legend) stays uncluttered
 * during normal exploration. Anchored top-left of the viewport so it
 * never gets covered by the right-rail panel or the bottom-sheet on
 * mobile/tablet. CameraRig auto-flies back to overview when
 * `selectedRoomId` clears, so this is purely a trigger.
 */
export function BackToMapButton() {
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const selectRoom = useWorldStore((s) => s.selectRoom);
  const visible = selectedRoomId !== null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          key="back-to-map"
          type="button"
          onClick={() => selectRoom(null)}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          // Sit above the right-rail panel (z-20) and bottom-sheet (z-20).
          // Hud uses z-30 but only on the top bar; this corner is free.
          className="pointer-events-auto fixed left-3 top-3 z-40 inline-flex items-center gap-2 rounded-full border border-bg-light/40 bg-bg-mid/80 px-3 py-2 font-mono text-xs font-medium text-text-primary shadow-panel-elev backdrop-blur transition-colors hover:border-accent-cyan/60 hover:bg-bg-elev/90 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          aria-label="Back to map"
          title="Back to map (Esc)"
          data-testid="back-to-map"
        >
          <IconArrowLeft size={16} />
          <span>Map</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

export default BackToMapButton;
